import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import bwipjs from 'bwip-js';
import os from 'os'; 

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CARGA DE LIBRERÍAS (Modo Zadig/Nativo)
const escpos = require('escpos');
try {
    // Intentamos cargar el driver USB
    escpos.USB = require('escpos-usb');
} catch (e) {
    console.error("Error cargando escpos-usb (Revisar driver Zadig):", e);
}
escpos.Network = require('escpos-network');
const Jimp = require('jimp');

// -------------------- HELPERS --------------------
function formatCLP(num) { return '$ ' + new Intl.NumberFormat('es-CL').format(num); }

// Obtener IP Local
ipcMain.handle('getLocalIp', async () => {
    const nets = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name of Object.keys(nets)) {
        for (const netInterface of nets[name]) {
            if (netInterface.family === 'IPv4' && !netInterface.internal) {
                localIp = netInterface.address;
                break;
            }
        }
        if (localIp !== '127.0.0.1') break;
    }
    return localIp;
});

// Listar Impresoras USB (Nativo)
ipcMain.handle("listUsbDevices", async () => {
    try {
        if (!escpos.USB) return [];
        const devices = escpos.USB.findPrinter();
        return devices.map(d => ({
            name: `USB Printer (VID:${d.deviceDescriptor.idVendor.toString(16).toUpperCase()} PID:${d.deviceDescriptor.idProduct.toString(16).toUpperCase()})`,
            vid: d.deviceDescriptor.idVendor,
            pid: d.deviceDescriptor.idProduct
        }));
    } catch(e) { 
        console.error("Error buscando USB:", e);
        return []; 
    }
});

// -------------------- GENERADOR PDF417 (TIMBRE SII) --------------------
async function generatePdf417(data) {
    if (!data) return null;
    return new Promise((resolve) => {
        // Limpiamos la data del XML
        const cleanData = data.trim();
        console.log("--> Generando PDF417...");

        const options = { 
            bcid: 'pdf417', 
            text: cleanData, 
            eclevel: 5, 
            rowheight: 10, 
            scale: 4, 
            includetext: false, 
            padding: 0 
        };
        
        bwipjs.toBuffer(options, function (err, pngBuffer) {
            if (err) {
                console.error("❌ Error BWIP-JS:", err);
                return resolve(null);
            }
            
            // Procesamiento de Imagen con JIMP para máxima nitidez
            Jimp.read(pngBuffer).then(image => {
                const q = 40; // Margen blanco (Quiet Zone)
                const w = image.bitmap.width + q*2;
                const h = image.bitmap.height + q*2;

                new Jimp(w, h, 0xFFFFFFFF, (e, bg) => {
                    if(e) return resolve(null);
                    
                    // Componer y redimensionar a 480px (ideal para 80mm)
                    bg.composite(image, q, q)
                      .resize(480, Jimp.AUTO)
                      .greyscale()
                      .contrast(1)
                      .posterize(2); // Binarizar a B/N puro
                      
                    const tPath = path.join(app.getPath('temp'), `p417_${Date.now()}.png`);
                    
                    bg.writeAsync(tPath).then(() => {
                        // Cargar la imagen en formato ESCPOS
                        escpos.Image.load(tPath, img => {
                            try { fs.unlinkSync(tPath); } catch(x){} // Borrar temp
                            resolve(img);
                        });
                    }).catch(err => {
                        console.error("Error guardando imagen temp:", err);
                        resolve(null);
                    });
                });
            }).catch(err => {
                console.error("Error JIMP:", err);
                resolve(null);
            });
        });
    });
}

// -------------------- IMPRIMIR TICKET --------------------
async function printTicket(sale, opts) {
    console.log("[PRINT] Iniciando impresión...");
    return new Promise(async (resolve, reject) => {
        let device, printer;
        
        try {
            // A. RED (LAN)
            if (opts.type === 'lan' && opts.ip) {
                device = new escpos.Network(opts.ip, opts.port || 9100);
            } 
            // B. USB (Zadig)
            else if (opts.type === 'usb') {
                if (!escpos.USB) return reject("Driver USB no disponible (Falta Zadig/libusb)");
                
                if (opts.vid && opts.pid) {
                    device = new escpos.USB(opts.vid, opts.pid);
                } else {
                    device = new escpos.USB(); 
                }
            } else {
                return reject("Faltan datos de conexión");
            }

            const options = { encoding: 'CP858', width: 48 };
            printer = new escpos.Printer(device, options);

            device.open(async function(err) {
                if (err) return reject("Error abriendo impresora: " + err);
                
                try {
                    // --- ENCABEZADO ---
                    printer.align('ct')
                           .font('a').style('b').size(1, 1)
                           .text(sale.empresa.razonSocial || 'EMPRESA')
                           .size(0.5, 0.5).style('normal')
                           .text(`RUT: ${sale.empresa.rut || '-'}`)
                           .text(sale.empresa.direccion || 'Temuco')
                           .feed(1);

                    printer.align('lt')
                           .text('------------------------------------------')
                           .text(`BOLETA N: ${sale.venta.id_venta}`)
                           .text(`FECHA:    ${sale.venta.fecha}`)
                           .text('------------------------------------------');

                    // --- DETALLES ---
                    sale.detalles.forEach(d => {
                        // Formato simple tipo tabla
                        printer.tableCustom([
                            { text: String(d.cantidad), align: "LEFT", width: 0.15 },
                            { text: (d.nombre || '').substring(0, 20), align: "LEFT", width: 0.50 },
                            { text: formatCLP(d.subtotal), align: "RIGHT", width: 0.35 }
                        ]);
                    });

                    printer.text('------------------------------------------');
                    
                    // --- TOTALES ---
                    printer.align('rt').size(1,1).text(`TOTAL: ${formatCLP(sale.total)}`);

                    // --- TIMBRE ELECTRONICO (PDF417) ---
                    if (opts.content417) {
                        try {
                            const img = await generatePdf417(opts.content417);
                            if(img) {
                                printer.align('ct');
                                await printer.raster(img, 'normal'); // Imprimir imagen
                                printer.size(0.5, 0.5);
                                printer.text('Timbre Electronico SII');
                                printer.text('Verifique en www.sii.cl');
                            }
                        } catch(e) { 
                            console.error("Fallo generación timbre:", e);
                            printer.text('(Error visualizando timbre)');
                        }
                    }

                    printer.feed(3);
                    printer.cut();
                    
                    // Cierre seguro con delay
                    setTimeout(() => {
                        try { printer.close(); } catch(e){}
                        resolve({ ok: true });
                    }, 500);

                } catch (pError) {
                    try{ device.close() }catch(e){}
                    reject(pError);
                }
            });

        } catch (e) { reject(e); }
    });
}

// Handler IPC
ipcMain.handle('printFromData', async (event, sale, opts) => {
    try { await printTicket(sale, opts); return { ok: true }; } 
    catch (err) { console.error(err); return { ok: false, error: String(err) }; }
});

// Configuración Ventana
let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200, height: 800,
      icon: path.join(__dirname, 'build/icon.ico'), 
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
    });
    const isDev = !app.isPackaged; 
    if (isDev) mainWindow.loadURL('http://localhost:5173');
    else mainWindow.loadURL('https://miposra.site'); 
}
app.whenReady().then(createWindow);
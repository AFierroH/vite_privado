import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import bwipjs from 'bwip-js';
import os from 'os';
import net from 'net';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escpos = require('escpos');
// IMPORTANTE: ESTO REQUIERE DRIVER ZADIG (libusbK)
escpos.USB = require('escpos-usb'); 
escpos.Network = require('escpos-network');
const Jimp = require('jimp');

// -------------------- HELPERS --------------------
function formatCLP(num) { return '$ ' + new Intl.NumberFormat('es-CL').format(num); }

ipcMain.handle('getLocalIp', async () => {
    const nets = os.networkInterfaces();
    let localIp = null;
    for (const name of Object.keys(nets)) {
        for (const netInterface of nets[name]) {
            if (netInterface.family === 'IPv4' && !netInterface.internal) {
                localIp = netInterface.address;
                break;
            }
        }
        if (localIp) break;
    }
    return localIp || '127.0.0.1';
});

// LISTAR USB (Nativo Node/Zadig)
ipcMain.handle("listUsbDevices", async () => {
    try {
        const devices = escpos.USB.findPrinter();
        return devices.map(d => ({
            name: `USB Printer (VID:${d.deviceDescriptor.idVendor.toString(16)} PID:${d.deviceDescriptor.idProduct.toString(16)})`,
            vid: d.deviceDescriptor.idVendor,
            pid: d.deviceDescriptor.idProduct
        }));
    } catch(e) { 
        console.error("Error buscando USB:", e);
        return []; 
    }
});

// GENERAR PDF417 (Para Timbre SII)
async function generatePdf417(data) {
    if (!data) return null;
    return new Promise((resolve) => {
        const options = { 
            bcid: 'pdf417', 
            text: data.trim(), 
            eclevel: 5, 
            rowheight: 10, 
            scale: 4, 
            includetext: false, 
            padding: 0 
        };
        
        bwipjs.toBuffer(options, function (err, pngBuffer) {
            if (err) {
                console.error("Error BWIP:", err);
                return resolve(null);
            }
            Jimp.read(pngBuffer).then(image => {
                const q = 40; // Margen blanco
                new Jimp(image.bitmap.width + q*2, image.bitmap.height + q*2, 0xFFFFFFFF, (e, bg) => {
                    if(e) return resolve(null);
                    // Redimensionar para 80mm
                    bg.composite(image, q, q)
                      .resize(480, Jimp.AUTO)
                      .greyscale()
                      .contrast(1)
                      .posterize(2);
                      
                    const tPath = path.join(app.getPath('temp'), `p417_${Date.now()}.png`);
                    bg.writeAsync(tPath).then(() => {
                        escpos.Image.load(tPath, img => {
                            try { fs.unlinkSync(tPath); } catch(x){}
                            resolve(img);
                        });
                    });
                });
            }).catch(e => {
                console.error("Error JIMP:", e);
                resolve(null);
            });
        });
    });
}

// IMPRIMIR TICKET
async function printTicket(sale, opts) {
    console.log("[PRINT] Iniciando impresión Electron...");
    return new Promise(async (resolve, reject) => {
        let device, printer;
        
        try {
            // A. RED
            if (opts.type === 'lan' && opts.ip) {
                device = new escpos.Network(opts.ip, opts.port || 9100);
            } 
            // B. USB (Zadig)
            else if (opts.type === 'usb') {
                if (opts.vid && opts.pid) {
                    device = new escpos.USB(opts.vid, opts.pid);
                } else {
                    device = new escpos.USB(); // Auto-detect
                }
            } else {
                return reject("Faltan datos de conexión");
            }

            const options = { encoding: 'CP858', width: 48 };
            printer = new escpos.Printer(device, options);

            device.open(async function(err) {
                if (err) return reject("Error abriendo impresora: " + err);
                
                try {
                    // --- DISEÑO ---
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

                    sale.detalles.forEach(d => {
                        printer.tableCustom([
                            { text: String(d.cantidad), align: "LEFT", width: 0.15 },
                            { text: (d.nombre || '').substring(0, 20), align: "LEFT", width: 0.50 },
                            { text: formatCLP(d.subtotal), align: "RIGHT", width: 0.35 }
                        ]);
                    });

                    printer.text('------------------------------------------');
                    printer.align('rt').size(1,1).text(`TOTAL: ${formatCLP(sale.total)}`);

                    // TIMBRE
                    if (opts.content417) {
                        try {
                            const img = await generatePdf417(opts.content417);
                            if(img) {
                                printer.align('ct');
                                await printer.raster(img, 'normal');
                                printer.text('Timbre Electronico SII');
                            }
                        } catch(e) { console.error("Fallo Timbre:", e); }
                    }

                    printer.feed(3);
                    printer.cut();
                    
                    // Cierre seguro
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

ipcMain.handle('printFromData', async (event, sale, opts) => {
    try { await printTicket(sale, opts); return { ok: true }; } 
    catch (err) { console.error(err); return { ok: false, error: String(err) }; }
});

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
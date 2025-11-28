import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
// import iconv from 'iconv-lite'; // No se usa por ahora
import bwipjs from 'bwip-js';
// import { PNG } from 'pngjs'; // No se usa explícitamente si usamos Jimp/Escpos

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');
const Jimp = require('jimp');

// -------------------- CONFIGURACIÓN --------------------
let mainWindow = null;
let cachedLogoImage = null; 
const DEFAULT_CODEPAGE = 'CP858';
const PRINTER_WIDTH = 48; // Ajustar a 42 o 48 según impresora (80mm)

// -------------------- HELPERS --------------------
function formatCLP(num) { return '$ ' + new Intl.NumberFormat('es-CL').format(num); }

// NUEVO: Genera una imagen PNG del PDF417 a partir del string del timbre (TED)
async function generatePdf417(data) {
    return new Promise((resolve, reject) => {
        if (!data) return resolve(null);
        
        // Limpieza básica: Eliminar saltos de línea extremos que a veces trae el XML
        const cleanData = data.trim(); 
        console.log("--> Generando PDF417 SII. Longitud:", cleanData.length);

        bwipjs.toBuffer({
            bcid: 'pdf417',       // Tipo de código
            text: cleanData,      // El XML completo <TED>...</TED>
            scale: 2,             // Escala (2 suele ser legible en térmica)
            height: 10,           // Altura de las barras (mm aprox)
            includetext: false,   // No imprimir el texto del XML abajo (es muy largo)
            eclevel: 5,           // Nivel de corrección de errores (SII pide alto)
            columns: 16           // IMPORTANTE: Forzar columnas ayuda a la impresora térmica
        }, function (err, png) {
            if (err) {
                console.error("❌ Error BWIP-JS:", err);
                resolve(null);
            } else {
                const tempPath = path.join(app.getPath('temp'), `pdf417_${Date.now()}.png`);
                try {
                    fs.writeFileSync(tempPath, png);
                    console.log("✅ Imagen PDF417 guardada temporalmente:", tempPath);
                    
                    escpos.Image.load(tempPath, function(img) {
                        if(!img) {
                             console.error("Error cargando imagen en escpos");
                             resolve(null);
                        } else {
                             // Intentar borrar archivo temp
                             try { fs.unlinkSync(tempPath); } catch(e){}
                             resolve(img);
                        }
                    });
                } catch(ioErr) {
                    console.error("Error IO:", ioErr);
                    resolve(null);
                }
            }
        });
    });
}

async function processLogoForEscpos(urlOrPath) {
    return new Promise((resolve, reject) => {
        Jimp.read(urlOrPath)
            .then(image => {
                image.scaleToFit(200, 100).greyscale(); // Logo un poco más grande
                const tempPath = path.join(app.getPath('temp'), 'temp_logo.png');
                image.writeAsync(tempPath)
                     .then(() => { escpos.Image.load(tempPath, function(img){ resolve(img); }); })
                     .catch(reject);
            })
            .catch(err => { console.error("Jimp Error:", err); resolve(null); });
    });
}

// -------------------- IMPRESIÓN --------------------
async function printTicket(sale, opts) {
    return new Promise(async (resolve, reject) => {
        let device, printer;
        
        try {
            if (opts.type === 'lan' && opts.ip) {
                console.log(`LAN: ${opts.ip}`);
                device = new escpos.Network(opts.ip, opts.port || 9100);
            } 
            else if (opts.type === 'usb') {
                if (opts.vid && opts.pid) {
                    console.log(`USB: VID ${opts.vid} PID ${opts.pid}`);
                    device = new escpos.USB(opts.vid, opts.pid);
                } else {
                    console.log(`Auto-USB`);
                    device = new escpos.USB(); 
                }
            } else {
                return reject("Faltan datos de conexión");
            }

            // 1. Generar PDF417 antes de abrir impresora para no bloquear el puerto
            // opts.content417 contiene el string XML del timbre (<TED>...</TED>)
            let pdf417Img = null;
            if (opts.content417) {
                try {
                    pdf417Img = await generatePdf417(opts.content417);
                } catch(e) {
                    console.error("Fallo generando PDF417:", e);
                }
            }

            printer = new escpos.Printer(device, { encoding: DEFAULT_CODEPAGE, width: PRINTER_WIDTH });

            device.open(async function(err) {
                if (err) return reject("Error impresora: " + err);

                try {
                    // A. INICIO
                    printer.font('a').align('ct').style('b');
                    if (cachedLogoImage) await printer.image(cachedLogoImage, 's8');

                    // B. ENCABEZADO
                    printer.size(1, 1)
                           .text(sale.empresa.razonSocial || 'EMPRESA')
                           .style('normal').size(0.5, 0.5)
                           .text(`RUT: ${sale.empresa.rut || '-'}`)
                           .text(sale.empresa.direccion || '')
                           .text(`Tel: ${sale.empresa.telefono || ''}`)
                           .feed(1);

                    printer.align('lt')
                           .text('-'.repeat(PRINTER_WIDTH))
                           // Cambiamos "BOLETA" por "BOLETA ELECTRONICA" si hay timbre
                           .text(`${pdf417Img ? 'BOLETA ELECTRONICA' : 'TICKET'} N: ${sale.venta.id_venta}`) 
                           .text(`FECHA:  ${sale.venta.fecha}`)
                           .text('-'.repeat(PRINTER_WIDTH));

                    // C. DETALLES
                    printer.tableCustom([
                        { text: "CANT", align: "LEFT", width: 0.15 },
                        { text: "DESCRIPCION", align: "LEFT", width: 0.50 },
                        { text: "TOTAL", align: "RIGHT", width: 0.35 }
                    ]);

                    sale.detalles.forEach(d => {
                         const totalStr = formatCLP(d.subtotal);
                         const nombreCorto = d.nombre.substring(0, 22); 
                         
                         printer.tableCustom([
                            { text: String(d.cantidad), align: "LEFT", width: 0.15 },
                            { text: nombreCorto, align: "LEFT", width: 0.50 },
                            { text: totalStr, align: "RIGHT", width: 0.35 }
                        ]);
                    });

                    printer.text('-'.repeat(PRINTER_WIDTH));
                    
                    // D. TOTALES
                    const total = sale.total;
                    const neto = Math.round(total / 1.19);
                    const iva = total - neto;

                    printer.align('rt').style('normal')
                           .text(`Neto: ${formatCLP(neto)}`)
                           .text(`IVA (19%): ${formatCLP(iva)}`)
                           .feed(1);

                    printer.align('rt').style('b').size(1, 1)
                           .text(`TOTAL: ${formatCLP(total)}`)
                           .size(0.5, 0.5).style('normal').align('ct').feed(1);

                    // E. TIMBRE PDF417 (REEMPLAZO DEL QR)
                    if (pdf417Img) {
                        printer.align('ct'); // Centrar
                        await printer.image(pdf417Img, 's8'); // 's8' o 'd24' suelen funcionar bien
                        printer.feed(1);
                        printer.text('Timbre Electronico SII');
                        printer.text('Res. 80 de 2014 - Verifique en www.sii.cl');
                    } else {
                        printer.text('(Sin Timbre SII - Error Generacion)');
                    }

                    printer.feed(2);
                    printer.cut();
                    printer.close(); 
                    resolve({ ok: true });

                } catch (pError) {
                    device.close();
                    reject(pError);
                }
            });

        } catch (e) { reject(e.message); }
    });
}

// -------------------- HANDLERS --------------------
ipcMain.handle('printFromData', async (event, sale, opts) => {
    try { await printTicket(sale, opts); return { ok: true }; } 
    catch (err) { console.error(err); return { ok: false, error: String(err) }; }
});

ipcMain.handle('cacheLogo', async (event, url) => {
    try {
        const img = await processLogoForEscpos(url);
        if(img) { cachedLogoImage = img; return true; }
        return false;
    } catch (e) { console.error(e); return false; }
});

ipcMain.handle("listUsbDevices", async () => {
    try {
        const devices = escpos.USB.findPrinter();
        return devices.map(d => ({
            name: `USB Printer (VID:${d.deviceDescriptor.idVendor} PID:${d.deviceDescriptor.idProduct})`,
            vid: d.deviceDescriptor.idVendor,
            pid: d.deviceDescriptor.idProduct
        }));
    } catch(e) { return []; }
});

ipcMain.handle("listSystemPrinters", async () => []);
ipcMain.handle("detectScanners", async () => []);
ipcMain.handle("printRaw", async () => ({ ok: false }));
ipcMain.handle("discover-lan-printers", async () => ({ results: [] }));

// ---------------------------------------------------------
// 3. CONFIGURACIÓN VENTANA
// ---------------------------------------------------------
function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200, height: 800,
      icon: path.join(__dirname, 'build/icon.ico'), 
      webPreferences: { 
        preload: path.join(__dirname, 'preload.cjs'), 
        contextIsolation: true, 
        nodeIntegration: false 
      }
    });

    const isDev = !app.isPackaged; 

    if (isDev) {
        console.log('Modo Desarrollo');
        mainWindow.loadURL('http://localhost:5173'); // Asegúrate que sea http si no tienes https local
        mainWindow.webContents.openDevTools();
    } else {
        console.log('Modo Producción');
        mainWindow.loadURL('https://miposra.site'); 
        mainWindow.setMenuBarVisibility(false);
    }
}
app.whenReady().then(createWindow);
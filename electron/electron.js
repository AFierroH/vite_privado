import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import bwipjs from 'bwip-js';
import os from 'os'; // <--- IMPORTANTE PARA LA IP

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');
const Jimp = require('jimp');

// -------------------- HELPERS --------------------
function formatCLP(num) { return '$ ' + new Intl.NumberFormat('es-CL').format(num); }

// Función para obtener la IP local (LAN)
ipcMain.handle('getLocalIp', async () => {
    const nets = os.networkInterfaces();
    const results = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Saltamos direcciones internas (127.0.0.1) y no-IPv4
            if (net.family === 'IPv4' && !net.internal) {
                results.push({ name, ip: net.address });
            }
        }
    }
    // Retornamos la primera que parezca válida o todas
    return results.length > 0 ? results[0].ip : '127.0.0.1';
});

// NUEVO: Generador PDF417 "Anti-Garbage" (Redimensionado)
async function generatePdf417(data) {
    return new Promise((resolve, reject) => {
        if (!data) return resolve(null);
        
        // Limpiamos la data
        const cleanData = data.trim(); 
        console.log("--> Generando PDF417. Longitud:", cleanData.length);

        // 1. Generar Buffer con BWIP-JS
        bwipjs.toBuffer({
            bcid: 'pdf417',
            text: cleanData,
            scale: 2,           // Escala moderada
            height: 8,          // Altura no muy exagerada
            includetext: false,
            eclevel: 5,
            columns: 6          // Forzar columnas ayuda a la estabilidad
        }, function (err, pngBuffer) {
            if (err) {
                console.error("❌ Error BWIP-JS:", err);
                resolve(null);
            } else {
                // 2. PROCESAR CON JIMP (El secreto para que no salgan letras raras)
                Jimp.read(pngBuffer)
                    .then(image => {
                        // Redimensionamos a 256px de ancho (múltiplo de 8, seguro para 58mm y 80mm)
                        image.resize(256, Jimp.AUTO) 
                             .quality(100)
                             .greyscale(); // Asegurar blanco y negro

                        const tempPath = path.join(app.getPath('temp'), `pdf417_${Date.now()}.png`);
                        
                        image.writeAsync(tempPath)
                             .then(() => {
                                 // Cargar con escpos adapter
                                 escpos.Image.load(tempPath, function(escImg) {
                                     if(!escImg) {
                                         resolve(null);
                                     } else {
                                         // Borrar temporal
                                         try { fs.unlinkSync(tempPath); } catch(e){}
                                         resolve(escImg);
                                     }
                                 });
                             })
                             .catch(errJimp => {
                                 console.error("Error Jimp Write:", errJimp);
                                 resolve(null);
                             });
                    })
                    .catch(errJimp => {
                         console.error("Error Jimp Read:", errJimp);
                         resolve(null);
                    });
            }
        });
    });
}

// ... (El resto de processLogoForEscpos sigue igual) ...
let cachedLogoImage = null; // Variable global para logo

// -------------------- IMPRESIÓN --------------------
async function printTicket(sale, opts) {
    return new Promise(async (resolve, reject) => {
        let device, printer;
        
        try {
            if (opts.type === 'lan' && opts.ip) {
                // Intento de conexión con timeout manual si la librería no lo soporta bien
                console.log(`Conectando LAN: ${opts.ip}`);
                device = new escpos.Network(opts.ip, opts.port || 9100);
            } 
            else if (opts.type === 'usb') {
                if (opts.vid && opts.pid) {
                    device = new escpos.USB(opts.vid, opts.pid);
                } else {
                    device = new escpos.USB(); 
                }
            } else {
                return reject("Faltan datos de conexión");
            }

            // Generar PDF417
            let pdf417Img = null;
            if (opts.content417) {
                console.log("Generando imagen PDF417...");
                pdf417Img = await generatePdf417(opts.content417);
            }

            // Opciones de Printer
            const printerOpts = { encoding: 'CP858', width: opts.width || 48 }; // 48 caracteres para 80mm
            printer = new escpos.Printer(device, printerOpts);

            device.open(async function(err) {
                if (err) return reject("Error al abrir impresora: " + err);

                try {
                    printer.align('ct');
                    
                    // Logo (si existe)
                    if (cachedLogoImage) await printer.image(cachedLogoImage, 's8');

                    // Encabezado
                    printer.font('a').style('b').size(1, 1)
                           .text(sale.empresa.razonSocial || 'EMPRESA')
                           .size(0.5, 0.5).style('normal')
                           .text(`RUT: ${sale.empresa.rut || '-'}`)
                           .text(sale.empresa.direccion || '')
                           .feed(1);

                    // Datos Venta
                    printer.align('lt')
                           .text('-'.repeat(42))
                           .text(`BOLETA ELECTRONICA N: ${sale.venta.id_venta}`) 
                           .text(`FECHA:  ${sale.venta.fecha}`)
                           .text('-'.repeat(42));

                    // Detalles
                    printer.tableCustom([
                        { text: "CANT", align: "LEFT", width: 0.15 },
                        { text: "ITEM", align: "LEFT", width: 0.50 },
                        { text: "TOTAL", align: "RIGHT", width: 0.35 }
                    ]);

                    sale.detalles.forEach(d => {
                         printer.tableCustom([
                            { text: String(d.cantidad), align: "LEFT", width: 0.15 },
                            { text: d.nombre.substring(0, 20), align: "LEFT", width: 0.50 },
                            { text: formatCLP(d.subtotal), align: "RIGHT", width: 0.35 }
                        ]);
                    });

                    printer.text('-'.repeat(42));
                    
                    // Totales
                    const total = sale.total;
                    const neto = Math.round(total / 1.19);
                    const iva = total - neto;

                    printer.align('rt').style('normal')
                           .text(`Neto: ${formatCLP(neto)}`)
                           .text(`IVA: ${formatCLP(iva)}`)
                           .style('b').size(1, 1)
                           .text(`TOTAL: ${formatCLP(total)}`)
                           .size(0.5, 0.5).style('normal').feed(1);

                    // TIMBRE PDF417 (SOLUCIÓN BASURA)
                    if (pdf417Img) {
                        printer.align('ct');
                        // Usamos 's8' (bit image standard) porque raster a veces falla en red
                        // Como la imagen ya está redimensionada por Jimp, no debería romperse.
                        await printer.image(pdf417Img, 's8'); 
                        
                        printer.feed(1);
                        printer.text('Timbre Electronico SII');
                        printer.text('Verifique en www.sii.cl');
                    } else {
                        printer.text('(Sin Timbre - Error Gen)');
                    }

                    printer.feed(3);
                    printer.cut();
                    printer.close(); 
                    resolve({ ok: true });

                } catch (pError) {
                    // Importante cerrar el dispositivo si falla a medio camino
                    try { device.close(); } catch(e){}
                    reject(pError);
                }
            });

        } catch (e) { reject(e.message); }
    });
}

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
// CONFIGURACIÓN VENTANA
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

    // ... lógica de carga URL ...
    const isDev = !app.isPackaged; 
    if (isDev) mainWindow.loadURL('http://localhost:5173');
    else mainWindow.loadURL('https://miposra.site'); 
}
app.whenReady().then(createWindow);
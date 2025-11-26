import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import iconv from 'iconv-lite';
import bwipjs from 'bwip-js';
import { PNG } from 'pngjs';

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

// ANCHO DE PAPEL: Si tu impresora es de 80mm, usa 48 o 42.
// Si los precios se bajan de línea, reduce este número a 42.
const PRINTER_WIDTH = 48; 

// -------------------- HELPERS --------------------
function formatCLP(num) { return '$ ' + new Intl.NumberFormat('es-CL').format(num); }

async function processLogoForEscpos(urlOrPath) {
    return new Promise((resolve, reject) => {
        Jimp.read(urlOrPath)
            .then(image => {
                image.scaleToFit(150, 40).greyscale();
                const tempPath = path.join(process.env.TEMP || __dirname, 'temp_logo.png');
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

            // IMPORTANTE: Pasamos el ancho al driver
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
                           .text(`BOLETA: ${sale.venta.id_venta}`)
                           .text(`FECHA:  ${sale.venta.fecha}`)
                           .text('-'.repeat(PRINTER_WIDTH));

                    // C. DETALLES (CON TABLA AJUSTADA A LA DERECHA)
                    // Ajuste de anchos: 15% Cantidad, 50% Nombre, 35% Precio (Alineado derecha)
                    printer.tableCustom([
                        { text: "CANT", align: "LEFT", width: 0.15 },
                        { text: "DESCRIPCION", align: "LEFT", width: 0.50 },
                        { text: "TOTAL", align: "RIGHT", width: 0.35 }
                    ]);

                    sale.detalles.forEach(d => {
                         const totalStr = formatCLP(d.subtotal);
                         // Recortar nombre si es muy largo para que no rompa la tabla
                         const nombreCorto = d.nombre.substring(0, 22); 
                         
                         printer.tableCustom([
                            { text: String(d.cantidad), align: "LEFT", width: 0.15 },
                            { text: nombreCorto, align: "LEFT", width: 0.50 },
                            { text: totalStr, align: "RIGHT", width: 0.35 }
                        ]);
                    });

                    printer.text('-'.repeat(PRINTER_WIDTH));
                    
                    // D. TOTALES (NETO + IVA + TOTAL)
                    const total = sale.total;
                    const neto = Math.round(total / 1.19);
                    const iva = total - neto;

                    const totalFmt = formatCLP(total);
                    const netoFmt = formatCLP(neto);
                    const ivaFmt = formatCLP(iva);
                    
                    // Alineación derecha nativa
                    printer.align('rt') 
                           .style('normal')
                           .text(`Neto: ${netoFmt}`)
                           .text(`IVA (19%): ${ivaFmt}`)
                           .feed(1);

                    // TOTAL GRANDE
                    printer.align('rt')
                           .style('b').size(1, 1)
                           .text(`TOTAL: ${totalFmt}`)
                           .size(0.5, 0.5).style('normal')
                           .align('ct').feed(1);

                    // E. QR (TIMBRE)
                    const timbre = opts.content417 || `VENTA-${sale.venta.id_venta}`;
                    
                    try {
                        printer.qrimage(timbre, function(){
                             this.text('TIMBRE ELECTRONICO SII');
                             this.text('Verifique en www.sii.cl');
                             this.feed(2);
                             this.cut();
                             this.close(); 
                             resolve({ ok: true });
                        });
                    } catch(e) {
                        printer.cut().close();
                        resolve({ ok: true });
                    }

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
      icon: path.join(__dirname, 'build/icon.ico'), // Opcional: si tienes ícono
      webPreferences: { 
        preload: path.join(__dirname, 'preload.cjs'), 
        contextIsolation: true, 
        nodeIntegration: false 
      }
    });

    // LÓGICA DE URL
    const isDev = !app.isPackaged; // True si corres npm start, False si es .exe

    if (isDev) {
        console.log('Modo Desarrollo: Cargando localhost');
        mainWindow.loadURL('https://localhost:5173'); 
        mainWindow.webContents.openDevTools();
    } else {
        console.log('Modo Producción: Cargando Servidor VPS');
        // AQUÍ PONES TU IP PÚBLICA
        mainWindow.loadURL('https://miposra.site'); 
        
        // Opcional: Quitar menú superior en producción
        mainWindow.setMenuBarVisibility(false);
    }
}
app.whenReady().then(createWindow);
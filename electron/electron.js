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
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');
const Jimp = require('jimp');

// -------------------- HELPERS --------------------
function formatCLP(num) { return '$ ' + new Intl.NumberFormat('es-CL').format(num); }
ipcMain.handle('getLocalIp', async () => {
    // 1. OBTENER IP LOCAL Y SUBRED DE LA PC
    const nets = os.networkInterfaces();
    let localIp = null;
    let subnetBase = '';

    for (const name of Object.keys(nets)) {
        for (const netInterface of nets[name]) {
            // Buscamos IPv4 que no sea interna (no 127.0.0.1)
            if (netInterface.family === 'IPv4' && !netInterface.internal) {
                localIp = netInterface.address;
                // Asumimos una red clase C típica (192.168.1.x)
                // Quitamos el último octeto para tener la base
                const parts = localIp.split('.');
                parts.pop(); 
                subnetBase = parts.join('.'); // Ej: "192.168.1"
                break;
            }
        }
        if (localIp) break;
    }

    // Fallback absoluto si no hay red
    if (!localIp) return '127.0.0.1';

    console.log(`Escaneando red ${subnetBase}.x en busca de impresora (Puerto 9100)...`);

    // 2. FUNCIÓN PARA VERIFICAR UN IP ESPECÍFICO
    const checkPrinterPort = (ip) => {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(200); // Timeout corto (200ms) para que el escaneo sea rápido
            
            socket.on('connect', () => {
                socket.destroy();
                resolve(ip); // ¡Encontrado!
            });
            
            socket.on('timeout', () => { socket.destroy(); resolve(null); });
            socket.on('error', () => { socket.destroy(); resolve(null); });
            
            socket.connect(9100, ip);
        });
    };

    // 3. GENERAR PROMESAS PARA TODA LA SUBRED (1 al 254)
    const promises = [];
    for (let i = 1; i < 255; i++) {
        const targetIp = `${subnetBase}.${i}`;
        // No nos escaneamos a nosotros mismos (opcional, pero ahorra un check)
        if (targetIp !== localIp) {
            promises.push(checkPrinterPort(targetIp));
        }
    }

    try {
        // Ejecutamos todos los chequeos en paralelo
        const results = await Promise.all(promises);
        
        // Filtramos los nulos y nos quedamos con la primera IP que respondió
        const foundIp = results.find(ip => ip !== null);

        if (foundIp) {
            console.log(`IMPRESORA DETECTADA EN: ${foundIp}`);
            return foundIp; // Retorna la IP de la impresora encontrada
        }
    } catch (e) {
        console.error("Error en escaneo de red:", e);
    }

    console.log(`No se detectó impresora. Retornando IP Local: ${localIp}`);
    // 4. FALLBACK: Si no encuentra impresora, devuelve tu IP local 
    // (para que al menos el usuario tenga la base 192.168.x.x rellena)
    return localIp;
});

// -------------------- GENERADOR PDF417 CON LOGS --------------------
async function generatePdf417(data) {
    console.log("[1] Iniciando generatePdf417 (Modo: Grande y Alto)...");
    return new Promise((resolve, reject) => {
        if (!data) return resolve(null);
        const cleanData = data.trim(); 
        
        // --- CONFIGURACIÓN MATEMÁTICA ---
        const options = {
            bcid: 'pdf417',
            text: cleanData,
            eclevel: 5,        // Nivel SII
            
            // EL TRUCO DEL ALTO:
            // 'rowheight' define qué tan alta es cada fila de datos respecto al ancho de un punto.
            // Estándar = 3. Nosotros pondremos 10 para que sea >3 veces más alto.
            rowheight: 10,     
            
            scale: 4,          // Subimos escala para máxima nitidez al redimensionar
            includetext: false,
            padding: 0
        };
        // -------------------------------

        console.log("[2] Generando buffer BWIP-JS...");
        bwipjs.toBuffer(options, function (err, pngBuffer) {
            if (err) {
                console.error("[ERROR BWIP-JS]:", err);
                resolve(null);
            } else {
                Jimp.read(pngBuffer)
                    .then(image => {
                        // Margen blanco (Quiet Zone)
                        const quietZone = 40; // Más margen para que se vea centrado y prolijo
                        const widthConBorde = image.bitmap.width + (quietZone * 2);
                        const heightConBorde = image.bitmap.height + (quietZone * 2);

                        new Jimp(widthConBorde, heightConBorde, 0xFFFFFFFF, (err, bg) => {
                            if(err) return resolve(null);

                            bg.composite(image, quietZone, quietZone);
                            
                            // EL TRUCO DEL ANCHO:
                            // 480px es aprox el 85% del ancho de un papel de 80mm.
                            // Es grande, legible y seguro para el buffer.
                            console.log("[3] Redimensionando a 480px (Ancho seguro 80mm)...");
                            bg.resize(480, Jimp.AUTO); 
                            
                            // Filtros para definición extrema
                            bg.greyscale().contrast(1).posterize(2); 

                            const tempPath = path.join(app.getPath('temp'), `pdf417_${Date.now()}.png`);
                            
                            bg.writeAsync(tempPath).then(() => {
                                escpos.Image.load(tempPath, function(escImg) {
                                    if(!escImg) { resolve(null); } 
                                    else {
                                        try { fs.unlinkSync(tempPath); } catch(e){}
                                        resolve(escImg);
                                    }
                                });
                            });
                        });
                    })
                    .catch(e => { console.error("Jimp Error:", e); resolve(null); });
            }
        });
    });
}

let cachedLogoImage = null;
ipcMain.handle('cacheLogo', async (event, url) => { return true; });

// -------------------- PRINT TICKET --------------------
async function printTicket(sale, opts) {
    console.log("[PRINT START] Iniciando proceso de impresión...");
    return new Promise(async (resolve, reject) => {
        let device, printer;
        
        try {
            if (opts.type === 'lan' && opts.ip) {
                console.log(`Conectando LAN: ${opts.ip}`);
                device = new escpos.Network(opts.ip, opts.port || 9100);
            } 
            else if (opts.type === 'usb') {
                if (opts.vid && opts.pid) {
                    console.log(`Conectando USB: ${opts.vid}:${opts.pid}`);
                    device = new escpos.USB(opts.vid, opts.pid);
                } else {
                    console.log(`Conectando USB (Auto)`);
                    device = new escpos.USB(); 
                }
            } else {
                return reject("Faltan datos de conexión");
            }

            // GENERAR PDF417
            let pdf417Img = null;
            if (opts.content417) {
                console.log("Detectado contenido para PDF417. Procesando...");
                try {
                    pdf417Img = await generatePdf417(opts.content417);
                } catch (e) { 
                    console.error("Excepción fatal en generatePdf417:", e); 
                }
            } else {
                console.warn("No se recibió 'content417' en las opciones.");
            }

            const options = { encoding: 'CP858', width: 48 };
            printer = new escpos.Printer(device, options);

            device.open(async function(err) {
                if (err) {
                    console.error("Error abriendo dispositivo:", err);
                    try{ device.close() }catch(e){} 
                    return reject("Error impresora: " + err);
                }
                console.log("Dispositivo abierto. Enviando comandos...");

                try {
                    // ... (HEADER Y DETALLES IGUAL QUE ANTES) ...
                    printer.align('ct')
                           .font('a').style('b').size(1, 1)
                           .text(sale.empresa.razonSocial || 'EMPRESA')
                           .size(0.5, 0.5).style('normal')
                           .text(`RUT: ${sale.empresa.rut || '-'}`)
                           .text(sale.empresa.direccion || 'Temuco')
                           .feed(1);

                    printer.align('lt')
                           .text('------------------------------------------')
                           .text(`BOLETA ELECTRONICA N: ${sale.venta.id_venta}`) 
                           .text(`FECHA:  ${sale.venta.fecha}`)
                           .text('------------------------------------------');

                    printer.tableCustom([
                        { text: "CANT", align: "LEFT", width: 0.15 },
                        { text: "ITEM", align: "LEFT", width: 0.50 },
                        { text: "TOTAL", align: "RIGHT", width: 0.35 }
                    ]);

                    sale.detalles.forEach(d => {
                        const nombreSafe = (d.nombre || '').substring(0, 25);
                        printer.tableCustom([
                            { text: String(d.cantidad), align: "LEFT", width: 0.15 },
                            { text: nombreSafe, align: "LEFT", width: 0.50 },
                            { text: formatCLP(d.subtotal), align: "RIGHT", width: 0.35 }
                        ]);
                    });

                    printer.text('------------------------------------------');
                    const total = sale.total;
                    const neto = Math.round(total / 1.19);
                    const iva = total - neto;

                    printer.align('rt')
                           .text(`Neto: ${formatCLP(neto)}`)
                           .text(`IVA: ${formatCLP(iva)}`)
                           .style('b').size(1, 1)
                           .text(`TOTAL: ${formatCLP(total)}`)
                           .style('normal').size(0.5, 0.5)
                           .feed(1);

                    // --- PARTE DEL TIMBRE ---
                    if (pdf417Img) {
                        console.log("Imprimiendo RASTER PDF417...");
                        printer.align('ct');
                        await printer.raster(pdf417Img, 'normal'); 
                        printer.text('Timbre Electronico SII');
                        printer.text('Verifique en www.sii.cl');
                    } else {
                        console.error("PDF417 es NULL al momento de imprimir.");
                        printer.feed(1);
                        printer.text('--------------------------------');
                        printer.text('(Sin Timbre - Fallo Generacion)');
                    }

                    printer.feed(3);
                    printer.cut();
                    
                    setTimeout(() => {
                        printer.close();
                        console.log("Impresión finalizada.");
                        resolve({ ok: true });
                    }, 500);

                } catch (pError) {
                    console.error("Error durante impresión:", pError);
                    try { device.close(); } catch(e){}
                    reject(pError);
                }
            });

        } catch (e) { 
            console.error("Error Try/Catch Principal:", e);
            reject(e.message); 
        }
    });
}
// ... (RESTO DE IPC HANDLERS IGUAL) ...
ipcMain.handle('printFromData', async (event, sale, opts) => {
    try { await printTicket(sale, opts); return { ok: true }; } 
    catch (err) { console.error(err); return { ok: false, error: String(err) }; }
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
// ...
// ... WINDOW CONFIG IGUAL ...
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
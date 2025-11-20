import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

// Importaciones de Hardware
const require = createRequire(import.meta.url);
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');
const Jimp = require('jimp');

// Configurar path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Variables Globales
let mainWindow = null;
let cachedLogoImage = null; // Guardaremos la instancia de imagen cargada

// ---------------------------------------------------------
// 1. FUNCIÓN PRINCIPAL DE IMPRESIÓN
// ---------------------------------------------------------
async function printTicket(sale, options) {
    return new Promise(async (resolve, reject) => {
        let device;
        
        try {
            // --- SELECCIÓN DE DISPOSITIVO ---
            if (options.type === 'lan' && options.ip) {
                console.log(`Conectando a RED: ${options.ip}:${options.port || 9100}`);
                device = new escpos.Network(options.ip, options.port || 9100);
            } 
            else if (options.type === 'usb') {
                if (options.vid && options.pid) {
                    console.log(`Conectando a USB Específico: VID ${options.vid} PID ${options.pid}`);
                    device = new escpos.USB(options.vid, options.pid);
                } else {
                    console.log(`Auto-detectando primer USB...`);
                    device = new escpos.USB(); // Auto-detectar
                }
            } else {
                return reject("Tipo de conexión no válido");
            }

            // --- CONFIGURAR IMPRESORA ---
            const printer = new escpos.Printer(device, { encoding: "CP858" }); // CP858 o CP1252 para acentos

            device.open(async function(err) {
                if (err) {
                    return reject("No se pudo abrir la impresora. ¿Está conectada? Error: " + err);
                }

                try {
                    // 1. INICIO
                    printer
                        .font('a')
                        .align('ct')
                        .style('b'); // Negrita

                    // 2. LOGO (Si existe en caché)
                    if (cachedLogoImage) {
                        await printer.image(cachedLogoImage, 's8'); // s8 = densidad estándar
                    }

                    // 3. ENCABEZADO
                    printer
                        .size(1, 1)
                        .text(sale.empresa.razonSocial || 'EMPRESA')
                        .style('normal') // Quitar negrita
                        .size(0.5, 0.5) // Tamaño normal
                        .text(`RUT: ${sale.empresa.rut || ''}`)
                        .text(sale.empresa.direccion || '')
                        .feed(1);

                    printer
                        .align('lt')
                        .text('------------------------------------------')
                        .text(`BOLETA: ${sale.venta.id_venta}`)
                        .text(`FECHA:  ${sale.venta.fecha}`)
                        .text('------------------------------------------');

                    // 4. DETALLES
                    // Cabecera de tabla manual simple
                    printer.tableCustom([
                        { text: "CANT", align: "LEFT", width: 0.15 },
                        { text: "DESCRIPCION", align: "LEFT", width: 0.55 },
                        { text: "TOTAL", align: "RIGHT", width: 0.30 }
                    ]);
                    
                    sale.detalles.forEach(d => {
                         // Formatear precio
                         const totalStr = new Intl.NumberFormat('es-CL').format(d.subtotal);
                         printer.tableCustom([
                            { text: String(d.cantidad), align: "LEFT", width: 0.15 },
                            { text: d.nombre.substring(0, 20), align: "LEFT", width: 0.55 },
                            { text: totalStr, align: "RIGHT", width: 0.30 }
                        ]);
                    });

                    printer.text('------------------------------------------');

                    // 5. TOTALES
// ------------------------------------------------
                    // 5. TOTALES (Neto, IVA y Total)
                    // ------------------------------------------------
                    const total = sale.total;
                    const neto = Math.round(total / 1.19);
                    const iva = total - neto;

                    const totalFmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(total);
                    const netoFmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(neto);
                    const ivaFmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(iva);
                    
                    printer
                        .align('rt') // Alinear derecha
                        .style('normal')
                        .text(`Neto: ${netoFmt}`)
                        .text(`IVA (19%): ${ivaFmt}`)
                        .feed(1); // Un pequeño espacio

                    // EL TOTAL GRANDE
                    printer
                        .style('b') // Negrita
                        .size(1, 1) // Doble tamaño
                        .text(`TOTAL: ${totalFmt}`)
                        .size(0.5, 0.5) // Volver a tamaño normal
                        .style('normal')
                        .align('ct') // Volver al centro para lo que sigue (QR)
                        .feed(1);
                    // 6. PDF417 (Usando QR como alternativa nativa fácil, o código de barras)
                    // La librería escpos soporta QR nativo, PDF417 nativo depende del modelo.
                    // Usaremos QR por compatibilidad, o barcode si prefieres.
                    const timbre = options.content417 || `VENTA-${sale.venta.id_venta}`;
                    
                    // Opción A: Intentar imprimir QR nativo (muy compatible)
                    try {
                        printer.qrimage(timbre, function(err){
                             finalizarTicket(this);
                        });
                    } catch(e) {
                        // Si falla QR, finalizar directo
                        finalizarTicket(printer);
                    }

                    // Función para cerrar (callback del QR)
                    function finalizarTicket(p) {
                        p.text('TIMBRE ELECTRONICO SII')
                         .text('Verifique en www.sii.cl')
                         .feed(2)
                         .cut()
                         .close(); // IMPORTANTE: Cerrar conexión para liberar USB
                        resolve({ ok: true });
                    }

                } catch (printError) {
                    device.close();
                    reject(printError);
                }
            });

        } catch (e) {
            reject(e.message);
        }
    });
}


// ---------------------------------------------------------
// 2. HANDLERS IPC (COMUNICACIÓN CON VUE)
// ---------------------------------------------------------

// A. IMPRIMIR
ipcMain.handle('printFromData', async (event, sale, opts) => {
    try {
        await printTicket(sale, opts);
        return { ok: true };
    } catch (error) {
        console.error("Error imprimiendo:", error);
        return { ok: false, error: String(error) };
    }
});

// B. CACHEAR LOGO (Cargar imagen con escpos.Image)
ipcMain.handle('cacheLogo', async (event, url) => {
    try {
        console.log('Cargando logo para escpos:', url);
        // Descargar imagen temporalmente
        const jimpImg = await Jimp.read(url);
        jimpImg.scaleToFit(150, 40) 
               .greyscale(); 
        
        const buffer = await jimpImg.getBufferAsync(Jimp.MIME_PNG);
        
        const tempPath = path.join(process.env.TEMP || __dirname, 'logo_temp.png');
        fs.writeFileSync(tempPath, buffer);

        // Cargar con la clase de escpos
        escpos.Image.load(tempPath, function(image){
            cachedLogoImage = image;
            console.log('Logo cargado en memoria escpos');
        });
        return true;
    } catch (e) {
        console.error("Error logo:", e);
        return false;
    }
});

// C. LISTAR USB (Para tu Select en Ventas.vue)
ipcMain.handle("listUsbDevices", async () => {
    try {
        // Usamos escpos.USB.findPrinter() si disponible, o usb nativo
        // escpos-usb tiene un método findPrinter()
        const devices = escpos.USB.findPrinter(); 
        // Esto devuelve un array de objetos device
        return devices.map(d => ({
            name: `USB Printer (VID:${d.deviceDescriptor.idVendor} PID:${d.deviceDescriptor.idProduct})`,
            vid: d.deviceDescriptor.idVendor,
            pid: d.deviceDescriptor.idProduct
        }));
    } catch(e) {
        console.error(e);
        return [];
    }
});


// D. EXTRAS DUMMY
ipcMain.handle("listSystemPrinters", async () => []);
ipcMain.handle("detectScanners", async () => []);
ipcMain.handle("printRaw", async () => { return { ok: false } });
ipcMain.handle("discover-lan-printers", async () => { return { results: [] } });


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
        mainWindow.loadURL('http://localhost:5173'); 
        mainWindow.webContents.openDevTools();
    } else {
        console.log('Modo Producción: Cargando Servidor VPS');
        // AQUÍ PONES TU IP PÚBLICA
        mainWindow.loadURL('http://147.182.245.46'); 
        
        // Opcional: Quitar menú superior en producción
        mainWindow.setMenuBarVisibility(false);
    }
}
app.whenReady().then(createWindow);
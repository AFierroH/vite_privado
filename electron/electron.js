import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import iconv from 'iconv-lite';
import bwipjs from 'bwip-js';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. IMPORTAR SUITE ESCPOS
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');

// Importar 'usb' para listar dispositivos manualmente en el frontend
const usbManager = require('usb'); 

const Jimp = require('jimp');

// -------------------- CONFIGURACIÓN --------------------
let mainWindow = null;
let cachedLogoBuffer = null; 
const DEFAULT_CODEPAGE = 'cp1252'; 
const PRINTER_WIDTH = 42; 

const CMD = {
  INIT: Buffer.from([0x1B, 0x40]),
  ALIGN_CENTER: Buffer.from([0x1B, 0x61, 0x01]),
  ALIGN_LEFT: Buffer.from([0x1B, 0x61, 0x00]),
  ALIGN_RIGHT: Buffer.from([0x1B, 0x61, 0x02]),
  BOLD_ON: Buffer.from([0x1B, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([0x1B, 0x45, 0x00]),
  CUT: Buffer.from([0x1D, 0x56, 0x42, 0x00]),
  LF: Buffer.from([0x0A]),
};

// -------------------- HELPERS GENERACIÓN BYTES --------------------
function encode(text) { return iconv.encode(text || '', DEFAULT_CODEPAGE); }
function formatCLP(num) { return '$ ' + new Intl.NumberFormat('es-CL').format(num); }

function twoColumns(left, right, width = PRINTER_WIDTH) {
  const l = String(left); const r = String(right);
  const space = width - l.length - r.length;
  if (space < 1) return l.substring(0, width - r.length - 1) + ' ' + r;
  return l + ' '.repeat(space) + r;
}

function imageToRaster(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  const width = png.width; const height = png.height;
  const widthBytes = Math.ceil(width / 8);
  const buffer = [0x1D, 0x76, 0x30, 0x00, widthBytes % 256, Math.floor(widthBytes / 256), height % 256, Math.floor(height / 256)];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < widthBytes; x++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const px = (x * 8) + bit;
        if (px < width) {
          const idx = (width * y + px) << 2;
          const alpha = png.data[idx + 3];
          const lum = 0.2126 * png.data[idx] + 0.7152 * png.data[idx + 1] + 0.0722 * png.data[idx + 2];
          if (alpha > 128 && lum < 128) byte |= (1 << (7 - bit));
        }
      }
      buffer.push(byte);
    }
  }
  return Buffer.from(buffer);
}

async function processLogoForThermal(urlOrPath) {
  try {
    const image = await Jimp.read(urlOrPath);
    image.resize(380, Jimp.AUTO).greyscale().contrast(1).posterize(2);
    return imageToRaster(await image.getBufferAsync(Jimp.MIME_PNG));
  } catch (err) { return null; }
}

// -------------------- CONSTRUCTOR DEL TICKET --------------------
async function buildTicketBuffer(data, opts = {}) {
  const { empresa, venta, detalles, total } = data;
  const buffers = [CMD.INIT, CMD.ALIGN_CENTER];
  
  if (cachedLogoBuffer) buffers.push(cachedLogoBuffer);
  else if (empresa?.logo_url) {
      const r = await processLogoForThermal(empresa.logo_url);
      if (r) { cachedLogoBuffer = r; buffers.push(r); }
  }

  buffers.push(CMD.BOLD_ON, encode(`${empresa.razonSocial || 'EMPRESA'}\n`), CMD.BOLD_OFF);
  buffers.push(encode(`RUT: ${empresa.rut || '-'}\n`));
  buffers.push(encode(`${empresa.direccion || ''}\n`));
  buffers.push(CMD.LF);
  
  buffers.push(CMD.ALIGN_LEFT);
  buffers.push(encode(`BOLETA N° ${venta.id_venta}\nFecha: ${venta.fecha}\n`));
  buffers.push(encode("-".repeat(PRINTER_WIDTH) + "\n"));

  detalles.forEach(d => {
    buffers.push(encode(`${d.cantidad} x ${formatCLP(d.precio_unitario)}\n`));
    buffers.push(encode(twoColumns(d.nombre, formatCLP(d.subtotal)) + "\n"));
  });

  buffers.push(encode("-".repeat(PRINTER_WIDTH) + "\n"));
  buffers.push(CMD.ALIGN_RIGHT);
  buffers.push(CMD.BOLD_ON);
  buffers.push(Buffer.from([0x1D, 0x21, 0x01])); 
  buffers.push(encode(`TOTAL: ${formatCLP(total)}\n`));
  buffers.push(Buffer.from([0x1D, 0x21, 0x00])); 
  buffers.push(CMD.BOLD_OFF);

  buffers.push(CMD.ALIGN_CENTER);
  buffers.push(CMD.LF);

  try {
    const content417 = opts.content417 || `VENTA-${venta.id_venta}`;
    const pdf417Png = await bwipjs.toBuffer({ bcid: 'pdf417', text: content417, scale: 2, height: 10, includetext: false, padding: 10, backgroundcolor: 'ffffff' });
    buffers.push(imageToRaster(pdf417Png));
  } catch (e) {}

  buffers.push(CMD.LF, encode("TIMBRE ELECTRONICO SII\nVerifique en www.sii.cl\n"));
  buffers.push(CMD.LF, CMD.LF, CMD.CUT);

  return Buffer.concat(buffers);
}


// -------------------- HANDLERS PRINCIPALES --------------------

// 1. LISTAR DISPOSITIVOS USB (Para llenar el Select del Frontend)
ipcMain.handle("listUsbDevices", async () => {
    try {
        // usbManager.getDeviceList() nos da todo lo conectado
        const list = usbManager.getDeviceList();
        
        // Filtramos y mapeamos para que el frontend tenga VIDs y PIDs
        return list.map(d => ({
            name: `USB Device (VID: ${d.deviceDescriptor.idVendor} - PID: ${d.deviceDescriptor.idProduct})`,
            vid: d.deviceDescriptor.idVendor, 
            pid: d.deviceDescriptor.idProduct,
            // Información extra si está disponible (a veces en Windows es limitado leer strings)
            bus: d.busNumber,
            address: d.deviceAddress
        }));
    } catch(e) { 
        console.error("Error listando USB:", e);
        return []; 
    }
});

// 2. IMPRIMIR (Usando escpos, escpos-usb, escpos-network)
ipcMain.handle('printFromData', async (event, sale, opts = {}) => {
  console.log(`🖨️ Solicitud impresión. Tipo: ${opts.type}`);
  
  // Construimos el buffer binario manual (texto + imagenes)
  const buffer = await buildTicketBuffer(sale, opts);

  return new Promise((resolve, reject) => {
      let device, printer;

      try {
          // --- CASO A: RED (LAN) ---
          if (opts.type === 'lan' && opts.ip) {
              console.log(`Conectando a LAN: ${opts.ip}:${opts.port}`);
              device = new escpos.Network(opts.ip, opts.port || 9100);
          } 
          // --- CASO B: USB (libusbK) ---
          else if (opts.type === 'usb') {
              // Si el usuario seleccionó un dispositivo específico en el frontend, usamos ese VID/PID
              // opts.printerInfo.vid y pid deben venir del frontend
              if (opts.vid && opts.pid) {
                  console.log(`Conectando a USB Específico: VID ${opts.vid} PID ${opts.pid}`);
                  // Hexadecimal o Decimal, escpos-usb intenta manejarlo, pero mejor pasarlo tal cual
                  device = new escpos.USB(opts.vid, opts.pid);
              } else {
                  console.log("Buscando primer dispositivo USB disponible...");
                  device = new escpos.USB(); // Auto-detectar el primero
              }
          } 
          else {
              return reject("Tipo de impresora no soportado o falta IP/USB info");
          }

          printer = new escpos.Printer(device);

          device.open((err) => {
              if (err) {
                  console.error("Error abriendo dispositivo:", err);
                  return resolve({ ok: false, error: "No se pudo abrir la impresora. " + err.message });
              }

              // Enviar el buffer RAW construido manualmente
              // .raw() es el método para enviar bytes directos sin que la librería intente formatear
              printer
                  .raw(buffer)
                  .close(); // Importante cerrar para liberar el recurso libusbK
              
              resolve({ ok: true });
          });

      } catch (error) {
          console.error("Excepción crítica impresión:", error);
          resolve({ ok: false, error: error.message });
      }
  });
});

ipcMain.handle('cacheLogo', async (event, url) => {
    const raster = await processLogoForThermal(url);
    if (raster) { cachedLogoBuffer = raster; return true; }
    return false;
});

// Handlers dummy para que no rompa el frontend si llama a otros métodos
ipcMain.handle("listSystemPrinters", async () => { return [] });
ipcMain.handle("detectScanners", async () => { return [] }); 
ipcMain.handle("printRaw", async () => { return { ok: false } });
ipcMain.handle("discover-lan-printers", async () => { return { results: [] } });

function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200, height: 800,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
    });
    const isDev = !app.isPackaged; 
    if (isDev) { mainWindow.loadURL('http://147.182.245.46'); mainWindow.webContents.openDevTools(); }
    else { mainWindow.loadFile(path.join(__dirname, '../web/dist/index.html')); }
}
app.whenReady().then(createWindow);
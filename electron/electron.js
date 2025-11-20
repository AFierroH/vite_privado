import { app, BrowserWindow, ipcMain } from 'electron';
import net from 'net';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import fsExtra from 'fs-extra';
import iconv from 'iconv-lite';
import bwipjs from 'bwip-js';
import { PNG } from 'pngjs'; 

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const Jimp = require('jimp');

let escpos, escposUsb, usb;
try {
    escpos = require('escpos');
    escposUsb = require('escpos-usb');
    usb = require('usb');
} catch (e) { console.warn('Módulos nativos USB/EscPos no encontrados, modo simulación activado.'); }


let mainWindow = null;
let cachedLogoBuffer = null; 

const DEFAULT_CODEPAGE = 'cp1252'; 
const PRINTER_WIDTH = 42; // Ajustar a 48 o 32 según la impresora

const CMD = {
  INIT: Buffer.from([0x1B, 0x40]),
  ALIGN_LEFT: Buffer.from([0x1B, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([0x1B, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([0x1B, 0x61, 0x02]),
  BOLD_ON: Buffer.from([0x1B, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([0x1B, 0x45, 0x00]),
  CUT: Buffer.from([0x1D, 0x56, 0x42, 0x00]),
  LF: Buffer.from([0x0A]),
};

function encode(text) {
  return iconv.encode(text || '', DEFAULT_CODEPAGE);
}

function formatCLP(num) {
  return '$ ' + new Intl.NumberFormat('es-CL').format(num);
}

function twoColumns(left, right, width = PRINTER_WIDTH) {
  const l = String(left);
  const r = String(right);
  const space = width - l.length - r.length;
  if (space < 1) {
    const available = width - r.length - 1;
    return l.substring(0, available) + ' ' + r;
  }
  return l + ' '.repeat(space) + r;
}

function imageToRaster(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  const width = png.width;
  const height = png.height;
  const widthBytes = Math.ceil(width / 8);
  
  const buffer = [];

  buffer.push(0x1D, 0x76, 0x30, 0x00);
  buffer.push(widthBytes % 256, Math.floor(widthBytes / 256));
  buffer.push(height % 256, Math.floor(height / 256));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < widthBytes; x++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const px = (x * 8) + bit;
        if (px < width) {
          const idx = (width * y + px) << 2;

          const alpha = png.data[idx + 3];
          const r = png.data[idx];
          const g = png.data[idx + 1];
          const b = png.data[idx + 2];
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (alpha > 128 && lum < 128) {
            byte |= (1 << (7 - bit));
          }
        }
      }
      buffer.push(byte);
    }
  }
  return Buffer.from(buffer);
}

async function processLogoForThermal(urlOrPath) {
  try {
    console.log('Procesando logo:', urlOrPath);
    const image = await Jimp.read(urlOrPath);
    
    // Redimensionar a 380px para que quepa en papel de 80mm
    image.resize(380, Jimp.AUTO);

    image.greyscale().contrast(1).posterize(2);

    const processedBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
    return imageToRaster(processedBuffer); 
  } catch (err) {
    console.error('Error procesando logo:', err);
    return null;
  }
}

async function buildTicketBuffer(data, opts = {}) {
  const { empresa, venta, detalles, total } = data;
  const buffers = [];

  // 1. Iniciar
  buffers.push(CMD.INIT);
  buffers.push(CMD.ALIGN_CENTER);

  // 2. Logo (Prioridad: Caché RAM > URL en data)
  if (cachedLogoBuffer) {
      buffers.push(cachedLogoBuffer);
  } else if (empresa?.logo_url) {
      const tempRaster = await processLogoForThermal(empresa.logo_url);
      if (tempRaster) {
          cachedLogoBuffer = tempRaster; 
          buffers.push(tempRaster);
      }
  }

  // 3. Datos Empresa
  buffers.push(CMD.BOLD_ON);
  buffers.push(encode(`${empresa.razonSocial || 'EMPRESA'}\n`));
  buffers.push(CMD.BOLD_OFF);
  buffers.push(encode(`RUT: ${empresa.rut || '-'}\n`));
  buffers.push(encode(`${empresa.direccion || ''}\n`));
  buffers.push(encode(`Tel: ${empresa.telefono || ''}\n`));
  
  buffers.push(CMD.LF);
  buffers.push(encode(`BOLETA ELECTRONICA N° ${venta.id_venta}\n`));
  buffers.push(encode(`Fecha: ${venta.fecha}\n`));
  
  buffers.push(CMD.ALIGN_LEFT);
  buffers.push(encode("-".repeat(PRINTER_WIDTH) + "\n"));
  buffers.push(encode(twoColumns("CANT DETALLE", "TOTAL") + "\n"));
  buffers.push(encode("-".repeat(PRINTER_WIDTH) + "\n"));

  // 4. Detalles
  detalles.forEach(d => {
    buffers.push(encode(`${d.cantidad} x ${formatCLP(d.precio_unitario)}\n`));
    buffers.push(encode(twoColumns(d.nombre, formatCLP(d.subtotal)) + "\n"));
  });

  buffers.push(encode("-".repeat(PRINTER_WIDTH) + "\n"));

  // 5. Totales
  const neto = Math.round(total / 1.19);
  const iva = total - neto;

  buffers.push(CMD.ALIGN_RIGHT);
  buffers.push(encode(`Neto: ${formatCLP(neto)}\n`));
  buffers.push(encode(`IVA (19%): ${formatCLP(iva)}\n`));
  
  buffers.push(CMD.BOLD_ON);
  buffers.push(Buffer.from([0x1D, 0x21, 0x01])); // Doble altura
  buffers.push(encode(`TOTAL: ${formatCLP(total)}\n`));
  buffers.push(Buffer.from([0x1D, 0x21, 0x00])); // Reset
  buffers.push(CMD.BOLD_OFF);

  buffers.push(CMD.ALIGN_CENTER);
  buffers.push(CMD.LF);

  // 6. PDF417 (Timbre)
  try {
    const content417 = opts.content417 || `VENTA-${venta.id_venta}`;
    const pdf417Png = await bwipjs.toBuffer({
      bcid: 'pdf417', text: content417, scale: 2, height: 10, includetext: false, padding: 10, backgroundcolor: 'ffffff'
    });
    buffers.push(imageToRaster(pdf417Png));
  } catch (err) {
    console.error("Error generando PDF417:", err);
  }

  buffers.push(CMD.LF);
  buffers.push(CMD.BOLD_ON);
  buffers.push(encode("TIMBRE ELECTRONICO SII\n"));
  buffers.push(CMD.BOLD_OFF);
  buffers.push(encode("Res. NRO.80 de 22-08-2014\n"));
  buffers.push(encode("Verifique documento en www.sii.cl\n"));
  buffers.push(CMD.LF);
  buffers.push(encode("GRACIAS POR SU COMPRA\n"));
  buffers.push(CMD.LF);
  buffers.push(CMD.LF);
  buffers.push(CMD.CUT);

  return Buffer.concat(buffers);
}

async function sendToLan(ip, port, buffer) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.connect(port, ip, () => {
      socket.write(buffer, () => {
        socket.end();
        resolve({ ok: true });
      });
    });
    socket.on('error', (err) => reject(err));
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Timeout impresosa LAN')); });
  });
}

async function sendToUsb(buffer) {
  if (!escpos || !escposUsb) throw new Error("Librerías USB no instaladas");
  try {
    escpos.USB = escposUsb;
    const device = new escpos.USB();
    const printer = new escpos.Printer(device);
    return new Promise((resolve, reject) => {
        device.open((err) => {
            if(err) return reject(err);
            printer.raw(buffer).close();
            resolve(true);
        });
    });
  } catch(e) { throw new Error("Error USB: " + e.message); }
}

ipcMain.handle('printFromData', async (event, sale, opts = {}) => {
  try {
    console.log("Iniciando impresión...");
    const buffer = await buildTicketBuffer(sale, opts);

    if (opts.type === 'lan' && opts.ip) {
      await sendToLan(opts.ip, opts.port || 9100, buffer);
    } else {
      await sendToUsb(buffer);
    }
    return { ok: true };
  } catch (err) {
    console.error("Error printing:", err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('cacheLogo', async (event, url) => {
    console.log('Cacheando logo:', url);
    const raster = await processLogoForThermal(url);
    if (raster) {
        cachedLogoBuffer = raster;
        return true;
    }
    return false;
});

ipcMain.handle("listSystemPrinters", async () => {
    return []; 
});

ipcMain.handle("listUsbDevices", async () => {
    try {
        if(escposUsb) {
            if(usb) return usb.getDeviceList().map(d => ({ name: `USB Device ${d.deviceDescriptor.idProduct}` }));
        }
        return [];
    } catch(e) { return [] }
});

ipcMain.handle("detectScanners", async () => {
    try {
        if(usb) return usb.getDeviceList().map(d => ({ product: `Device ${d.deviceDescriptor.idProduct}` }));
        return [];
    } catch(e) { return [] }
});

ipcMain.handle("printRaw", async () => { return { ok: false, error: "Use printFromData instead" } });
ipcMain.handle("discover-lan-printers", async () => { return { results: [] } });

function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200, height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    const isDev = !app.isPackaged; 
    if (isDev) {
        mainWindow.loadURL('http://147.182.245.46'); 
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../web/dist/index.html'));
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import pkg from 'pdf-to-printer'
const { getPrinters } = pkg
import usb from 'usb'
import net from 'net'
import { createRequire } from 'module' 
import os from 'os'
import arp from 'node-arp'

const require = createRequire(import.meta.url)

const { PosPrinter, PosPrintData, PosPrintOptions } = require('electron-pos-printer');
const escpos = require('escpos'); 

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // carga frontend o URL del backend remoto
  const devUrl = 'http://147.182.245.46'
  mainWindow.loadURL(devUrl)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})


ipcMain.handle('listSystemPrinters', async () => {
  try {
    const list = await getPrinters()
    return list.map(p => p.name)
  } catch (err) {
    console.error('Error listSystemPrinters:', err)
    return []
  }
})

/* ---------------------------------------------------
Listar dispositivos USB conectados
--------------------------------------------------- */
ipcMain.handle('listUsbDevices', async () => {
  try {
    const devices = usb.getDeviceList().map(d => ({
      vendorId: d.deviceDescriptor.idVendor,
      productId: d.deviceDescriptor.idProduct
    }))
    return devices
  } catch (err) {
    console.error('Error listUsbDevices:', err)
    return []
  }
})

/* ---------------------------------------------------
Detectar escáneres (USB imaging devices)
--------------------------------------------------- */
ipcMain.handle('detectScanners', async () => {
  try {
    const scanners = usb.getDeviceList().filter(
      d => d.deviceDescriptor.bDeviceClass === 0x0e
    )
    return scanners.map(s => ({
      vendorId: s.deviceDescriptor.idVendor,
      productId: s.deviceDescriptor.idProduct
    }))
  } catch (err) {
    console.error('detectScanners error', err)
    return []
  }
})

/* ---------------------------------------------------
Ping a impresora LAN por IP:9100
--------------------------------------------------- */
ipcMain.handle('pingPrinter', async (event, ip, port = 9100) => {
  return new Promise(resolve => {
    const socket = new net.Socket()
    socket.setTimeout(5000)
    socket.connect(port, ip, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.on('timeout', () => resolve(false))
  })
})


ipcMain.handle('printRaw', async (event, base64Data, options) => {
  const data = Buffer.from(base64Data, 'base64');
  const { type = 'auto', ip, port = 9100, printer } = options;

  try {
    if (type === 'lan' && ip) {
      console.log(`Enviando datos a impresora LAN ${ip}:${port}`);
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.connect(port, ip, () => {
          socket.write(data, err => {
            if (err) return reject(err);
            socket.end();
          });
        });
        socket.on('close', resolve);
        socket.on('error', reject);
        socket.setTimeout(3000, () => reject(new Error('Timeout de conexión')));
      });
      console.log('✅ Datos enviados por LAN correctamente.');
      return { ok: true, method: 'lan' };
    }

    // Impresión por sistema (Windows)
    if (type === 'usb' || type === 'auto') {
      const { PosPrinter } = require('electron-pos-printer');
      const printers = await mainWindow.webContents.getPrintersAsync();
      const defaultPrinter = printers.find(p => p.isDefault);
      const printerName = printer || defaultPrinter?.name;

      if (!printerName) throw new Error('No se encontró impresora del sistema');

      await PosPrinter.print(
        [{ type: 'raw', value: data }],
        { printerName, silent: true }
      );
      return { ok: true, method: 'system' };
    }

    return { ok: false, error: 'Tipo no soportado' };
  } catch (err) {
    console.error('Error en printRaw:', err);
    return { ok: false, error: err.message };
  }
});


/* ---------------------------------------------------
   Descubrir impresoras LAN en el puerto 9100
--------------------------------------------------- */
ipcMain.handle('discover-lan-printers', async () => {
  console.log('Escaneando red para impresoras LAN (puerto 9100)...');

  const interfaces = os.networkInterfaces();
  const baseIps = [];

  // Detectar todas las subredes IPv4 activas
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        baseIps.push(iface.address.split('.').slice(0, 3).join('.'));
      }
    }
  }

  if (baseIps.length === 0) {
    console.error('No se detectaron interfaces de red activas.');
    return [];
  }

  const printers = [];

  // Escanear cada red local (por si hay más de una)
  for (const baseIp of baseIps) {
    console.log(`Escaneando subred ${baseIp}.x`);
    const scanPromises = [];

    for (let i = 1; i <= 254; i++) {
      const ip = `${baseIp}.${i}`;
      scanPromises.push(
        new Promise((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(2000);

          socket.once('connect', async () => {
            socket.destroy();
            // Si responde al puerto 9100, intentar obtener MAC
            arp.getMAC(ip, (err, mac) => {
              resolve({ ip, mac: err ? null : mac });
            });
          });

          socket.once('error', () => resolve(null));
          socket.once('timeout', () => { socket.destroy(); resolve(null); });

          socket.connect(9100, ip);
        })
      );
    }

    const results = await Promise.all(scanPromises);
    results.filter(Boolean).forEach(r => printers.push(r));
  }

  console.log(`Escaneo completo. ${printers.length} impresoras encontradas.`);
  return printers;
});

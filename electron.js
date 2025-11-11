import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import pkg from 'pdf-to-printer'
const { getPrinters } = pkg
import net from 'net'
import { createRequire } from 'module' 
import os from 'os'
import arp from 'node-arp'

const require = createRequire(import.meta.url)
const usb = require('usb')

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


/* ---------------------------------------------------
 Imprimir datos crudos (RAW) - CORREGIDO
--------------------------------------------------- */

ipcMain.handle('printRaw', async (event, base64Data, options) => {
  const data = Buffer.from(base64Data, 'base64');
  const { type = 'auto', ip, port = 9100, printer } = options;

  console.log(`Intentando imprimir con tipo: "${type}", impresora: "${printer}"`);

  try {
    // --- CASO 1: LAN  ---
    if (type === 'lan' && ip) {
      console.log(`Enviando datos a impresora LAN ${ip}:${port}`);
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(5000, () => reject(new Error('Timeout de conexión LAN')));
        
        socket.connect(port, ip, () => {
          socket.write(data, (err) => {
            if (err) return reject(err);
            socket.end();
          });
        });
        
        socket.on('close', resolve);
        socket.on('error', reject);
      });
      console.log('Datos enviados por LAN correctamente.');
      return { ok: true, method: 'lan' };
    }

    // --- CASO 2: USB (Directo por Hardware - v3 API) ---
    if (type === 'usb') {
  console.log('Enviando datos por USB Directo (escpos v3)...');
  
  return new Promise((resolve, reject) => {
    try {
      const { Printer } = require('escpos');
      const Usb = require('escpos-usb'); 

      const usbDevice = Usb.findPrinter(); 
      
      if (!usbDevice) {
        throw new Error('No se encontró ninguna impresora USB (escpos-usb). ¿Está conectada y encendida?');
      }

      const adapter = new Usb(usbDevice); 
      const printer = new Printer(adapter);

      adapter.open((err) => {
        if (err) {
          console.error('Error al abrir USB (escpos-usb):', err);
          return reject(new Error(`Error USB Directo: ${err.message}`));
        }
        
        printer.raw(data).close(() => {
          console.log('✅ Datos enviados por USB Directo correctamente.');
          resolve({ ok: true, method: 'usb-direct' });
        });
      });

      adapter.on('error', (err) => {
        console.error('Error de adaptador USB (escpos v3):', err);
        reject(new Error(`Error USB: ${err.message}`));
      });

    } catch (err) {
      console.error('Error al inicializar escpos.Usb (v3):', err);
      reject(err);
    }
  });
}

    if (type === 'auto') {
      console.log('Enviando datos por Sistema (PosPrinter)...');
      const { PosPrinter } = require('electron-pos-printer');
      
      const printers = await mainWindow.webContents.getPrintersAsync();
      const defaultPrinter = printers.find(p => p.isDefault);
      const printerName = printer || defaultPrinter?.name;

      if (!printerName) throw new Error('No se encontró impresora del sistema (tipo "auto")');
      
      console.log(`Usando impresora de sistema: "${printerName}"`);
      await PosPrinter.print(
        [{ type: 'raw', value: data }],
        { printerName, silent: true }
      );
      return { ok: true, method: 'system' };
    }

    return { ok: false, error: `Tipo no soportado: "${type}"` };

  } catch (err) {
    console.error('Error fatal en printRaw:', err.message);
    return { ok: false, error: err.message };
  }
});


/* ---------------------------------------------------
   Descubrir impresoras LAN en el puerto 9100
--------------------------------------------------- */
ipcMain.handle('discover-lan-printers', async (event, options = {}) => {
  const startTs = Date.now()
  const {
    extraBases = [],
    ports = [9100],
    timeoutMs = 1500,
    concurrency = 200,
    perBaseLimit = 50,
    fullScan = false,
    probeIpFirst = null
  } = options

  const interfaces = os.networkInterfaces()
  const localBases = new Set()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const base = iface.address.split('.').slice(0, 3).join('.')
        localBases.add(base)
      }
    }
  }

  extraBases.forEach(b => {
    const parts = b.split('.')
    if (parts.length === 4) localBases.add(parts.slice(0,3).join('.'))
    else if (parts.length === 3) localBases.add(b)
  })

  const bases = Array.from(localBases)
  if (bases.length === 0) {
    console.warn('discover-lan-printers: no network bases found')
    return []
  }


  const tasks = [] 
  const pushRangeForBase = (base) => {
    const start = 1, end = fullScan ? 254 : (perBaseLimit || 50)
    for (let i = start; i <= end; i++) {
      tasks.push({ ip: `${base}.${i}`, base })
    }
  }

  for (const base of bases) pushRangeForBase(base)


  if (probeIpFirst) {
    const normalized = probeIpFirst.trim()
    if (!tasks.some(t => t.ip === normalized)) tasks.unshift({ ip: normalized, base: normalized.split('.').slice(0,3).join('.') })
  }

  const checkPortOpen = (ip, port, timeout = timeoutMs) => {
    return new Promise(resolve => {
      const socket = new net.Socket()
      let done = false
      socket.setTimeout(timeout)
      socket.once('connect', () => { done = true; socket.destroy(); resolve(true) })
      socket.once('error', () => { if (!done) { done = true; resolve(false) } })
      socket.once('timeout', () => { if (!done) { done = true; socket.destroy(); resolve(false) } })
      socket.connect(port, ip)
    })
  }

  const getMac = (ip) => {
    return new Promise(resolve => {
      arp.getMAC(ip, (err, mac) => {
        if (err || !mac) return resolve(null)
        return resolve(mac)
      })
    })
  }

  const resultsMap = new Map()
  let idx = 0
  let active = 0

  const runTask = async (task) => {
    const ip = task.ip
    const openPorts = []

    for (const p of ports) {
      try {
        const ok = await checkPortOpen(ip, p)
        if (ok) openPorts.push(p)
      } catch (e) {
        // ignorar
      }
    }
    if (openPorts.length > 0) {
      const mac = await getMac(ip)
      resultsMap.set(ip, { ip, mac, openPorts })
    }
  }

  const workers = []
  const total = tasks.length
  const startLogInterval = Date.now()

  const launcher = async () => {
    while (idx < total) {
      if (active >= concurrency) {

        await new Promise(r => setTimeout(r, 10))
        continue
      }
      const task = tasks[idx++]
      active++

      const p = runTask(task).catch(e => console.error('task-run error', e)).finally(() => { active-- })
      workers.push(p)
    }

    await Promise.all(workers)
  }

  try {
    await launcher()
  } catch (err) {
    console.error('discover-lan-printers launcher error', err)
  }

  const results = Array.from(resultsMap.values())

  const elapsed = Date.now() - startTs
  console.log(`discover-lan-printers: escaneo terminado en ${elapsed}ms, encontrados: ${results.length}`)
  return results
})
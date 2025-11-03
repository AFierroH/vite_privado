import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

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

  const devUrl = 'http://localhost:5173'
  mainWindow.loadURL(devUrl)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})



async function tryImport(moduleName) {
  try { return await import(moduleName) } catch (e) { return null }
}

ipcMain.handle('list-printers', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && win.webContents.getPrinters) {
      return win.webContents.getPrinters()
    } else {
      console.warn('getPrinters no disponible en este contexto')
      return []
    }
  } catch (err) {
    console.error('❌ list-printers error:', err)
    return []
  }
})

ipcMain.handle('list-usb-devices', async () => {
  try {
    const usbDetection = await tryImport('usb-detection')
    if (!usbDetection || !usbDetection.find) return []
    // usb-detection ESM import shape varies; call default if needed
    const detector = usbDetection.default ?? usbDetection
    // detector.find returns Promise in some versions, callback in others
    if (detector.find && detector.find.length === 1) {
      return await detector.find()
    }
    // fallback: try synchronous .getDetectedDevices (rare)
    return []
  } catch (err) {
    console.error('list-usb-devices error', err)
    return []
  }
})

ipcMain.handle('list-serial-ports', async () => {
  try {
    const sp = await tryImport('serialport')
    const SerialPort = sp?.SerialPort ?? sp?.default ?? sp
    if (!SerialPort || typeof SerialPort.list !== 'function') return []
    return await SerialPort.list()
  } catch (err) {
    console.error('list-serial-ports error', err)
    return []
  }
})

// alias que tu frontend llama: detect-scanners -> serial ports
ipcMain.handle('detect-scanners', async (event) => {
  try {
    const list = await ipcMain.invoke?.('list-serial-ports') // not directly available, call implementation:
    // call implementation directly:
    const sp = await tryImport('serialport')
    const SerialPort = sp?.SerialPort ?? sp?.default ?? sp
    if (!SerialPort || typeof SerialPort.list !== 'function') return []
    return await SerialPort.list()
  } catch (err) {
    console.error('detect-scanners error', err)
    return []
  }
})

// print-raw: LAN (TCP) and COM (serial) implemented. USB/raw other methods require libs (escpos/node-usb).
ipcMain.handle('print-raw', async (event, base64, options = {}) => {
  try {
    const buf = Buffer.from(base64, 'base64')
    const { type = 'auto', ip, port = 9100, com, baudRate = 9600 } = options

    if ((type === 'lan' || type === 'auto') && ip) {
      const net = await tryImport('net') // net is built-in; dynamic import returns module object in ESM loader
      // net may not be loadable via import(), use require fallback via createRequire
      let netLib
      try {
        netLib = await import('net')
      } catch {
        // fallback using require via createRequire
        const { createRequire } = await import('module')
        netLib = createRequire(import.meta.url)('net')
      }
      await new Promise((resolve, reject) => {
        const client = netLib.Socket ? new netLib.Socket() : new netLib.Socket()
        client.setTimeout(5000)
        client.connect(port, ip, () => {
          client.write(buf)
          client.end()
        })
        client.on('close', resolve)
        client.on('error', reject)
        client.on('timeout', () => { client.destroy(); reject(new Error('timeout')) })
      })
      return { ok: true, method: 'lan' }
    }

    if ((type === 'com' || type === 'auto') && com) {
      const spModule = await tryImport('serialport')
      const SerialPort = spModule?.SerialPort ?? spModule?.default ?? spModule
      if (!SerialPort || typeof SerialPort !== 'function') throw new Error('serialport no instalado')
      const portInstance = new SerialPort(com, { baudRate })
      await new Promise((resolve, reject) => {
        portInstance.write(buf, (err) => { if (err) reject(err); else resolve() })
      })
      portInstance.close?.()
      return { ok: true, method: 'com' }
    }

    return { ok: false, error: 'No se envió: falta implementación para este tipo', type }
  } catch (err) {
    console.error('print-raw error', err)
    return { ok: false, error: err.message }
  }
})
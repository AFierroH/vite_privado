import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPrinters, print } from 'pdf-to-printer'
import usb from 'usb'
import SerialPort from 'serialport'
import net from 'net'
import fs from 'fs'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

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
   🔌 Listar dispositivos USB conectados
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
   🔍 Detectar escáneres (USB imaging devices)
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
   📡 Ping a impresora LAN por IP:9100
--------------------------------------------------- */
ipcMain.handle('pingPrinter', async (event, ip, port = 9100) => {
  return new Promise(resolve => {
    const socket = new net.Socket()
    socket.setTimeout(800)
    socket.connect(port, ip, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.on('timeout', () => resolve(false))
  })
})

/* ---------------------------------------------------
   🧾 Imprimir datos crudos (RAW)
   Soporta:
   - type: "lan", "com", "auto"
   - printer: nombre Windows
   - ip / port / com / usb
--------------------------------------------------- */
ipcMain.handle('printRaw', async (event, base64, options = {}) => {
  try {
    const buffer = Buffer.from(base64, 'base64')
    const { type = 'auto', ip, port = 9100, com, baudRate = 9600, printer } = options

    // 🖨️ LAN
    if ((type === 'lan' || type === 'auto') && ip) {
      return await new Promise((resolve, reject) => {
        const client = new net.Socket()
        client.connect(port, ip, () => {
          client.write(buffer)
          client.end()
          resolve({ ok: true, method: 'lan' })
        })
        client.on('error', err => reject(err))
      })
    }

    // 🧵 Puerto serial COM
    if ((type === 'com' || type === 'auto') && com) {
      const portInstance = new SerialPort({ path: com, baudRate })
      portInstance.write(buffer)
      portInstance.close()
      return { ok: true, method: 'com' }
    }

    // 🖨️ Impresora del sistema
    if (printer) {
      const temp = path.join(app.getPath('temp'), 'ticket-raw.txt')
      fs.writeFileSync(temp, buffer.toString('utf8'))
      await print(temp, { printer, win32: ['RAW'] })
      return { ok: true, method: 'system' }
    }

    return { ok: false, error: 'Tipo no soportado o faltan parámetros' }
  } catch (err) {
    console.error('printRaw error:', err)
    return { ok: false, error: err.message }
  }
})

import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import pkg from 'pdf-to-printer'
const { getPrinters, print } = pkg
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
ipcMain.handle('printRaw', async (event, base64Data, options) => {
  console.log('Handling print-raw call with options:', options)
  const data = Buffer.from(base64Data, 'base64')

  try {
    // Lógica para LAN, USB, COM 
    if (options.type === 'lan') {
      // LAN
      console.log(`Printing via LAN to ${options.ip}:${options.port}`)
      const device = new escpos.Network(options.ip, options.port)
      return { ok: true, method: 'lan' }

    } else if (options.type === 'usb') {
      // USB
      return { ok: true, method: 'usb' }

    } else if (options.type === 'com') {
      // COM
      return { ok: true, method: 'com' }

    } else {
      console.log('Printing via electron-pos-printer (system default/selected)')
      let printerToUse = options.printer 

      if (!printerToUse) {
        console.log('No printer selected. Finding system default printer...')
        try {
          const printers = await win.webContents.getPrintersAsync()
          const defaultPrinter = printers.find(p => p.isDefault)

          if (defaultPrinter) {
            printerToUse = defaultPrinter.name
            console.log('Using system default printer:', printerToUse)
          } else {
            console.error('No printer selected and no default printer found!')
            throw new Error('No printer selected and no default printer found')
          }
        } catch (e) {
          console.error('Error finding default printer:', e)
          throw e 
        }
      }

      // Ahora llamamos a PosPrinter con un nombre de impresora válido
      await PosPrinter.print(
        [{ type: 'raw', value: data }], 
        {
          printerName: printerToUse, // Nombre de la impresora (ya sea seleccionada o la default)
          silent: true,
        }
      )
      
      return { ok: true, method: 'system' }
    }

  } catch (err) {
    console.error('Error en print-raw:', err.message, err)
    return { ok: false, error: err.message }
  }
})
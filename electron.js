import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import pkg from 'pdf-to-printer'
const { getPrinters } = pkg
import usb from 'usb'
import net from 'net'
import { createRequire } from 'module' 

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
/* ---------------------------------------------------
   🧾 Imprimir datos crudos (RAW)
   Soporta:
   - type: "lan", "com", "auto", "usb"
--------------------------------------------------- */
ipcMain.handle('printRaw', async (event, base64Data, options) => {
  console.log('Handling print-raw call with options:', options)
  const data = Buffer.from(base64Data, 'base64')

  try {
    // --- CASO 1: Impresión por LAN (IP) Directa ---
    // Usa 'escpos' para hablar directo con la IP, ignorando Windows.
    if (options.type === 'lan') {
      console.log(`Printing via LAN (direct) to ${options.ip}:${options.port}`)
      if (!options.ip || !options.port) {
        throw new Error('IP o Puerto no especificados para LAN')
      }

      // 'escpos' usa callbacks, así que lo envolvemos en una Promesa
      return new Promise((resolve, reject) => {
        const device = new escpos.Network(options.ip, options.port)
        const printer = new escpos.Printer(device)

        // Timeout por si la impresora no responde
        const connectionTimeout = setTimeout(() => {
            reject(new Error('Error: Timeout de conexión LAN (5s)'))
            device.close() // Intenta cerrar
        }, 5000)

        device.open((err) => {
            clearTimeout(connectionTimeout) // Éxito, limpiar timeout
            if (err) {
              console.error('Error al abrir conexión LAN:', err)
              return reject(new Error(`Error LAN: ${err.message}`))
            }
            
            printer.raw(data) // Envía los bytes crudos
            printer.close() // Corta y cierra la conexión
            
            console.log('Datos enviados a LAN correctamente.')
            resolve({ ok: true, method: 'lan' })
        })

        device.on('error', (err) => {
            clearTimeout(connectionTimeout)
            console.error('Error de Socket LAN:', err)
            reject(new Error(`Error Socket: ${err.message}`))
        })
      })
    }

    // --- CASO 2: Impresión por COM (Serial) Directa ---
    // Usa 'escpos' para hablar directo con el puerto COM.
    else if (options.type === 'com') {
      console.log(`Printing via COM (direct) to ${options.com}`)
      if (!options.com) {
        throw new Error('Puerto COM no especificado')
      }

      return new Promise((resolve, reject) => {
        // 9600 es el baudRate más común para impresoras térmicas
        const device = new escpos.Serial(options.com, { baudRate: 9600 })
        const printer = new escpos.Printer(device)

        device.open((err) => {
            if (err) {
              console.error('Error al abrir conexión COM:', err)
              return reject(new Error(`Error COM: ${err.message}`))
            }

            printer.raw(data)
            printer.close()
            
            console.log('Datos enviados a COM correctamente.')
            resolve({ ok: true, method: 'com' })
        })

        device.on('error', (err) => {
            console.error('Error de Puerto Serial:', err)
            reject(new Error(`Error Serial: ${err.message}`))
        })
      })
    }

    // --- CASO 3: Impresión por Sistema (USB, Auto) ---
    // Usa 'electron-pos-printer' para hablar con la cola de Windows.
    // Sirve para USB y para impresoras de Red (LAN) que ya están INSTALADAS en Windows.
    else if (options.type === 'auto' || options.type === 'usb') {
      console.log(`Printing via System (PosPrinter) (type: ${options.type})`)
      let printerToUse = options.printer // Ej. "XP-80C" o "XP-80C (copy 1)"

      // Si no se seleccionó impresora (viene vacío), buscar la default
      if (!printerToUse) {
        console.log('No printer selected. Finding system default printer...')
        try {
          // ¡Corregido! Usa 'mainWindow', no 'win'
          const printers = await mainWindow.webContents.getPrintersAsync() 
          const defaultPrinter = printers.find(p => p.isDefault)

          if (defaultPrinter) {
            printerToUse = defaultPrinter.name
            console.log('Using system default printer:', printerToUse)
          } else {
            throw new Error('No printer selected and no default printer found')
          }
        } catch (e) {
          console.error('Error finding default printer:', e)
          throw e 
        }
      }

      // Ahora llamamos a PosPrinter con el nombre de la impresora de Windows
      console.log(`Sending to PosPrinter with printerName: "${printerToUse}"`)
      await PosPrinter.print(
        [{ type: 'raw', value: data }], 
        {
          printerName: printerToUse,
          silent: true,
        }
      )
      
      return { ok: true, method: `system (${options.type})` }
    }
    
    // --- CASO 4: Tipo desconocido ---
    else {
      throw new Error(`Tipo de impresora desconocido: ${options.type}`)
    }

  } catch (err) {
    console.error('Error fatal en print-raw:', err.message, err)
    // Devolvemos el error al frontend para que el usuario lo vea
    return { ok: false, error: err.message }
  }
})
import { app, BrowserWindow, ipcMain } from 'electron'
import net from 'net'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import os from 'os'
import arp from 'node-arp'
import fs from 'fs'
import fsExtra from 'fs-extra'
import PDFDocument from 'pdfkit'
import iconv from 'iconv-lite'
import pkg from 'pdf-to-printer'
const { print, getPrinters } = pkg
import path from 'path'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
let mainWindow

/* ---------------------------------------------------
 Crear ventana principal
--------------------------------------------------- */
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

  const devUrl = 'http://147.182.245.46' // frontend remoto
  mainWindow.loadURL(devUrl)
}
app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

/* ---------------------------------------------------
 Guardar boleta localmente
--------------------------------------------------- */
async function saveBoletaLocally(venta, pdfBuffer, xmlContent) {
  try {
    const userData = app.getPath('userData')
    const folder = path.join(userData, 'boletas', new Date().toISOString().slice(0, 7))
    await fsExtra.ensureDir(folder)

    const empresa = venta?.empresa || 'Comercial_Temuco_SpA_RUT_76234567-9'
    const nombreArchivo = `${empresa.replace(/\s+/g, '_')}_Boleta_${String(
      venta.id_venta || Date.now()
    ).padStart(6, '0')}`

    const pdfPath = path.join(folder, `${nombreArchivo}.pdf`)
    fs.writeFileSync(pdfPath, pdfBuffer)

    const xmlPath = path.join(folder, `${nombreArchivo}.xml`)
    fs.writeFileSync(xmlPath, xmlContent)

    console.log('📄 Boleta guardada en:', pdfPath)
    return { pdfPath, xmlPath }
  } catch (err) {
    console.error('❌ Error guardando boleta localmente:', err)
    return null
  }
}

/* ---------------------------------------------------
 Generar PDF real con logo + PDF417
--------------------------------------------------- */
async function renderEscposToPdf(ticketBase64, outPath, opts = {}) {
  const {
    codepage = 'cp858',
    pageWidthPts = 220,
    margin = 10,
    normalFontSize = 9,
    logoPath = path.join(__dirname, 'src', 'venta', 'CocaCola.png'),
    pdf417Base64 = null
  } = opts

  const buf = Buffer.from(ticketBase64, 'base64')
  await fsExtra.ensureDir(path.dirname(outPath))
  const doc = new PDFDocument({ size: [pageWidthPts, 1000 + buf.length / 2], margin })
  const stream = fs.createWriteStream(outPath)
  doc.pipe(stream)

  const usableWidth = pageWidthPts - margin * 2
  let align = 'left'
  let bold = false
  let textChunk = []

  function flush() {
    if (textChunk.length === 0) return
    let text = iconv.decode(Buffer.from(textChunk), codepage).replace(/\r/g, '')
    const font = bold ? 'Courier-Bold' : 'Courier'
    doc.font(font).fontSize(normalFontSize).text(text, { align, width: usableWidth })
    textChunk = []
  }

  // ---- LOGO ----
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, {
        fit: [usableWidth, 80],
        align: 'center',
        valign: 'center'
      })
      doc.moveDown(0.5)
    }
  } catch (e) {
    console.warn('⚠️ No se pudo insertar logo:', e.message)
  }

  // ---- TEXTO ESC/POS ----
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]
    if (b === 0x1B && buf[i + 1] === 0x61) {
      flush()
      align = buf[i + 2] === 1 ? 'center' : buf[i + 2] === 2 ? 'right' : 'left'
      i += 2
      continue
    }
    if (b === 0x1B && buf[i + 1] === 0x45) {
      flush()
      bold = buf[i + 2] === 1
      i += 2
      continue
    }
    if (b === 0x0A) {
      flush()
      doc.moveDown(0.2)
      continue
    }
    textChunk.push(b)
  }
  flush()

  // ---- PDF417 ----
  try {
    if (pdf417Base64) {
      const pdf417 = Buffer.from(pdf417Base64, 'base64')
      doc.moveDown(0.5)
      doc.image(pdf417, {
        fit: [usableWidth, 90],
        align: 'center',
        valign: 'center'
      })
    }
  } catch (e) {
    console.warn('⚠️ No se pudo insertar PDF417:', e.message)
  }

  doc.end()
  await new Promise((res) => stream.on('finish', res))
  return outPath
}

/* ---------------------------------------------------
 Listar impresoras
--------------------------------------------------- */
ipcMain.handle('listSystemPrinters', async () => {
  try {
    const list = await getPrinters()
    return list.map((p) => p.name)
  } catch (err) {
    console.error('Error listSystemPrinters:', err)
    return []
  }
})

/* ---------------------------------------------------
 Ping LAN
--------------------------------------------------- */
ipcMain.handle('pingPrinter', async (event, ip, port = 9100) => {
  return new Promise((resolve) => {
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
 Imprimir + guardar local
--------------------------------------------------- */
ipcMain.handle('printRaw', async (event, base64Data, options = {}) => {
  const { type = 'auto', ip, port = 9100, printer, venta, pdf417Base64 } = options

  try {
    const tmpPath = path.join(process.env.TEMP || __dirname, `ticket_${Date.now()}.pdf`)

    // Generar PDF real con logo y código
    await renderEscposToPdf(base64Data, tmpPath, {
      codepage: 'cp858',
      pdf417Base64
    })

    const pdfBuffer = fs.readFileSync(tmpPath)

    // Guardar XML simple local
    const xml = `<boleta>
  <empresa>${venta?.empresa || 'Comercial Temuco SpA'}</empresa>
  <numero>${venta?.id_venta || '000000'}</numero>
  <total>${venta?.total || 0}</total>
  <fecha>${new Date().toLocaleString('es-CL')}</fecha>
</boleta>`

    await saveBoletaLocally(venta || {}, pdfBuffer, xml)

    // Imprimir según tipo
    if (type === 'lan' && ip) {
      await print(tmpPath, { printer: printer || null, silent: true })
    } else if (type === 'usb' || type === 'auto') {
      await print(tmpPath, { printer: printer || null, silent: true })
    }

    fs.unlink(tmpPath, () => {})
    return { ok: true, msg: 'Boleta impresa y guardada correctamente' }
  } catch (err) {
    console.error('❌ Error en printRaw:', err)
    return { ok: false, error: err.message || String(err) }
  }
})

/* ---------------------------------------------------
 Descubrir impresoras LAN
--------------------------------------------------- */
ipcMain.handle('discover-lan-printers', async (event, options = {}) => {
  const startTs = Date.now()
  const { ports = [9100], timeoutMs = 1500 } = options
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

  const tasks = []
  for (const base of localBases) {
    for (let i = 1; i <= 254; i++) {
      tasks.push(`${base}.${i}`)
    }
  }

  const results = []
  const checkPortOpen = (ip, port, timeout = timeoutMs) =>
    new Promise((resolve) => {
      const socket = new net.Socket()
      let done = false
      socket.setTimeout(timeout)
      socket.once('connect', () => {
        done = true
        socket.destroy()
        resolve(true)
      })
      socket.once('error', () => !done && resolve(false))
      socket.once('timeout', () => {
        !done && socket.destroy()
        resolve(false)
      })
      socket.connect(port, ip)
    })

  for (const ip of tasks) {
    for (const port of ports) {
      const ok = await checkPortOpen(ip, port)
      if (ok) results.push({ ip, port })
    }
  }

  const elapsed = Date.now() - startTs
  console.log(`discover-lan-printers: ${results.length} en ${elapsed}ms`)
  return results
})

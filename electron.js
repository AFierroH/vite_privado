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

  const devUrl = 'http://147.182.245.46' // tu frontend remoto
  mainWindow.loadURL(devUrl)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})




async function renderEscposToPdf(base64Data, outPath, opts = {}) {
  const {
    codepage = 'cp857', // cambia si necesitas cp437, cp857...
    pageWidthPts = 226, // 80mm aprox = 3.1496in * 72 = 226 pts
    pageHeightPts = 1200, // altura grande para no cortar (se puede ajustar)
    margin = 8,
    normalFontSize = 9,
    doubleFontSize = 14
  } = opts

  const buf = Buffer.from(base64Data, 'base64')

  // Creamos doc PDF
  await fsExtra.ensureDir(path.dirname(outPath))
  const doc = new PDFDocument({
    size: [pageWidthPts, pageHeightPts],
    margins: { top: margin, bottom: margin, left: margin, right: margin }
  })
  const stream = fs.createWriteStream(outPath)
  doc.pipe(stream)

  // Fuente monoespaciada incluida
  const usableWidth = pageWidthPts - margin * 2

  // estados
  let align = 'left'
  let bold = false
  let doubleHW = false

  // buffer temporal para colectar bytes de texto antes de decodificar
  let textChunk = []

  // helper: flush chunk -> escribe al PDF
  function flushChunkAsText() {
    if (!textChunk || textChunk.length === 0) return
    const chunkBuf = Buffer.from(textChunk)
    let text = iconv.decode(chunkBuf, codepage)
    text = text.replace(/\r/g, '') // quitar CR si existieran

    const font = bold ? 'Courier-Bold' : 'Courier'
    const fontSize = doubleHW ? doubleFontSize : normalFontSize

    doc.font(font).fontSize(fontSize)
    doc.text(text, {
      width: usableWidth,
      align: align,
      lineGap: doubleHW ? 2 : 0
    })
    textChunk = []
  }

  // Recorremos bytes e interpretamos comandos simples
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]

    // LF (line feed)
    if (b === 0x0a) {
      flushChunkAsText()
      doc.moveDown(0) // ya movido por text newline
      continue
    }

    // ESC sequences (0x1B ...)
    if (b === 0x1B) {
      // flush pending text
      flushChunkAsText()
      const next = buf[i + 1]
      if (next === undefined) break

      // ESC a n  -> align: 0 left, 1 center, 2 right
      if (next === 0x61 && i + 2 < buf.length) {
        const val = buf[i + 2]
        align = val === 1 ? 'center' : val === 2 ? 'right' : 'left'
        i += 2
        continue
      }

      // ESC E n -> bold on/off
      if (next === 0x45 && i + 2 < buf.length) {
        const val = buf[i + 2]
        bold = val === 1
        i += 2
        continue
      }

      // ESC d n -> print and feed n lines (we'll move down n)
      if (next === 0x64 && i + 2 < buf.length) {
        const n = buf[i + 2]
        for (let k = 0; k < n; k++) doc.moveDown(0.5)
        i += 2
        continue
      }

      // ESC @ -> init / reset
      if (next === 0x40) {
        align = 'left'
        bold = false
        doubleHW = false
        i += 1
        continue
      }

      // otros, salta el ESC solo
      i += 0
      continue
    }

    // GS sequences (0x1D)
    if (b === 0x1D) {
      flushChunkAsText()
      const next = buf[i + 1]
      if (next === undefined) break

      // GS ! n  -> char size (double height/width)
      if (next === 0x21 && i + 2 < buf.length) {
        const n = buf[i + 2]
        // 0x11 era tu doble (ejemplo). Aquí detectamos si bit para doble.
        // Consideramos n === 0x11 => doble alto+ancho
        doubleHW = n === 0x11
        i += 2
        continue
      }

      // GS V m -> corte (m puede tener valor)
      if (next === 0x56 && i + 2 < buf.length) {
        // draw line + espacio
        doc.moveDown(0.2)
        doc.font('Courier').fontSize(normalFontSize).text('-'.repeat(32), { align: 'center', width: usableWidth })
        doc.moveDown(1)
        i += 2
        continue
      }

      i += 0
      continue
    }

    // Si llegamos acá: byte normal -> meter al textChunk
    textChunk.push(b)
  }

  // flush restante
  flushChunkAsText()

  // finalizamos
  doc.end()
  await new Promise((res, rej) => {
    stream.on('finish', res)
    stream.on('error', rej)
  })
  return outPath
}

/* ---------------------------------------------------
 Listar impresoras del sistema
--------------------------------------------------- */
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
 Imprimir datos RAW (USB, LAN o Sistema)
--------------------------------------------------- */

ipcMain.handle('printRaw', async (event, base64Data, options) => {
  const data = Buffer.from(base64Data, 'base64') 
  const { type = 'auto', ip, port = 9100, printer, usePdfForLan = true } = options

  try {
    if (type === 'lan' && usePdfForLan) {
      const tmp = path.join(process.env.TEMP || __dirname, `ticket_${Date.now()}.pdf`)
      await renderEscposToPdf(base64Data, tmp, { codepage: 'cp858' })
      await print(tmp, { printer: printer || null, silent: true })
      fs.unlink(tmp, () => {})
      return { ok: true, method: 'lan-pdf' }
    }

    if (type === 'usb') {
      const tmp = path.join(process.env.TEMP || __dirname, `ticket_${Date.now()}.pdf`)
      await renderEscposToPdf(base64Data, tmp, { codepage: 'cp858' })
      await print(tmp, { printer: printer || null, silent: true })
      fs.unlink(tmp, () => {})
      return { ok: true, method: 'usb-pdf' }
    }

    if (type === 'lan' && ip && !usePdfForLan) {
      await new Promise((resolve, reject) => {
        const socket = new net.Socket()
        socket.setTimeout(5000, () => reject(new Error('Timeout de conexión LAN')))
        socket.connect(port, ip, () => {
          socket.write(data, (err) => {
            if (err) return reject(err)
            socket.end()
          })
        })
        socket.on('close', resolve)
        socket.on('error', reject)
      })
      return { ok: true, method: 'lan-raw' }
    }

    // auto (usa sistema - mantiene lo que tenías)
    if (type === 'auto') {
      const { PosPrinter } = require('electron-pos-printer')
      const printersList = await mainWindow.webContents.getPrintersAsync()
      const defaultPrinter = printersList.find(p => p.isDefault)
      const printerName = printer || defaultPrinter?.name
      if (!printerName) throw new Error('No se encontró impresora del sistema (tipo "auto")')
      await PosPrinter.print([{ type: 'raw', value: data }], { printerName, silent: true })
      return { ok: true, method: 'system' }
    }

    return { ok: false, error: `Tipo no soportado: "${type}"` }
  } catch (err) {
    console.error('Error fatal en printRaw:', err)
    return { ok: false, error: err.message || String(err) }
  }
})
/* ---------------------------------------------------
 Descubrir impresoras LAN (puerto 9100)
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
    if (parts.length === 4) localBases.add(parts.slice(0, 3).join('.'))
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
    if (!tasks.some(t => t.ip === normalized)) {
      tasks.unshift({
        ip: normalized,
        base: normalized.split('.').slice(0, 3).join('.')
      })
    }
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
      } catch {}
    }

    if (openPorts.length > 0) {
      const mac = await getMac(ip)
      resultsMap.set(ip, { ip, mac, openPorts })
    }
  }

  const workers = []
  const total = tasks.length

  const launcher = async () => {
    while (idx < total) {
      if (active >= concurrency) {
        await new Promise(r => setTimeout(r, 10))
        continue
      }
      const task = tasks[idx++]
      active++

      const p = runTask(task)
        .catch(e => console.error('task-run error', e))
        .finally(() => { active-- })
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

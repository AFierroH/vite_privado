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
import bwipjs from 'bwip-js'
import pkg from 'pdf-to-printer'
const { print, getPrinters } = pkg
import path from 'path'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow = null

// -------------------- CONFIG --------------------
const DEFAULT_CODEPAGE = 'cp1252' // evita caracteres chinos, ñ y símbolos CLP ok
const ESC_INIT_LATIN = Buffer.from([0x1B, 0x40, // ESC @ reset
  0x1B, 0x28, 0x52, 0x00, // Disable Kanji mode (ESC ( R 0)
  0x1B, 0x74, 0x10 // Select codepage 0x10 -> CP1252 on many printers
])

const PAGE_WIDTH_PTS = 220
const DEFAULT_LOGO = path.join(process.cwd(), 'src', 'venta', 'CocaCola.png')

// -------------------- UTILIDADES --------------------
function esc(hexes) {
  return Buffer.from(hexes)
}
function textBuf(s, codepage = DEFAULT_CODEPAGE) {
  // encode with chosen codepage — safe for ñ, acentos y símbolos CLP
  return iconv.encode(String(s || ''), codepage)
}

function formatCLP(v) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
}

function padRight(s, len) { return String(s || '').padEnd(len).slice(0, len) }
function padLeft(s, len) { return String(s || '').padStart(len).slice(-len) }

// -------------------- VENTANA --------------------
function createWindow() {
  const isDev = process.env.NODE_ENV !== 'production';
  const devUrl = process.env.ELECTRON_DEV_URL || 'http://147.182.245.46/';

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // mejora estética al iniciar
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    // 👉 Modo desarrollo: carga URL remota
    mainWindow.loadURL(devUrl).catch(err => {
      console.error('Error cargando dev URL:', err);
    });
  } else {
    // 👉 Modo producción: carga el index.html producido por Vite
    const indexPath = path.join(__dirname, 'web', 'dist', 'index.html');

    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Error cargando dist/index.html, usando devUrl:', err);
      mainWindow.loadURL(devUrl);
    });
  }

  // Seguridad opcional
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}


app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// -------------------- GENERAR PDF (preview) --------------------
async function renderEscposToPdf(ticketBase64, outPath, opts = {}) {
  const {
    codepage = DEFAULT_CODEPAGE,
    pageWidthPts = PAGE_WIDTH_PTS,
    margin = 8,
    normalFontSize = 9,
    logoPath = DEFAULT_LOGO,
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
    const text = iconv.decode(Buffer.from(textChunk), codepage).replace(/\r/g, '')
    const font = bold ? 'Courier-Bold' : 'Courier'
    try { doc.font(font).fontSize(normalFontSize).text(text, { align, width: usableWidth }) } catch (e) { doc.text(text) }
    textChunk = []
  }

  // LOGO
  try { if (fs.existsSync(logoPath)) { doc.image(logoPath, { fit: [usableWidth, 80], align: 'center', valign: 'center' }); doc.moveDown(0.4) } } catch (e) { console.warn('logo preview fail', e.message) }

  // parse ESC/POS-ish buffer: simple parser for alignment/bold/newline
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]
    if (b === 0x1B && buf[i + 1] === 0x61) { // ESC a n (alignment)
      flush(); align = buf[i+2] === 1 ? 'center' : buf[i+2] === 2 ? 'right' : 'left'; i += 2; continue
    }
    if (b === 0x1B && buf[i + 1] === 0x45) { // ESC E n (bold)
      flush(); bold = buf[i+2] === 1; i += 2; continue
    }
    if (b === 0x0A) { flush(); doc.moveDown(0.2); continue }
    textChunk.push(b)
  }
  flush()

  // insert pdf417
  if (pdf417Base64) {
    try {
      const pdf417 = Buffer.from(pdf417Base64, 'base64')
      doc.moveDown(0.6)
      doc.image(pdf417, { fit: [usableWidth, 90], align: 'center', valign: 'center' })
    } catch (e) { console.warn('pdf417 preview fail', e.message) }
  }

  doc.end()
  await new Promise((res) => stream.on('finish', res))
  return outPath
}

// -------------------- GENERAR PDF417 --------------------
async function generatePdf417Base64(text) {
  const png = await bwipjs.toBuffer({ bcid: 'pdf417', text: String(text), scale: 3, height: 8, includetext: false })
  return png.toString('base64')
}

// -------------------- GUARDAR BOLETA --------------------
async function saveBoletaLocally(venta, pdfBuffer, xmlContent) {
  try {
    const userData = app.getPath('userData')
    const folder = path.join(userData, 'boletas', new Date().toISOString().slice(0,7))
    await fsExtra.ensureDir(folder)
    const empresa = (venta?.empresa || 'Empresa').replace(/\s+/g,'_')
    const nombre = `${empresa}_Boleta_${String(venta.id_venta || Date.now()).padStart(6,'0')}`
    const pdfPath = path.join(folder, `${nombre}.pdf`)
    if (pdfBuffer && pdfBuffer.length) fs.writeFileSync(pdfPath, pdfBuffer)
    const xmlPath = path.join(folder, `${nombre}.xml`)
    if (xmlContent) fs.writeFileSync(xmlPath, xmlContent)
    return { pdfPath, xmlPath }
  } catch (e) { console.error('saveBoleta error', e); return null }
}

// -------------------- ARMAR TICKET (ESC/POS) --------------------
function buildTicketBuffer({ empresa = {}, venta = {}, detalles = [], total = 0, codepage = DEFAULT_CODEPAGE, includeLogoBase64 = false }) {
  const ANCHO_TOTAL = 42
  const ANCHO_PRECIO = 12
  const ANCHO_NOMBRE = ANCHO_TOTAL - ANCHO_PRECIO

  const INIT = ESC_INIT_LATIN
  const BOLD_ON = esc([0x1b, 0x45, 0x01])
  const BOLD_OFF = esc([0x1b, 0x45, 0x00])
  const DOUBLE_HW = esc([0x1d, 0x21, 0x11])
  const RESET_HW = esc([0x1d, 0x21, 0x00])
  const ALIGN_CENTER = esc([0x1b, 0x61, 0x01])
  const ALIGN_LEFT = esc([0x1b, 0x61, 0x00])
  const CUT = esc([0x1d, 0x56, 0x42, 0x00])
  const FEED = (n) => esc([0x1b, 0x64, n])

  const buffers = []
  buffers.push(INIT)
  buffers.push(ALIGN_CENTER)
  buffers.push(DOUBLE_HW)
  buffers.push(textBuf(`${empresa.razonSocial || 'EMPRESA'}\n`, codepage))
  buffers.push(RESET_HW)
  buffers.push(textBuf(`RUT: ${empresa.rut || '-'}\n`, codepage))
  buffers.push(BOLD_ON)
  buffers.push(textBuf(`BOLETA Nº ${venta.id_venta || '000000'}\n`, codepage))
  buffers.push(BOLD_OFF)

  if (includeLogoBase64 && empresa.logoBase64) {
    // no insert binary image raw into ESC/POS here — we provide base64 for preview only
    buffers.push(textBuf(`[LOGO_BASE64]\n`, codepage))
  }

  buffers.push(textBuf(`${empresa.direccion || ''}, ${empresa.comuna || ''}\n`, codepage))
  buffers.push(textBuf(`${empresa.ciudad || ''} — Tel: ${empresa.telefono || ''}\n`, codepage))
  buffers.push(textBuf('------------------------------------------\n', codepage))
  buffers.push(ALIGN_LEFT)
  buffers.push(textBuf(`Fecha: ${venta.fecha || new Date().toLocaleString('es-CL')}\n`, codepage))
  buffers.push(textBuf('------------------------------------------\n', codepage))

  for (const d of detalles) {
    const precioUnitario = formatCLP(d.precio_unitario || 0)
    const subtotal = formatCLP((d.cantidad || 0) * (d.precio_unitario || 0))
    buffers.push(textBuf(`${d.cantidad || 0} x ${precioUnitario}\n`, codepage))
    const nombreRecortado = (d.nombre || '').length > ANCHO_NOMBRE ? (d.nombre || '').substring(0, ANCHO_NOMBRE) : (d.nombre || '')
    const linea = padRight(nombreRecortado, ANCHO_NOMBRE) + padLeft(subtotal, ANCHO_PRECIO) + '\n'
    buffers.push(textBuf(linea, codepage))
  }

  buffers.push(textBuf('------------------------------------------\n', codepage))
  const neto = Math.round(total / 1.19)
  const iva = total - neto
  buffers.push(textBuf(`Neto:`.padEnd(ANCHO_NOMBRE) + padLeft(formatCLP(neto), ANCHO_PRECIO) + '\n', codepage))
  buffers.push(textBuf(`IVA (19%):`.padEnd(ANCHO_NOMBRE) + padLeft(formatCLP(iva), ANCHO_PRECIO) + '\n', codepage))
  buffers.push(BOLD_ON)
  buffers.push(DOUBLE_HW)
  buffers.push(textBuf(`TOTAL:`.padEnd(ANCHO_NOMBRE) + padLeft(formatCLP(total), ANCHO_PRECIO) + '\n', codepage))
  buffers.push(RESET_HW)
  buffers.push(BOLD_OFF)

  buffers.push(ALIGN_CENTER)
  buffers.push(FEED(1))
  buffers.push(textBuf('Gracias por su compra\n', codepage))
  buffers.push(FEED(1))
  buffers.push(textBuf('Timbre Electrónico SII\n', codepage))
  buffers.push(textBuf('Verifique el documento en www.sii.cl\n', codepage))
  buffers.push(FEED(2))
  buffers.push(CUT)

  return Buffer.concat(buffers)
}

// -------------------- IMPRESIÓN LAN / USB --------------------
async function sendToLan(ipAddr, portNum, buffer, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let done = false
    socket.setTimeout(timeout)
    socket.once('connect', () => {
      socket.write(buffer, () => { socket.end(); done = true; resolve(true) })
    })
    socket.once('error', (err) => { if (!done) reject(err) })
    socket.once('timeout', () => { if (!done) { socket.destroy(); reject(new Error('timeout')) } })
    socket.connect(portNum, ipAddr)
  })
}

async function printViaUSB(buffer) {
  try {
    const escpos = require('escpos')
    escpos.USB = require('escpos-usb')
    const device = new escpos.USB()
    const printer = new escpos.Printer(device, { encoding: 'CP1252' })
    await new Promise((resolve, reject) => {
      device.open(() => {
        try {
          if (typeof printer.raw === 'function') printer.raw(buffer)
          else if (typeof printer.write === 'function') printer.write(buffer)
          else printer.text(buffer.toString('binary'))
          printer.cut && printer.cut()
          printer.close && printer.close()
          resolve(true)
        } catch (e) { reject(e) }
      })
    })
    return true
  } catch (e) {
    console.warn('USB print failed (escpos missing?):', e.message || e)
    throw e
  }
}

// -------------------- IPC HANDLERS --------------------
ipcMain.handle('generarDTE', async (event, opts = {}) => {
  // opts: { empresa, detalles, total, id_venta, includeLogo }
  try {
    const empresa = opts.empresa || {
      rut: '76.543.210-K', razonSocial: 'Comercial Temuco SpA', direccion: 'Av. Alemania 671', comuna: 'Temuco', ciudad: 'Araucanía', telefono: '+56 45 2123456'
    }
    // generar pdf417
    const idVenta = opts.id_venta || Math.floor(Math.random()*99999)
    const pdf417Base64 = await generatePdf417Base64('SII-Fake-Code-' + idVenta)

    const ventaMeta = { id_venta: idVenta, fecha: new Date().toLocaleString('es-CL'), total: opts.total }

    // logo base64 (opcional)
    let logoBase64 = ''
    try { if (fs.existsSync(empresa.logo || DEFAULT_LOGO)) { const buf = fs.readFileSync(empresa.logo || DEFAULT_LOGO); logoBase64 = buf.toString('base64') } } catch (e) { logoBase64 = '' }

    const ticketBuffer = buildTicketBuffer({ empresa: { ...empresa, logoBase64 }, venta: ventaMeta, detalles: opts.detalles || [], total: opts.total || 0, codepage: opts.codepage || DEFAULT_CODEPAGE, includeLogoBase64: !!opts.includeLogo })

    const ticketBase64 = ticketBuffer.toString('base64')
    const textPreview = iconv.decode(ticketBuffer, opts.codepage || DEFAULT_CODEPAGE)

    // render preview PDF asynchronously (non-blocking from caller perspective — we await here to ensure file created)
    const tmpPdf = path.join(process.env.TEMP || __dirname, `ticket_preview_${Date.now()}.pdf`)
    try { await renderEscposToPdf(ticketBase64, tmpPdf, { pdf417Base64, codepage: opts.codepage || DEFAULT_CODEPAGE, logoPath: empresa.logo || DEFAULT_LOGO }) } catch(e){ console.warn('preview fail', e.message) }

    return { ok: true, venta: ventaMeta, ticketBase64, pdf417Base64, logoBase64, textPreview, previewPath: tmpPdf }
  } catch (err) {
    console.error('generarDTE error', err)
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('imprimirTicket', async (event, payload = {}) => {
  // payload: { ticketBase64, type: 'lan'|'usb'|'pdf-fallback', ip, port, printerName, venta }
  try {
    const { ticketBase64, type = 'auto', ip, port = 9100, printerName, venta, codepage } = payload
    const buffer = Buffer.from(ticketBase64, 'base64')

    // Siempre guardamos preview PDF y XML localmente si venta viene
    const tmpPdf = path.join(process.env.TEMP || __dirname, `ticket_print_${Date.now()}.pdf`)
    try { await renderEscposToPdf(ticketBase64, tmpPdf, { codepage: codepage || DEFAULT_CODEPAGE }) } catch (_) {}
    try { const pdfBuf = fs.existsSync(tmpPdf) ? fs.readFileSync(tmpPdf) : Buffer.alloc(0); const xml = `\n<boleta><empresa>${venta?.empresa || ''}</empresa><id>${venta?.id_venta || ''}</id><total>${venta?.total || ''}</total></boleta>`; await saveBoletaLocally(venta || {}, pdfBuf, xml) } catch (e) { console.warn('save local fail', e.message) }

    if (type === 'lan' && ip) {
      await sendToLan(ip, port, buffer)
      return { ok: true, msg: 'enviado: lan' }
    }

    if (type === 'usb' || type === 'auto') {
      try {
        await printViaUSB(buffer)
        return { ok: true, msg: 'enviado: usb' }
      } catch (e) { /* fallback below */ }
    }

    // fallback: print PDF via pdf-to-printer (windows/mac)
    try {
      await print(tmpPdf, { printer: printerName || null, silent: true })
      return { ok: true, msg: 'impreso via pdf-to-printer (fallback)' }
    } catch (err) {
      console.error('fallback print error', err)
      return { ok: false, error: String(err) }
    }
  } catch (err) {
    console.error('imprimirTicket error', err)
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('listSystemPrinters', async () => {
  try {
    const printers = await getPrinters()
    return printers
  } catch (e) {
    console.warn('listSystemPrinters pdf-to-printer fail', e)
    return []
  }
})

ipcMain.handle('discover-lan-printers', async (event, options = {}) => {
  const startTs = Date.now(); const { ports = [9100], timeoutMs = 1200 } = options
  const interfaces = os.networkInterfaces(); const localBases = new Set()
  for (const name of Object.keys(interfaces)) for (const iface of interfaces[name]) if (iface.family === 'IPv4' && !iface.internal) localBases.add(iface.address.split('.').slice(0,3).join('.'))

  const tasks = []
  for (const base of localBases) for (let i=1;i<=254;i++) tasks.push(`${base}.${i}`)

  const results = []
  const checkPortOpen = (ip, port, timeout = timeoutMs) => new Promise((resolve) => {
    const socket = new net.Socket(); let done=false; socket.setTimeout(timeout)
    socket.once('connect', () => { done=true; socket.destroy(); resolve(true) })
    socket.once('error', ()=>!done && resolve(false))
    socket.once('timeout', ()=>{ !done && socket.destroy(); resolve(false) })
    socket.connect(port, ip)
  })

  for (const ip of tasks) {
    for (const p of ports) {
      const ok = await checkPortOpen(ip, p)
      if (ok) results.push({ ip, port: p })
    }
  }

  return { results, elapsedMs: Date.now() - startTs }
})

// -------------------- FIN --------------------
ipcMain.handle("listUsbDevices", async () => {
  try {
    const list = await getPrinters();
    return list.map(p => ({
      name: p.name,
      isUSB: p.deviceId?.includes("USB") || false,
      status: p.status || "unknown"
    }));
  } catch (err) {
    console.error("list-printers error:", err);
    return [];
  }
});
ipcMain.handle("detectScanners", async () => {
  try {
    // importar usb dinámicamente para no romper si no está instalado
    const usb = require("usb");

    return usb.getDeviceList().map(d => ({
      vendorId: d.deviceDescriptor.idVendor,
      productId: d.deviceDescriptor.idProduct,
      manufacturer: d.deviceDescriptor.iManufacturer,
      product: d.deviceDescriptor.iProduct
    }));
  } catch (err) {
    console.error("usb-devices error:", err);
    return [];
  }
});
ipcMain.handle("printRaw", async (event, base64Data, options = {}) => {
  const { type = "auto", ip, port = 9100, printer, venta, pdf417Base64 } = options;

  try {
    const rawBuffer = Buffer.from(base64Data, "base64");

    const tmpPath = path.join(process.env.TEMP || __dirname, `ticket_${Date.now()}.pdf`);

    // PREVIEW PDF
    try {
      await renderEscposToPdf(base64Data, tmpPath, {
        codepage: DEFAULT_CODEPAGE,
        pdf417Base64
      });
    } catch (err) {
      console.warn("preview PDF fail:", err.message);
    }

    // GUARDAR BOLETA local
    try {
      const pdfBuffer = fs.existsSync(tmpPath) ? fs.readFileSync(tmpPath) : Buffer.from([]);
      const xml = `
        <boleta>
          <empresa>${venta?.empresa || "Empresa"}</empresa>
          <numero>${venta?.id_venta || "000000"}</numero>
          <total>${venta?.total || 0}</total>
          <fecha>${new Date().toLocaleString("es-CL")}</fecha>
        </boleta>
      `;
      await saveBoletaLocally(venta || {}, pdfBuffer, xml);
    } catch (err) {
      console.warn("saveBoleta error:", err.message);
    }

    // ---------------- LAN RAW ----------------
    if (type === "lan" && ip) {
      const sendLan = (ip, port, buffer) =>
        new Promise((resolve, reject) => {
          const socket = new net.Socket();
          socket.setTimeout(5000);

          socket.once("connect", () => {
            socket.write(buffer, () => {
              socket.end();
              resolve(true);
            });
          });

          socket.once("error", reject);
          socket.once("timeout", () => {
            socket.destroy();
            reject(new Error("timeout"));
          });

          socket.connect(port, ip);
        });

      try {
        await sendLan(ip, port, rawBuffer);
        fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath);
        return { ok: true, msg: "Impreso por LAN RAW" };
      } catch (err) {
        console.error("LAN print error:", err);
      }
    }

    // ---------------- USB RAW ----------------
    if (type === "usb" || type === "auto") {
      try {
        const escpos = require("escpos");
        escpos.USB = require("escpos-usb");

        const device = new escpos.USB();
        const printerEsc = new escpos.Printer(device, { encoding: DEFAULT_CODEPAGE });

        await new Promise((resolve, reject) => {
          device.open(() => {
            try {
              if (printerEsc.raw) printerEsc.raw(rawBuffer);
              else printerEsc.write(rawBuffer);

              printerEsc.cut && printerEsc.cut();
              printerEsc.close && printerEsc.close();
              resolve(true);
            } catch (err) {
              reject(err);
            }
          });
        });

        fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath);
        return { ok: true, msg: "Impreso por USB ESC/POS" };
      } catch (err) {
        console.warn("USB ESC/POS fail:", err.message);
      }
    }

    // ---------------- FALLBACK PDF ----------------
    try {
      await print(tmpPath, { printer: printer || null, silent: true });
      fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath);

      return { ok: true, msg: "Impreso por fallback PDF" };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  } catch (err) {
    console.error("print-raw error:", err);
    return { ok: false, error: err.message };
  }
});
// ---- Construir ticket desde datos (devuelve base64 + preview) ----
ipcMain.handle('buildTicket', async (event, sale = {}, opts = {}) => {
  try {
    // sale: { empresa, venta, detalles, total }
    const ticketBuffer = buildTicketBuffer({
      empresa: sale.empresa || {},
      venta: sale.venta || {},
      detalles: sale.detalles || [],
      total: sale.total || 0,
      codepage: opts.codepage || DEFAULT_CODEPAGE,
      includeLogoBase64: !!opts.includeLogo
    });

    const ticketBase64 = ticketBuffer.toString('base64');
    const textPreview = iconv.decode(ticketBuffer, opts.codepage || DEFAULT_CODEPAGE);

    // genera preview PDF opcionalmente
    const tmpPdf = path.join(process.env.TEMP || __dirname, `ticket_preview_${Date.now()}.pdf`);
    try {
      await renderEscposToPdf(ticketBase64, tmpPdf, {
        pdf417Base64: opts.pdf417Base64 || null,
        codepage: opts.codepage || DEFAULT_CODEPAGE,
        logoPath: opts.logoPath || DEFAULT_LOGO
      });
    } catch (e) { /* no crítico */ }

    return { ok: true, ticketBase64, textPreview, previewPath: tmpPdf };
  } catch (err) {
    console.error('buildTicket error', err);
    return { ok: false, error: String(err) };
  }
});

// ---- Imprimir a partir de datos estructurados (preferred) ----
ipcMain.handle('printFromData', async (event, sale = {}, options = {}) => {
  // sale: { empresa, venta, detalles, total }
  // options: { type: 'auto'|'lan'|'usb', ip, port, printerName, codepage, pdf417Base64 }
  const { type = 'auto', ip, port = 9100, printerName, codepage = DEFAULT_CODEPAGE, pdf417Base64 } = options;
  try {
    // 1) Construir buffer ESC/POS desde datos
    const ticketBuffer = buildTicketBuffer({
      empresa: sale.empresa || {},
      venta: sale.venta || {},
      detalles: sale.detalles || [],
      total: sale.total || 0,
      codepage,
      includeLogoBase64: !!sale.empresa?.logoBase64
    });

    // 2) Generar preview PDF y guardar boleta (igual que antes)
    const tmpPdf = path.join(process.env.TEMP || __dirname, `ticket_print_${Date.now()}.pdf`);
    try { await renderEscposToPdf(ticketBuffer.toString('base64'), tmpPdf, { codepage, pdf417Base64 }); } catch(_) {}

    try {
      const pdfBuf = fs.existsSync(tmpPdf) ? fs.readFileSync(tmpPdf) : Buffer.alloc(0);
      const xml = `<boleta><empresa>${sale.empresa?.razonSocial || ''}</empresa><id>${sale.venta?.id_venta || ''}</id><total>${sale.total || 0}</total></boleta>`;
      await saveBoletaLocally(sale.venta || {}, pdfBuf, xml);
    } catch(e) { console.warn('saveBoleta fail', e.message) }

    // 3) Intentar imprimir por el medio indicado (LAN -> USB -> PDF fallback)
    // LAN
    if (type === 'lan' && ip) {
      await sendToLan(ip, port, ticketBuffer);
      fs.existsSync(tmpPdf) && fs.unlinkSync(tmpPdf);
      return { ok: true, msg: 'enviado: lan' };
    }

    // USB (escpos)
    if (type === 'usb' || type === 'auto') {
      try {
        await printViaUSB(ticketBuffer);
        fs.existsSync(tmpPdf) && fs.unlinkSync(tmpPdf);
        return { ok: true, msg: 'enviado: usb' };
      } catch (e) {
        console.warn('printViaUSB failed, will try pdf fallback', e.message || e);
      }
    }

    // Fallback PDF print
    try {
      await print(tmpPdf, { printer: printerName || null, silent: true });
      fs.existsSync(tmpPdf) && fs.unlinkSync(tmpPdf);
      return { ok: true, msg: 'impreso via pdf-to-printer (fallback)' };
    } catch (err) {
      console.error('fallback print error', err);
      return { ok: false, error: String(err) };
    }
  } catch (err) {
    console.error('printFromData error', err);
    return { ok: false, error: String(err) };
  }
});

console.log('Electron printing helper ready')

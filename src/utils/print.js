import { emitirDte } from '../api'

async function connectPrinter() {
  const qz = window.qz
  if (!qz) throw new Error("QZ Tray no está cargado")

  if (!qz.websocket.isActive()) {
    await qz.websocket.connect()
    console.log("Conectado a QZ Tray")
  }
}

export async function imprimirPrueba() {
  try {
    // 1️⃣ pedir ticket al backend
    const resp = await emitirDte({ test: true })
    const { printer, data } = resp.data   // axios devuelve resp.data

    // 2️⃣ conectar QZ
    await connectPrinter()
    const qz = window.qz

    // 3️⃣ usar printer + data del backend
    const config = qz.configs.create(printer)
    await qz.print(config, data)

    return { ok: true }
  } catch (err) {
    console.error("Error al imprimir:", err)
    return { ok: false, error: err.message }
  }
}

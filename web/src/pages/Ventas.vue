<template>
  <div class="p-4">
    <div class="mb-4 flex items-center gap-4">
      <div class="flex items-center gap-2">
        <label class="text-white">Modo venta:</label>
        <select v-model="sessionMode" class="p-2 rounded bg-[#081026] text-white">
          <option value="normal">Normal</option>
          <option value="voucher">Voucher (impresora voucher)</option>
        </select>
      </div>

      <div class="flex items-center gap-2 ml-6">
        <label class="text-white">Tipo impresora:</label>
        <select v-model="printerType" class="p-2 rounded bg-[#081026] text-white">
          <option value="auto">Auto</option>
          <option value="lan">LAN (IP)</option>
          <option value="usb">USB</option>
          <option value="com">COM (serial)</option>
        </select>
      
        <div v-if="printerType === 'lan'" class="flex items-center gap-2">
          <input 
            v-model="printerInfo.ip" 
            placeholder="IP de la impresora" 
            class="p-2 rounded bg-[#081026] text-white" />
          <input 
            v-model.number="printerInfo.port" 
            type="number" 
            class="p-2 w-20 rounded bg-[#081026] text-white" />
          <button @click="discoverLan" :disabled="isScanningLan" class="px-3 py-2 bg-blue-600 rounded text-white">
            {{ isScanningLan ? 'Buscando...' : 'Buscar' }}
          </button>
        </div>

        <div v-if="printerType === 'com'" class="flex items-center gap-2">
          <input 
            v-model="printerInfo.com" 
            placeholder="Ej: COM3" 
            class="p-2 rounded bg-[#081026] text-white" />
        </div>
        <button @click="listPrinters" class="px-3 py-2 bg-[var(--accent)] rounded text-black">Listar</button>
        <button @click="listUsbDevices" class="px-3 py-2 bg-blue-500 rounded text-black">Detectar USB</button>
        <button @click="detectScanners" class="px-3 py-2 bg-gray-600 rounded text-black">Detectar escáneres</button>
      </div>

      <div class="ml-auto flex items-center gap-3">
        <label class="text-white flex items-center gap-1">
          <input type="checkbox" v-model="usarImpresora" />
          Usar impresora
        </label>
      </div>
    </div>

    <div v-if="sessionMode === 'voucher'" class="mb-4 p-4 bg-[var(--panel)] rounded">
      <h4 class="text-white mb-2">Modo Voucher — selecciona impresora o ingresa número</h4>
      <div class="flex gap-2 items-center">
        <input v-model="voucherNumber" placeholder="Escanea o ingresa número voucher"
               class="p-2 bg-[#081026] rounded text-white w-1/3" />
        <button @click="redeemVoucher" class="px-3 py-2 bg-green-500 rounded">Cargar voucher</button>
        <div class="text-sm text-[var(--muted)] ml-4">Dispositivo escáner: {{ connectedScanners.length ? connectedScanners.join(', ') : '—' }}</div>
      </div>
      <div v-if="voucherLoaded" class="mt-3 text-white">
        Voucher cargado: <strong>#{{ voucherLoaded.numero }}</strong> — total: {{ formatPrice(voucherLoaded.total) }}
      </div>
    </div>

    <div class="grid grid-cols-3 gap-6">
      <div class="col-span-2">
        <div class="p-4 bg-[var(--panel)] rounded mb-4">
          <div class="flex items-center gap-3">
            <input
              v-model="scan"
              @keyup.enter="handleScanEnter"
              placeholder="Escanea código o ingresa SKU"
              class="p-2 bg-[#081026] rounded w-1/2 text-white"
            />
            <button @click="handleScanEnter" class="px-3 py-2 bg-[var(--accent)] rounded text-black">Añadir</button>

            <div class="ml-auto flex items-center gap-2">
              <button @click="testPrint" class="px-3 py-2 bg-blue-500 rounded text-black">Probar impresión</button>
              <select v-model="selectedPrinter" class="p-2 rounded bg-[#081026] text-white">
                <option value="">(usar impresora por defecto)</option>
                <option v-for="p in printers" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="p-4 bg-[var(--panel)] rounded">
          <h3 class="mb-2">Productos</h3>
          <input
            v-model="q"
            @input="search"
            placeholder="Buscar productos..."
            class="w-full p-2 mb-3 bg-[#081026] rounded text-white"
          />
          <div class="grid grid-cols-3 gap-3">
            <div v-for="p in productos" :key="p.id_producto" class="p-3 bg-[#071226] rounded">
              <div class="font-medium">{{ p.nombre }}</div>
              <div class="text-sm text-[var(--muted)]">{{ formatPrice(p.precio) }}</div>
              <button class="mt-2 px-2 py-1 bg-[var(--accent)] text-black rounded" @click="addProduct(p)">Añadir</button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="p-4 bg-[var(--panel)] rounded mb-4">
          <h3 class="mb-2">Carrito</h3>

          <div v-for="(it,i) in cart" :key="i" class="flex justify-between py-2 border-b border-gray-800">
            <div class="flex gap-2 items-center">
              <div>{{it.nombre}} x</div>
              <input type="number" min="1" v-model.number="it.cantidad" @change="recalcLine(it)" class="w-16 p-1 rounded bg-[#081026] text-white" />
            </div>
            <div>{{ formatPrice(it.subtotal) }}</div>
          </div>

          <div class="mt-4 text-right font-semibold">Total: {{ formatPrice(total) }}</div>

          <div class="mt-3 flex gap-2">
            <button class="px-3 py-2 rounded bg-green-500" @click="checkout">Pagar</button>
            <button class="px-3 py-2 rounded bg-gray-600" @click="clear">Limpiar</button>
          </div>

          <div v-if="ventaResult && ventaResult.pdf417Base64" class="mt-4">
            <h4 class="text-white mb-2">PDF417 (preview)</h4>
            <img :src="'data:image/png;base64,' + ventaResult.pdf417Base64" class="border border-white" />
          </div>

          <div v-if="ventaResult && !usarImpresora" class="mt-6 p-4 bg-white text-black font-mono text-sm rounded shadow">
            <h4 class="mb-2 font-bold">Ticket (preview)</h4>

            <div v-if="ventaResult.boletaBase64">
              <img :src="`data:image/png;base64,${ventaResult.boletaBase64}`" alt="Boleta" class="border rounded-lg" />
            </div>

            <div v-else>
              <pre>{{ ventaResult && ventaResult.textPreview }}</pre>
            </div>
          </div>
        </div>

        <div class="p-3 bg-[var(--panel)] rounded">
          <div class="text-sm text-[var(--muted)]">Impresoras detectadas: {{ printers.length ? printers.join(', ') : '—' }}</div>
          <div class="text-sm text-[var(--muted)]">USB devices: {{ usbDevices.length ? usbDevices.join(', ') : '—' }}</div>
          <div class="text-sm text-[var(--muted)]">Escáneres: {{ connectedScanners.length ? connectedScanners.join(', ') : '—' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>

import { ref, onMounted, computed } from 'vue'
import { fetchProducts, emitirVenta, fetchVoucher } from '../api'
import { useAuth } from '../composables/useAuth.js'

const { currentUser } = useAuth()

function formatPrice(value) {
  const numberValue = Number(value)
  if (isNaN(numberValue)) return '$0'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(numberValue)
}

const scan = ref('')
const q = ref('')
const productos = ref([])
const cart = ref([])
const printers = ref([])
const selectedPrinter = ref('')
const usarImpresora = ref(true)
const ventaResult = ref(null)

const printerType = ref('auto')
const printerInfo = ref({ ip: '', port: 9100, usb: null, com: null })
const isScanningLan = ref(false)

const usbDevices = ref([])
const connectedScanners = ref([])

const sessionMode = ref('normal')
const voucherNumber = ref('')
const voucherLoaded = ref(null)

async function search() {
  try {
    const r = await fetchProducts(q.value)
    productos.value = r.data ?? r
  } catch (err) {
    productos.value = []
    console.error('search', err)
  }
}

async function listPrinters() {
  try {
    console.log('Listando impresoras (electron)...')
    const list = await window.electronAPI?.listSystemPrinters?.()
    printers.value = Array.isArray(list)
      ? list.map(p => (typeof p === 'string' ? p : p.name || JSON.stringify(p)))
      : []
    console.log('Impresoras:', printers.value)
  } catch (e) {
    console.error('listPrinters', e)
    printers.value = []
  }
}

async function listUsbDevices() {
  try {
    const list = await window.electronAPI?.listUsbDevices?.()
    usbDevices.value = Array.isArray(list)
      ? list.map(d => (d.name || d.product || JSON.stringify(d)))
      : []
    console.log('USB devices:', usbDevices.value)
  } catch (err) {
    console.error('listUsbDevices', err)
    usbDevices.value = []
  }
}

async function detectScanners() {
  try {
    const list = await window.electronAPI?.detectScanners?.()
    connectedScanners.value = Array.isArray(list)
      ? list.map(s => s.product || s.name || JSON.stringify(s))
      : []
    console.log('Scanners:', connectedScanners.value)
  } catch (err) {
    console.error('detectScanners', err)
    connectedScanners.value = []
  }
}

async function handleScanEnter() {
  if (!scan.value) return
  const term = scan.value.trim()
  if (sessionMode.value === 'voucher' && !voucherLoaded.value) {
    voucherNumber.value = term
    await redeemVoucher()
    scan.value = ''
    return
  }
  try {
    const data = await fetchProducts(term)
    const list = data?.data ?? data
    if (list && list.length > 0) addProduct(list[0])
  } catch (err) {
    console.error('handleScanEnter fetchProducts', err)
  } finally {
    scan.value = ''
  }
}

function addProduct(p) {
  const found = cart.value.find(it => it.id_producto === p.id_producto)
  if (found) {
    found.cantidad++
    found.subtotal = found.cantidad * p.precio
  } else {
    cart.value.push({ ...p, cantidad: 1, subtotal: p.precio })
  }
}

function recalcLine(it) { it.subtotal = it.cantidad * it.precio }
function clear() { cart.value = []; ventaResult.value = null; voucherLoaded.value = null; voucherNumber.value = '' }
const total = computed(() => cart.value.reduce((a, b) => a + (b.subtotal || 0), 0))

// ------------------------------------------------------------------
// FUNCIÓN CHECKOUT MODIFICADA PARA INTEGRAR EL SALEFORPRINTER
// ------------------------------------------------------------------
async function checkout() {
  if (cart.value.length === 0) return alert('Carrito vacío')

  // 1. LEER LA SESIÓN DEL STORAGE
  const sessionStr = localStorage.getItem('session')
  if (!sessionStr) return alert('Sesión expirada, reinicia login')
  
  const session = JSON.parse(sessionStr)
  const user = currentUser.value ?? {}
  // AQUÍ SACAMOS LOS DATOS GUARDADOS DE LA EMPRESA
  const empresa = session.empresa || {} 

  const detallesPayload = cart.value.map(i => ({
    id_producto: i.id_producto,
    cantidad: i.cantidad,
    precio_unitario: i.precio,
    nombre: i.nombre
  }))

  const payload = {
    id_usuario: user.id || 1,
    id_empresa: user.empresaId ?? user.id_empresa ?? 1,
    total: total.value,
    detalles: detallesPayload,
    pagos: [{ id_pago: 1, monto: total.value }],
    usarImpresora: usarImpresora.value,
    printerType: printerType.value,
    printerInfo: printerInfo.value,
    voucher: voucherLoaded.value ? { numero: voucherLoaded.value.numero, id: voucherLoaded.value.id } : null
  }

  try {
    const resp = await emitirVenta(payload)
    const data = resp?.data ?? resp 
    
    if (!data) { alert('Respuesta inválida del backend'); return }

    ventaResult.value = data

    const saleForPrinter = {
      empresa: {
          razonSocial: empresa.nombre || empresa.razonSocial || 'Sin Nombre',
          rut: empresa.rut || 'Sin Rut',
          direccion: empresa.direccion || '',
          ciudad: empresa.ciudad || '',
          telefono: empresa.telefono || ''
          // logo: empresa.logoUrl ... 
      },
      venta: { 
         id_venta: data.venta?.id_venta || data.id_venta || 'PENDIENTE',
         fecha: new Date().toLocaleString('es-CL'),
         timbre: data.timbre || null 
      },
      detalles: cart.value.map(i => ({
         nombre: i.nombre,
         cantidad: i.cantidad,
         precio_unitario: i.precio,
         subtotal: i.precio * i.cantidad
      })),
      total: total.value
    }

    if (window.electronAPI?.printFromData) {
      try {
        const content417 = data.timbre || `VENTA-${saleForPrinter.venta.id_venta}`;
        const options = {
          type: printerType.value,
          ip: printerInfo.value.ip,
          port: printerInfo.value.port,
          printerName: selectedPrinter.value || null,
          content417: content417 
        }
        
        const r = await window.electronAPI.printFromData(saleForPrinter, options)
        console.log('printFromData:', r)
        
        if (r?.ok) {
          alert('Venta emitida e impresa (electron).')
          cart.value = []
          return
        } else {
          console.warn('printFromData respuesta negativa, fallback:', r)
        }
      } catch (err) {
        console.error('Error printFromData', err)
      }
    }

    const ticketBase64 = data?.ticketBase64 || data?.ticket?.ticketBase64 || data?.ticket?.boletaBase64
    if (ticketBase64 && window.electronAPI?.printRaw) {
      try {
        const options = {
          type: printerType.value,
          ip: printerInfo.value.ip,
          port: printerInfo.value.port,
          printer: selectedPrinter.value || null
        }
        const r2 = await window.electronAPI.printRaw(ticketBase64, options)
        if (r2?.ok) {
          alert('Venta emitida e impresa (fallback printRaw).')
          cart.value = []
          return
        }
      } catch (err) {
        console.error('fallback printRaw error', err)
      }
    }

    alert('Venta emitida. Preview disponible en la UI.')
    cart.value = []
  } catch (err) {
    console.error('checkout error', err)
    alert('Error al procesar venta')
  }
}

function hexToBase64(hex) {
  const bytes = []
  for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16))
  const bin = String.fromCharCode(...bytes)
  return btoa(bin)
}

async function testPrint() {
  try {
    const demoSale = {
      empresa: { razonSocial: 'Demo S.A.', rut: '99.999.999-9', direccion: 'Demo 123', comuna: 'Demo', ciudad: 'Demo' },
      venta: { id_venta: 'TEST-001', fecha: new Date().toLocaleString('es-CL') },
      detalles: [
        { id_producto: 1, nombre: 'Producto A', cantidad: 1, precio_unitario: 1200, subtotal: 1200 },
        { id_producto: 2, nombre: 'Producto B', cantidad: 2, precio_unitario: 800, subtotal: 1600 }
      ],
      total: 1200 + 1600
    }

    if (window.electronAPI?.printFromData) {
      const options = { 
         type: printerType.value, 
         ip: printerInfo.value.ip, 
         port: printerInfo.value.port, 
         printerName: selectedPrinter.value || null,
         content417: "TEST-PDF417-CONTENT" 
      }
      const r = await window.electronAPI.printFromData(demoSale, options)
      console.log('test printFromData:', r)
      alert('Intento de impresión de prueba enviado (printFromData). Revisa consola.')
      return
    }
  } catch (err) {
    console.error("Error al imprimir test:", err)
    alert("Error al imprimir. Revisa consola.")
  }
}

async function redeemVoucher() {
  if (!voucherNumber.value) return alert('Ingresa número voucher')
  try {
    const resp = await fetchVoucher(voucherNumber.value)
    const data = resp?.data ?? resp
    if (!data || !data.items) { alert('Voucher no válido'); return }
    cart.value = data.items.map(it => ({
      id_producto: it.id_producto,
      nombre: it.nombre,
      precio: it.precio_unitario,
      cantidad: it.cantidad || 1,
      subtotal: (it.cantidad || 1) * it.precio_unitario
    }))
    voucherLoaded.value = data
    alert('Voucher cargado')
  } catch (err) {
    console.error('redeemVoucher', err)
    alert('Error al cargar voucher')
  }
}

async function discoverLan() {
  if (isScanningLan.value) return
  isScanningLan.value = true
  console.log('Iniciando descubrimiento LAN (FULL SCAN)...')

  try {
    const scanOptions = {
      ports: [printerInfo.value.port || 9100],
      timeoutMs: 1200
    }

    const resp = await window.electronAPI?.discoverLanPrinters?.(scanOptions)
    const results = resp?.results ?? resp
    if (Array.isArray(results) && results.length > 0) {
      printerInfo.value.ip = results[0].ip
      printerType.value = 'lan'
      alert(`Impresora encontrada y configurada en: ${results[0].ip}`)
    } else {
      alert('No se encontraron impresoras LAN. Revisa firewall/red.')
    }
  } catch (err) {
    console.error('Error en discoverLan:', err)
    alert(`Error al buscar impresoras: ${err?.message || err}`)
  } finally {
    isScanningLan.value = false
  }
}

onMounted(() => {
  search()
  listPrinters()
  listUsbDevices()
  detectScanners()
})
</script>

<style scoped>

</style>
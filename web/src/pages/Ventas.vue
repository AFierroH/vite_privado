<template>
  <div class="p-4 h-full flex flex-col">
    <div class="mb-4 flex flex-wrap items-center gap-4 bg-[var(--panel)] p-3 rounded border border-gray-800">
      
      <div class="flex items-center gap-2">
        <label class="text-white font-bold text-sm">Modo:</label>
        <select v-model="sessionMode" class="p-2 rounded bg-[#081026] text-white border border-gray-700 text-sm">
          <option value="normal">Normal</option>
          <option value="voucher">Voucher</option>
        </select>
      </div>

      <div class="flex items-center gap-2 border-l border-gray-700 pl-4">
        <label class="text-white font-bold text-sm">Impresora:</label>
        <select v-model="printerType" class="p-2 rounded bg-[#081026] text-white border border-gray-700 text-sm">
          <option value="usb">USB (Directo)</option>
          <option value="lan">Red (LAN)</option>
        </select>
      
        <div v-if="printerType === 'lan'" class="flex items-center gap-2">
          <input v-model="printerInfo.ip" placeholder="IP (ej: 192.168.1.87)" class="p-2 w-32 rounded bg-[#081026] text-white text-sm border border-gray-700" />
          <input v-model.number="printerInfo.port" type="number" placeholder="9100" class="p-2 w-16 rounded bg-[#081026] text-white text-sm border border-gray-700" />
        </div>

        <div v-if="printerType === 'usb'" class="flex items-center gap-2">
           <select v-model="selectedUsbDevice" class="p-2 w-64 rounded bg-[#081026] text-white text-sm border border-gray-700">
              <option :value="null">-- Seleccionar Dispositivo --</option>
              <option v-for="(dev, idx) in usbDevices" :key="idx" :value="dev">
                 {{ dev.name }}
              </option>
           </select>
           <button @click="listUsbDevices" class="p-2 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm" title="Recargar lista USB">
             🔄
           </button>
        </div>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <label class="flex items-center cursor-pointer">
          <div class="relative">
            <input type="checkbox" v-model="usarImpresora" class="sr-only">
            <div class="block bg-gray-600 w-10 h-6 rounded-full" :class="{'bg-green-500': usarImpresora}"></div>
            <div class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition" :class="{'transform translate-x-full': usarImpresora}"></div>
          </div>
          <div class="ml-3 text-white text-sm font-medium">Imprimir Ticket</div>
        </label>
      </div>
    </div>

    <div v-if="sessionMode === 'voucher'" class="mb-4 p-4 bg-[var(--panel)] rounded border border-gray-700">
      <h4 class="text-white mb-2">Cargar Voucher</h4>
      <div class="flex gap-2">
        <input v-model="voucherNumber" placeholder="Escanea o ingresa código" class="p-2 bg-[#081026] rounded text-white flex-1 border border-gray-700" />
        <button @click="redeemVoucher" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold">Cargar</button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
      
      <div class="lg:col-span-2 flex flex-col overflow-hidden">
         <div class="p-4 bg-[var(--panel)] rounded mb-4 flex gap-2">
            <input v-model="scan" @keyup.enter="handleScanEnter" placeholder="Código de barras / SKU" class="flex-1 p-3 bg-[#081026] rounded text-white border border-gray-700 text-lg" />
            <button @click="handleScanEnter" class="px-6 bg-[var(--accent)] text-black font-bold rounded">AÑADIR</button>
         </div>

         <div class="p-4 bg-[var(--panel)] rounded flex-1 flex flex-col overflow-hidden">
             <input v-model="q" @input="search" placeholder="Buscar por nombre..." class="w-full p-2 mb-3 bg-[#081026] rounded text-white border border-gray-700" />
             
             <div class="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 content-start">
                <div v-for="p in productos" :key="p.id_producto" 
                     class="p-3 bg-[#0f172a] hover:bg-[#1e293b] border border-gray-800 rounded cursor-pointer transition-colors flex flex-col justify-between h-24"
                     @click="addProduct(p)">
                    <div class="font-bold text-sm text-gray-200 line-clamp-2">{{ p.nombre }}</div>
                    <div class="text-[var(--accent)] font-mono text-right">{{ formatPrice(p.precio) }}</div>
                </div>
             </div>
         </div>
      </div>

      <div class="bg-[var(--panel)] rounded flex flex-col h-full border border-gray-800">
         <div class="p-4 border-b border-gray-700 bg-[#0b1221] rounded-t">
             <h3 class="font-bold text-white text-lg">Detalle de Venta</h3>
         </div>

         <div class="flex-1 overflow-y-auto p-2">
             <div v-if="cart.length === 0" class="h-full flex items-center justify-center text-gray-500 italic">
                 Carrito vacío
             </div>
             <div v-else v-for="(it,i) in cart" :key="i" class="flex justify-between items-center p-2 mb-1 bg-[#0f172a] rounded border border-gray-800">
                 <div class="flex-1">
                     <div class="text-sm text-white font-medium">{{ it.nombre }}</div>
                     <div class="text-xs text-gray-400 flex items-center gap-2">
                         <span>{{ formatPrice(it.precio) }}</span>
                         <span class="text-gray-600">x</span>
                         <input type="number" v-model.number="it.cantidad" min="1" class="w-12 bg-[#081026] text-center border border-gray-700 rounded text-white" @change="it.subtotal = it.cantidad * it.precio">
                     </div>
                 </div>
                 <div class="text-right">
                     <div class="font-bold text-[var(--accent)]">{{ formatPrice(it.subtotal) }}</div>
                     <button @click="cart.splice(i, 1)" class="text-xs text-red-400 hover:text-red-300 mt-1">Eliminar</button>
                 </div>
             </div>
         </div>

         <div class="p-4 bg-[#0b1221] border-t border-gray-700 rounded-b">
             <div class="flex justify-between items-end mb-4">
                 <span class="text-gray-400">Total a Pagar</span>
                 <span class="text-3xl font-bold text-white">{{ formatPrice(total) }}</span>
             </div>
             
             <div class="grid grid-cols-2 gap-3">
                 <button @click="clear" class="py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded font-bold transition">CANCELAR</button>
                 <button @click="checkout" class="py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold shadow-lg transition transform active:scale-95">PAGAR</button>
             </div>
             
             <div class="mt-3 text-center">
                 <button @click="testPrint" class="text-xs text-gray-500 hover:text-gray-300 underline">Prueba de Impresión</button>
             </div>
         </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { fetchProducts, emitirVenta, fetchVoucher } from '../api'
import { useAuth } from '../composables/useAuth.js'

const { currentUser } = useAuth()

// --- ESTADO & PERSISTENCIA IMPRESORA ---
const savedConfig = JSON.parse(localStorage.getItem('printer_config') || '{}')
const printerType = ref(savedConfig.type || 'usb')
const printerInfo = ref(savedConfig.info || { ip: '', port: 9100 })
const usarImpresora = ref(savedConfig.active !== undefined ? savedConfig.active : true)
const usbDevices = ref([])
const selectedUsbDevice = ref(null)

// Guardar config automáticamente
watch([printerType, printerInfo, usarImpresora, selectedUsbDevice], () => {
  localStorage.setItem('printer_config', JSON.stringify({
      type: printerType.value,
      info: printerInfo.value,
      active: usarImpresora.value,
      lastUsbVid: selectedUsbDevice.value?.vid,
      lastUsbPid: selectedUsbDevice.value?.pid
  }))
}, { deep: true })

// --- DATA VENTA ---
const scan = ref('')
const q = ref('')
const productos = ref([])
const cart = ref([])
const sessionMode = ref('normal')
const voucherNumber = ref('')

// --- FUNCIONES ---
function formatPrice(val) { return new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP'}).format(val||0) }

async function listUsbDevices() {
    if (!window.electronAPI?.listUsbDevices) return
    try {
        const list = await window.electronAPI.listUsbDevices()
        usbDevices.value = list
        // Auto-seleccionar si ya estaba guardado
        if (savedConfig.lastUsbVid && savedConfig.lastUsbPid) {
            const found = list.find(d => d.vid === savedConfig.lastUsbVid && d.pid === savedConfig.lastUsbPid)
            if (found) selectedUsbDevice.value = found
        }
    } catch(e) { console.error(e) }
}

async function search() {
    try {
        const r = await fetchProducts(q.value)
        productos.value = r.data ?? r
    } catch(e) { productos.value = [] }
}

function addProduct(p) {
    const exist = cart.value.find(i => i.id_producto === p.id_producto)
    if (exist) { exist.cantidad++; exist.subtotal = exist.cantidad * exist.precio }
    else { cart.value.push({ ...p, cantidad: 1, subtotal: p.precio }) }
}

function clear() { cart.value = [] }
const total = computed(() => cart.value.reduce((a,b) => a + (b.subtotal||0), 0))

// --- CHECKOUT ---
async function checkout() {
    if (cart.value.length === 0) return alert('Carrito vacío')
    
    // Datos básicos
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    const user = currentUser.value || {}
    const empresa = session.empresa || {}

    // Payload Backend
    const payload = {
        id_usuario: user.id || 1,
        id_empresa: user.empresaId || 1,
        total: total.value,
        detalles: cart.value.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad, precio_unitario: i.precio, nombre: i.nombre })),
        pagos: [{ id_pago: 1, monto: total.value }],
        usarImpresora: usarImpresora.value
    }

    try {
        // 1. Guardar en Backend
        const resp = await emitirVenta(payload)
        const data = resp?.data ?? resp
        if (!data) throw new Error("Sin respuesta del servidor")

        // 2. Imprimir (Si corresponde)
        if (usarImpresora.value && window.electronAPI?.printFromData) {
            const printData = {
                empresa: { 
                    razonSocial: empresa.nombre || 'Sin Nombre', 
                    rut: empresa.rut || '', 
                    direccion: empresa.direccion || '',
                    // logo_url se usa desde el caché de electron
                },
                venta: { id_venta: data.venta?.id_venta || data.id_venta || '---', fecha: new Date().toLocaleString() },
                detalles: payload.detalles.map(d => ({ ...d, subtotal: d.cantidad * d.precio_unitario })),
                total: total.value
            }
            
            const opts = {
                type: printerType.value,
                ip: printerInfo.value.ip,
                port: printerInfo.value.port,
                // AQUÍ ESTÁ LA MAGIA: Enviamos VID/PID explícitos
                vid: selectedUsbDevice.value?.vid,
                pid: selectedUsbDevice.value?.pid,
                content417: data.timbre || `VENTA-${data.id_venta}`
            }

            const r = await window.electronAPI.printFromData(printData, opts)
            if (!r.ok) alert('Venta OK, pero error impresora: ' + r.error)
        }

        cart.value = []
        alert('Venta Finalizada Correctamente')

    } catch (e) {
        console.error(e)
        alert('Error en venta: ' + (e.message || e))
    }
}

// Test rápido
async function testPrint() {
    if (!window.electronAPI?.printFromData) return alert('Electron no disponible')
    const dummy = {
        empresa: { razonSocial: 'TEST POS', rut: '1-9', direccion: 'Dirección Prueba' },
        venta: { id_venta: 'TEST-001', fecha: new Date().toLocaleString() },
        detalles: [{ nombre: 'Producto Test', cantidad: 1, precio_unitario: 1000, subtotal: 1000 }],
        total: 1000
    }
    const r = await window.electronAPI.printFromData(dummy, {
        type: printerType.value,
        ip: printerInfo.value.ip,
        port: printerInfo.value.port,
        vid: selectedUsbDevice.value?.vid,
        pid: selectedUsbDevice.value?.pid,
        content417: 'TEST'
    })
    if(!r.ok) alert(r.error)
}

// Listeners
async function handleScanEnter() {
    if(!scan.value) return
    try {
        const r = await fetchProducts(scan.value)
        const list = r.data ?? r
        if (list && list.length > 0) addProduct(list[0])
    } catch(e){}
    scan.value = ''
}

onMounted(() => {
    search()
    listUsbDevices()
})
</script>
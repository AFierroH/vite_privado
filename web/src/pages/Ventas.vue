<template>
  <div class="p-4 h-full flex flex-col">
    <div class="mb-4 flex flex-wrap items-center gap-4 bg-[var(--panel)] p-3 rounded border border-[var(--border)] transition-colors">
      
      <div class="flex items-center gap-2">
        <label class="font-bold text-sm text-[var(--text-primary)]">Modo:</label>
        <select v-model="sessionMode" class="p-2 rounded bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--border)] text-sm outline-none focus:border-[var(--accent)]">
          <option value="normal">Normal</option>
          <option value="voucher">Voucher</option>
        </select>
      </div>

      <div class="flex items-center gap-2 border-l border-[var(--border)] pl-4">
        <label class="font-bold text-sm text-[var(--text-primary)]">Impresora:</label>
        <select v-model="printerType" class="p-2 rounded bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--border)] text-sm outline-none focus:border-[var(--accent)]">
          <option value="usb">USB</option>
          <option value="lan">LAN</option>
        </select>
      
        <div v-if="printerType === 'lan'" class="flex items-center gap-2">
          <input v-model="printerInfo.ip" placeholder="IP" class="p-2 w-32 rounded bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--border)] text-sm outline-none focus:border-[var(--accent)]" />
          <input v-model.number="printerInfo.port" type="number" placeholder="9100" class="p-2 w-16 rounded bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--border)] text-sm outline-none focus:border-[var(--accent)]" />
        </div>

        <div v-if="printerType === 'usb'" class="flex items-center gap-2">
           <select v-model="selectedUsbDevice" class="p-2 w-64 rounded bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--border)] text-sm outline-none focus:border-[var(--accent)]">
              <option :value="null">-- Seleccionar --</option>
              <option v-for="(dev, idx) in usbDevices" :key="idx" :value="dev">{{ dev.name }}</option>
           </select>
           <button @click="listUsbDevices" class="p-2 bg-[var(--accent)] text-[var(--text-on-accent)] rounded hover:opacity-90 transition" title="Recargar">
             🔄
           </button>
        </div>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <label class="flex items-center cursor-pointer select-none">
          <div class="relative">
            <input type="checkbox" v-model="usarImpresora" class="sr-only">
            <div class="block w-10 h-6 rounded-full bg-gray-300 dark:bg-gray-700" :class="{'!bg-green-500': usarImpresora}"></div>
            <div class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition" :class="{'translate-x-4': usarImpresora}"></div>
          </div>
          <div class="ml-2 text-sm font-medium text-[var(--text-primary)]">Ticket</div>
        </label>
      </div>
    </div>

    <div v-if="sessionMode === 'voucher'" class="mb-4 p-4 bg-[var(--panel)] rounded border border-[var(--border)] transition-colors">
      <h4 class="mb-2 text-[var(--text-primary)] font-bold">Cargar Voucher</h4>
      <div class="flex gap-2">
        <input v-model="voucherNumber" placeholder="Escanea o ingresa código" class="p-2 bg-[var(--input-bg)] text-[var(--text-primary)] rounded flex-1 border border-[var(--border)] outline-none focus:border-[var(--accent)]" />
        <button @click="redeemVoucher" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold">Cargar</button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
      
      <div class="lg:col-span-2 flex flex-col overflow-hidden">
         <div class="p-4 bg-[var(--panel)] rounded mb-4 flex gap-2 border border-[var(--border)] transition-colors">
            <input v-model="scan" @keyup.enter="handleScanEnter" placeholder="Código de barras / SKU" class="flex-1 p-3 bg-[var(--input-bg)] text-[var(--text-primary)] rounded border border-[var(--border)] text-lg outline-none focus:border-[var(--accent)] placeholder-gray-500" />
            <button @click="handleScanEnter" class="px-6 bg-[var(--accent)] text-[var(--text-on-accent)] font-bold rounded hover:opacity-90">AÑADIR</button>
         </div>

         <div class="p-4 bg-[var(--panel)] rounded flex-1 flex flex-col overflow-hidden border border-[var(--border)] transition-colors">
             <input v-model="q" @input="search" placeholder="Buscar por nombre..." class="w-full p-2 mb-3 bg-[var(--input-bg)] text-[var(--text-primary)] rounded border border-[var(--border)] outline-none focus:border-[var(--accent)] placeholder-gray-500" />
             
             <div class="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 content-start">
                <div v-for="p in productos" :key="p.id_producto" 
                     class="p-3 bg-[var(--bg-deep)] border border-[var(--border)] rounded cursor-pointer hover:border-[var(--accent)] transition-colors flex flex-col justify-between h-24"
                     @click="addProduct(p)">
                    <div class="font-bold text-sm text-[var(--text-primary)] line-clamp-2">{{ p.nombre }}</div>
                    <div class="text-[var(--accent)] font-mono text-right font-bold">{{ formatPrice(p.precio) }}</div>
                </div>
             </div>
         </div>
      </div>

      <div class="bg-[var(--panel)] rounded flex flex-col h-full border border-[var(--border)] transition-colors">
         <div class="p-4 border-b border-[var(--border)]">
             <h3 class="font-bold text-lg text-[var(--text-primary)]">Ticket de Venta</h3>
         </div>

         <div class="flex-1 overflow-y-auto p-2">
             <div v-if="cart.length === 0" class="h-full flex items-center justify-center text-[var(--text-secondary)] italic">
                 Carrito vacío
             </div>
             <div v-else v-for="(it,i) in cart" :key="i" class="flex justify-between items-center p-2 mb-1 bg-[var(--bg-deep)] rounded border border-[var(--border)]">
                 <div class="flex-1">
                     <div class="text-sm font-medium text-[var(--text-primary)]">{{ it.nombre }}</div>
                     <div class="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                         <span>{{ formatPrice(it.precio) }}</span>
                         <span>x</span>
                         <input type="number" v-model.number="it.cantidad" min="1" class="w-12 bg-[var(--input-bg)] text-[var(--text-primary)] text-center border border-[var(--border)] rounded focus:border-[var(--accent)] outline-none" @change="it.subtotal = it.cantidad * it.precio">
                     </div>
                 </div>
                 <div class="text-right">
                     <div class="font-bold text-[var(--accent)]">{{ formatPrice(it.subtotal) }}</div>
                     <button @click="cart.splice(i, 1)" class="text-xs text-red-500 hover:text-red-600 mt-1 font-medium">Eliminar</button>
                 </div>
             </div>
         </div>

         <div class="p-4 border-t border-[var(--border)] bg-[var(--panel)] rounded-b">
             <div class="flex justify-between items-end mb-4">
                 <span class="text-[var(--text-secondary)] font-medium">Total a Pagar</span>
                 <span class="text-3xl font-bold text-[var(--text-primary)]">{{ formatPrice(total) }}</span>
             </div>
             
             <div class="grid grid-cols-2 gap-3">
                 <button @click="clear" class="py-3 bg-gray-600 hover:bg-gray-500 text-white rounded font-bold transition">CANCELAR</button>
                 <button @click="checkout" class="py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold shadow-lg transition transform active:scale-95">PAGAR</button>
             </div>
             
             <div class="mt-3 text-center">
                 <button @click="testPrint" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline">Prueba de Impresión</button>
             </div>
         </div>
      </div>

    </div>
  </div>
</template>

<script setup>
// ... TU JAVASCRIPT SE QUEDA EXACTAMENTE IGUAL QUE ANTES ...
// Solo cambia la parte visual (<template>)
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

watch([printerType, printerInfo, usarImpresora, selectedUsbDevice], () => {
  localStorage.setItem('printer_config', JSON.stringify({
      type: printerType.value,
      info: printerInfo.value,
      active: usarImpresora.value,
      lastUsbVid: selectedUsbDevice.value?.vid,
      lastUsbPid: selectedUsbDevice.value?.pid
  }))
}, { deep: true })

const scan = ref('')
const q = ref('')
const productos = ref([])
const cart = ref([])
const sessionMode = ref('normal')
const voucherNumber = ref('')

function formatPrice(val) { return new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP'}).format(val||0) }

async function listUsbDevices() {
    if (!window.electronAPI?.listUsbDevices) return
    try {
        const list = await window.electronAPI.listUsbDevices()
        usbDevices.value = list
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

async function checkout() {
    if (cart.value.length === 0) return alert('Carrito vacío')
    
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    const user = currentUser.value || {}
    const empresa = session.empresa || {}

    const payload = {
        id_usuario: user.id || 1,
        id_empresa: user.empresaId || 1,
        total: total.value,
        detalles: cart.value.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad, precio_unitario: i.precio, nombre: i.nombre })),
        pagos: [{ id_pago: 1, monto: total.value }],
        usarImpresora: usarImpresora.value
    }

    try {
        const resp = await emitirVenta(payload)
        const data = resp?.data ?? resp
        if (!data) throw new Error("Sin respuesta del servidor")

        if (usarImpresora.value && window.electronAPI?.printFromData) {
            const printData = {
                empresa: { 
                    razonSocial: empresa.nombre || 'Sin Nombre', 
                    rut: empresa.rut || '', 
                    direccion: empresa.direccion || '',
                },
                venta: { id_venta: data.venta?.id_venta || data.id_venta || '---', fecha: new Date().toLocaleString() },
                detalles: payload.detalles.map(d => ({ ...d, subtotal: d.cantidad * d.precio_unitario })),
                total: total.value
            }
            
            const opts = {
                type: printerType.value,
                ip: printerInfo.value.ip,
                port: printerInfo.value.port,
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
<template>
  <div class="p-4 h-full flex flex-col bg-[var(--bg-deep)] text-[var(--text-primary)] transition-colors">
    
    <div class="mb-4 flex flex-wrap items-center gap-4 bg-[var(--panel)] p-3 rounded border border-[var(--border)] shadow-sm">
      
      <div class="flex items-center gap-2">
        <label class="font-bold text-sm text-[var(--text-secondary)]">Modo</label>
        <select v-model="sessionMode" class="p-2 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none focus:border-[var(--accent)] transition-colors">
          <option value="normal">Normal</option>
          <option value="voucher">Voucher</option>
        </select>
      </div>

      <div class="flex items-center gap-2 border-l border-[var(--border)] pl-4">
        <label class="font-bold text-sm text-[var(--text-secondary)]">Impresora</label>
        <select v-model="printerType" class="p-2 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none focus:border-[var(--accent)] transition-colors">
          <option value="usb">USB</option>
          <option value="lan">LAN</option>
        </select>
      
        <div v-if="printerType === 'lan'" class="flex items-center gap-2">
          <input v-model="printerInfo.ip" placeholder="IP" class="p-2 w-32 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none focus:border-[var(--accent)] transition-colors" />
          <input v-model.number="printerInfo.port" type="number" placeholder="9100" class="p-2 w-16 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none focus:border-[var(--accent)] transition-colors" />
        </div>

        <div v-if="printerType === 'usb'" class="flex items-center gap-2">
           <select v-model="selectedUsbDevice" class="p-2 w-48 md:w-64 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none focus:border-[var(--accent)] transition-colors">
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
          <div class="ml-2 text-sm font-medium">Imprimir</div>
        </label>
      </div>
    </div>

    <div v-if="sessionMode === 'voucher'" class="mb-4 p-4 bg-[var(--panel)] rounded border border-[var(--border)] shadow-sm">
      <h4 class="mb-2 font-bold">Cargar Voucher</h4>
      <div class="flex gap-2">
        <input v-model="voucherNumber" placeholder="Escanea o ingresa código" class="p-2 bg-[var(--input-bg)] rounded flex-1 border border-[var(--input-border)] outline-none focus:border-[var(--accent)] transition-colors" />
        <button @click="redeemVoucher" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold">Cargar</button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden pb-1">
      
      <div class="lg:col-span-2 flex flex-col overflow-hidden">
         <div class="p-4 bg-[var(--panel)] rounded mb-4 flex gap-2 border border-[var(--border)] shadow-sm">
            <input v-model="scan" @keyup.enter="handleScanEnter" placeholder="Código de barras / SKU (Enter para agregar)" class="flex-1 p-3 bg-[var(--input-bg)] rounded border border-[var(--input-border)] text-lg outline-none focus:border-[var(--accent)] transition-colors" />
            <button @click="handleScanEnter" class="px-6 bg-[var(--accent)] text-[var(--text-on-accent)] font-bold rounded hover:opacity-90 transition shadow">AÑADIR</button>
         </div>

         <div class="p-4 bg-[var(--panel)] rounded flex-1 flex flex-col overflow-hidden border border-[var(--border)] shadow-sm relative">
             <input v-model="q" @input="search" placeholder="Buscar producto por nombre..." class="w-full p-2 mb-3 bg-[var(--input-bg)] rounded border border-[var(--input-border)] outline-none focus:border-[var(--accent)] transition-colors" />
             
             <div v-if="isLoading" class="absolute inset-0 top-[60px] bg-[var(--panel)]/80 backdrop-blur-sm flex items-center justify-center z-10">
                <svg class="animate-spin h-8 w-8 text-[var(--accent)]" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             </div>

             <div class="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 content-start pr-2 custom-scroll">
                <div v-for="p in productos" :key="p.id_producto" 
                     class="p-3 bg-[var(--bg-deep)] border border-[var(--border)] rounded cursor-pointer hover:border-[var(--accent)] transition-all flex flex-col justify-between h-24 group active:scale-95"
                     @click="addProduct(p)">
                    <div class="font-bold text-sm line-clamp-2 group-hover:text-[var(--accent)]">{{ p.nombre }}</div>
                    <div class="text-[var(--text-secondary)] font-mono text-right font-bold group-hover:text-[var(--text-primary)]">{{ formatPrice(p.precio) }}</div>
                </div>
             </div>
         </div>
      </div>

      <div class="bg-[var(--panel)] rounded flex flex-col h-full border border-[var(--border)] shadow-sm overflow-hidden">
         <div class="p-4 border-b border-[var(--border)] bg-[var(--bg-deep)]">
             <h3 class="font-bold text-lg">Ticket Actual</h3>
         </div>

         <div class="flex-1 overflow-y-auto p-2 custom-scroll">
             <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] italic opacity-50">
                 <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                 Carrito vacío
             </div>
             
             <div v-else v-for="(it,i) in cart" :key="i" class="flex justify-between items-center p-2 mb-1 bg-[var(--bg-deep)] rounded border border-[var(--border)] group">
                 <div class="flex-1 pr-2">
                     <div class="text-sm font-medium leading-tight">{{ it.nombre }}</div>
                     <div class="text-xs text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                         <span>{{ formatPrice(it.precio) }}</span>
                         <span>x</span>
                         <input type="number" v-model.number="it.cantidad" min="1" class="w-12 bg-[var(--input-bg)] text-center border border-[var(--input-border)] rounded text-[var(--text-primary)] focus:border-[var(--accent)] outline-none h-6" @change="it.subtotal = it.cantidad * it.precio">
                     </div>
                 </div>
                 <div class="text-right flex flex-col items-end">
                     <div class="font-bold text-[var(--text-primary)]">{{ formatPrice(it.subtotal) }}</div>
                     <button @click="cart.splice(i, 1)" class="text-[10px] text-red-500 hover:text-red-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wide">Eliminar</button>
                 </div>
             </div>
         </div>

         <div class="p-4 border-t border-[var(--border)] bg-[var(--panel)]">
             <div class="flex justify-between items-end mb-4">
                 <span class="text-[var(--text-secondary)] font-medium uppercase text-xs tracking-wider">Total a Pagar</span>
                 <span class="text-3xl font-bold text-[var(--accent)]">{{ formatPrice(total) }}</span>
             </div>
             
             <div class="grid grid-cols-3 gap-2">
                 <button @click="clear" class="col-span-1 py-3 bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 rounded font-bold transition">LIMPIAR</button>
                 <button @click="checkout" class="col-span-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold shadow-lg transition transform active:scale-[0.98] flex items-center justify-center gap-2">
                    <span>PAGAR</span>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                 </button>
             </div>
             
             <div class="mt-2 text-center">
                 <button @click="testPrint" class="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline">Prueba Hardware</button>
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
const isLoading = ref(false) 

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
    const tInicio = performance.now()
    isLoading.value = true

    const session = JSON.parse(localStorage.getItem('session') || '{}')
    const myEmpresaId = session.user?.id_empresa || 1; // Fallback a 1 si falla
    try {
        const r = await fetchProducts(q.value, myEmpresaId)
        productos.value = r.data ?? r ?? []
    } catch(e) { 
        productos.value = [] 
    } finally {
        isLoading.value = false
    }
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

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
</style>
<template>
  <div class="p-4 h-full flex flex-col bg-[var(--bg-deep)] text-[var(--text-primary)]">
    
    <div class="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg mb-4 border border-yellow-500">
        <h2 class="text-xl font-bold text-yellow-800 dark:text-yellow-200">🛠️ MODO PRUEBAS SII</h2>
        <p class="text-sm">Selecciona los productos del caso, elige el número de CASO y dale a emitir.</p>
        
        <div class="mt-3 flex gap-4 items-center">
            <label class="font-bold">Caso SII:</label>
            <select v-model="casoSeleccionado" class="p-2 rounded bg-white dark:bg-black border border-gray-400">
                <option value="">-- Normal --</option>
                <option value="CASO-1">CASO-1 (Aceite)</option>
                <option value="CASO-2">CASO-2 (Papel)</option>
                <option value="CASO-3">CASO-3 (Sandwic)</option>
                <option value="CASO-4">CASO-4 (Exento)</option>
                <option value="CASO-5">CASO-5 (Kilos)</option>
            </select>
            
            <button @click="checkoutPrueba" class="px-6 py-2 bg-red-600 text-white font-bold rounded shadow hover:bg-red-500">
                EMITIR PRUEBA Y MANDAR A IMPRESORA
            </button>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden pb-1">
      
      <div class="lg:col-span-2 flex flex-col overflow-hidden">
         <div class="p-4 bg-[var(--panel)] rounded mb-4 flex gap-2 border border-[var(--border)] shadow-sm">
            <input v-model="scan" @keyup.enter="handleScanEnter" placeholder="Código de barras / SKU" class="flex-1 p-3 bg-[var(--input-bg)] text-[var(--text-primary)] rounded border border-[var(--input-border)] text-lg outline-none focus:border-[var(--accent)]" />
            <button @click="handleScanEnter" class="px-6 bg-[var(--accent)] text-[var(--text-on-accent)] font-bold rounded hover:opacity-90 transition shadow">AÑADIR</button>
         </div>

         <div class="p-4 bg-[var(--panel)] rounded flex-1 flex flex-col overflow-hidden border border-[var(--border)] shadow-sm relative">
             <input v-model="q" @input="search" placeholder="Buscar producto por nombre..." class="w-full p-2 mb-3 bg-[var(--input-bg)] rounded border border-[var(--input-border)] outline-none focus:border-[var(--accent)] transition-colors" />
             
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { fetchProducts, emitirVenta, api } from '../api' // Importar api para llamar al endpoint custom
import { useAuth } from '../composables/useAuth.js'

const { currentUser } = useAuth()
const casoSeleccionado = ref('CASO-1')
const scan = ref('')
const q = ref('')
const productos = ref([])
const cart = ref([])

// Config Impresora (Hardcoded para pruebas o leer de localStorage)
const printerInfo = ref({ type: 'usb', vid: null, pid: null }) // Cargar esto si quieres

function formatPrice(val) { return new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP'}).format(val||0) }

async function search() {
    try {
        const r = await fetchProducts(q.value)
        productos.value = r.data ?? r ?? []
    } catch(e) { productos.value = [] }
}

function addProduct(p) {
    const exist = cart.value.find(i => i.id_producto === p.id_producto)
    if (exist) { exist.cantidad++; exist.subtotal = exist.cantidad * exist.precio }
    else { cart.value.push({ ...p, cantidad: 1, subtotal: p.precio }) }
}

const total = computed(() => cart.value.reduce((a,b) => a + (b.subtotal||0), 0))

// --- LA FUNCIÓN DE PRUEBA ---
async function checkoutPrueba() {
    if (cart.value.length === 0) return alert('Llena el carro según el caso del SII')
    
    const user = currentUser.value || {}
    const payload = {
        id_usuario: user.id || 1,
        id_empresa: user.empresaId || 1,
        total: total.value,
        detalles: cart.value.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad, precio_unitario: i.precio, nombre: i.nombre })),
        pagos: [{ id_pago: 1, monto: total.value }],
        usarImpresora: true
    }

    try {
        // 1. Guardar Venta
        const resp = await emitirVenta(payload)
        const dataVenta = resp?.data ?? resp
        
        // 2. Emitir DTE Prueba (Llamando al endpoint custom que creamos)
        // Asumiendo que creaste este endpoint en el controller: @Post('emitir-prueba')
        const resDte = await api.post('/ventas/emitir-prueba', { 
            idVenta: dataVenta.venta.id_venta, 
            caso: casoSeleccionado.value 
        })
        
        const dteData = resDte.data;

        if (!dteData.ok) throw new Error(dteData.error || "Error emitiendo DTE");

        // 3. Imprimir con Electron
        if (window.electronAPI?.printFromData) {
            // Cargar config de impresora guardada
            const savedConfig = JSON.parse(localStorage.getItem('printer_config') || '{}')
            
            const printData = {
                empresa: { razonSocial: 'EMPRESA PRUEBA', rut: '21.289.176-2', direccion: 'Dirección Prueba' },
                venta: { id_venta: dteData.folio, fecha: new Date().toLocaleString() },
                detalles: payload.detalles.map(d => ({ ...d, subtotal: d.cantidad * d.precio_unitario })),
                total: total.value
            }
            
            const opts = {
                type: savedConfig.type || 'usb',
                ip: savedConfig.info?.ip,
                vid: savedConfig.lastUsbVid,
                pid: savedConfig.lastUsbPid,
                content417: dteData.timbre // EL TIMBRE REAL DEL SII
            }

            const r = await window.electronAPI.printFromData(printData, opts)
            if (!r.ok) alert('Error impresión: ' + r.error)
        }

        alert(`CASO ${casoSeleccionado.value} GENERADO OK. Folio: ${dteData.folio}`)
        cart.value = []

    } catch (e) {
        console.error(e)
        alert('Error: ' + e.message)
    }
}

async function handleScanEnter() { /* Igual que antes */ }

onMounted(() => { search() })
</script>
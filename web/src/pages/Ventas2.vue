<template>
  <div class="p-4 h-full flex flex-col bg-[var(--bg-deep)] text-[var(--text-primary)]">
    
    <!-- BARRA SUPERIOR: CONFIGURACIÓN RÁPIDA -->
    <div class="mb-4 flex flex-wrap items-center gap-4 bg-[var(--panel)] p-3 rounded border border-[var(--border)] shadow-sm">
      
      <div class="flex items-center gap-2">
        <h2 class="font-bold text-lg text-[var(--accent)]">Venta Rápida</h2>
      </div>

      <!-- SWITCH: EMITIR BOLETA ELECTRÓNICA -->
      <div class="ml-auto flex items-center gap-4">
        
        <!-- Selector Opcional de Caso (Solo visible si lo necesitas para certificar, sino déjalo en vacío) -->
        <div class="flex items-center gap-2">
            <span class="text-xs text-[var(--text-secondary)] font-bold uppercase">Tipo Venta:</span>
            <select v-model="tipoVenta" class="text-sm p-1 rounded bg-[var(--input-bg)] border border-[var(--input-border)]">
                <option value="">Venta Normal</option>
                <option value="CASO-1">Certif. Caso 1</option>
                <option value="CASO-2">Certif. Caso 2</option>
            </select>
        </div>

        <label class="flex items-center cursor-pointer select-none gap-2 p-2 rounded hover:bg-[var(--bg-deep)] transition">
          <div class="relative">
            <input type="checkbox" v-model="emitirBoletaSII" class="sr-only">
            <div class="block w-10 h-6 rounded-full bg-gray-300 dark:bg-gray-700" :class="{'!bg-blue-600': emitirBoletaSII}"></div>
            <div class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition" :class="{'translate-x-4': emitirBoletaSII}"></div>
          </div>
          <div class="text-sm font-bold" :class="emitirBoletaSII ? 'text-blue-500' : 'text-gray-500'">
             {{ emitirBoletaSII ? 'Generar DTE (SII)' : 'Solo Venta Interna' }}
          </div>
        </label>
      </div>

    </div>

    <!-- CUERPO PRINCIPAL (IGUAL QUE ANTES) -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden pb-1">
      
      <!-- LADO IZQUIERDO: PRODUCTOS -->
      <div class="lg:col-span-2 flex flex-col overflow-hidden">
         <div class="p-4 bg-[var(--panel)] rounded mb-4 flex gap-2 border border-[var(--border)] shadow-sm">
            <input v-model="scan" @keyup.enter="handleScanEnter" placeholder="Escanea código de barras..." class="flex-1 p-3 bg-[var(--input-bg)] text-[var(--text-primary)] rounded border border-[var(--input-border)] text-lg outline-none focus:border-[var(--accent)]" />
            <button @click="handleScanEnter" class="px-6 bg-[var(--accent)] text-[var(--text-on-accent)] font-bold rounded hover:opacity-90 transition shadow">AÑADIR</button>
         </div>

         <div class="p-4 bg-[var(--panel)] rounded flex-1 flex flex-col overflow-hidden border border-[var(--border)] shadow-sm relative">
             <input v-model="q" @input="search" placeholder="Buscar producto manual..." class="w-full p-2 mb-3 bg-[var(--input-bg)] rounded border border-[var(--input-border)] outline-none focus:border-[var(--accent)] transition-colors" />
             
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

      <!-- LADO DERECHO: TICKET -->
      <div class="bg-[var(--panel)] rounded flex flex-col h-full border border-[var(--border)] shadow-sm overflow-hidden">
         <div class="p-4 border-b border-[var(--border)] bg-[var(--bg-deep)]">
             <h3 class="font-bold text-lg">Ticket de Venta</h3>
         </div>

         <div class="flex-1 overflow-y-auto p-2 custom-scroll">
             <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] italic opacity-50">
                 Sin productos
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
                     <button @click="cart.splice(i, 1)" class="text-[10px] text-red-500 hover:text-red-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wide">X</button>
                 </div>
             </div>
         </div>

         <!-- BOTÓN DE PAGO -->
         <div class="p-4 border-t border-[var(--border)] bg-[var(--panel)]">
             <div class="flex justify-between items-end mb-4">
                 <span class="text-[var(--text-secondary)] font-medium uppercase text-xs tracking-wider">Total</span>
                 <span class="text-3xl font-bold text-[var(--accent)]">{{ formatPrice(total) }}</span>
             </div>
             
             <button @click="procesarVenta" 
                class="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded font-bold shadow-lg transition transform active:scale-[0.98] flex items-center justify-center gap-2"
                :disabled="procesando">
                <span v-if="procesando">Procesando...</span>
                <span v-else>PAGAR {{ emitirBoletaSII ? '(CON BOLETA)' : '' }}</span>
             </button>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { fetchProducts, emitirVenta, api } from '../api' 
import { useAuth } from '../composables/useAuth.js'

const { currentUser } = useAuth()
const scan = ref('')
const q = ref('')
const productos = ref([])
const cart = ref([])
const procesando = ref(false)

// Configuración de Venta
const emitirBoletaSII = ref(true) // Por defecto emitir DTE
const tipoVenta = ref('') // Vacío = Normal. Cambiar a CASO-X solo para pruebas.

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

async function handleScanEnter() {
   if(!scan.value) return
   try {
       const r = await fetchProducts(scan.value)
       const list = r.data ?? r
       if (list && list.length > 0) addProduct(list[0])
   } catch(e){}
   scan.value = ''
}

const total = computed(() => cart.value.reduce((a,b) => a + (b.subtotal||0), 0))

// --- FUNCIÓN UNIFICADA DE VENTA ---
async function procesarVenta() {
    if (cart.value.length === 0) return alert('El carrito está vacío')
    if (procesando.value) return

    procesando.value = true
    const user = currentUser.value || {}

    const payloadVenta = {
        id_usuario: user.id || 1,
        id_empresa: user.empresaId || 1,
        total: total.value,
        detalles: cart.value.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad, precio_unitario: i.precio, nombre: i.nombre })),
        pagos: [{ id_pago: 1, monto: total.value }],
        usarImpresora: false // No imprimir en el paso 1 (DB), imprimimos al final
    }

    try {
        // 1. Guardar Venta en BD Local
        const resp = await emitirVenta(payloadVenta)
        const dataVenta = resp?.data ?? resp
        
        let datosImpresion = {
            folio: 'INT-' + dataVenta.venta.id_venta, // Por defecto folio interno
            timbre: null
        }

        // 2. (Opcional) Emitir DTE a SimpleAPI
        if (emitirBoletaSII.value) {
            try {
                // Llamamos a tu endpoint que usa DteService
                const resDte = await api.post('/dte/emitir-prueba', { 
                    idVenta: dataVenta.venta.id_venta, 
                    caso: tipoVenta.value // Envía vacío si es venta normal
                })
                
                const dteData = resDte.data;
                if (!dteData.ok) throw new Error(dteData.error || "Error SimpleAPI");

                datosImpresion.folio = dteData.folio;
                datosImpresion.timbre = dteData.timbre; // PDF417 real
                
                // alert(`¡Boleta SII Emitida! Folio: ${dteData.folio}`);
            } catch (errDte) {
                console.error("Fallo DTE:", errDte);
                alert("Venta guardada, pero falló DTE: " + errDte.message);
                // No detenemos flujo, permitimos imprimir comprobante interno al menos
            }
        }

        // 3. Imprimir (Electron)
        if (window.electronAPI?.printFromData) {
            const savedConfig = JSON.parse(localStorage.getItem('printer_config') || '{}')
            
            const printData = {
                empresa: { razonSocial: 'MIPOSRA SPA', rut: '21.289.176-2', direccion: 'Temuco' },
                venta: { id_venta: datosImpresion.folio, fecha: new Date().toLocaleString() },
                detalles: payloadVenta.detalles.map(d => ({ ...d, subtotal: d.cantidad * d.precio_unitario })),
                total: total.value
            }
            
            const opts = {
                type: savedConfig.type || 'usb',
                ip: savedConfig.info?.ip,
                vid: savedConfig.lastUsbVid,
                pid: savedConfig.lastUsbPid,
                content417: datosImpresion.timbre || `INT-${dataVenta.venta.id_venta}` // Timbre SII o código interno
            }

            await window.electronAPI.printFromData(printData, opts)
        }

        cart.value = []
        tipoVenta.value = '' // Resetear caso especial

    } catch (e) {
        console.error(e)
        alert('Error procesando venta: ' + e.message)
    } finally {
        procesando.value = false
    }
}

onMounted(() => { search() })
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
</style>
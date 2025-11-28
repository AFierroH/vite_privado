<template>
  <div class="p-4 h-full flex flex-col bg-[var(--bg-deep)] text-[var(--text-primary)]">
    
    <!-- HEADER: CONFIGURACIÓN Y MODO CERTIFICACIÓN -->
    <div class="mb-4 bg-[var(--panel)] p-3 rounded border border-[var(--border)] shadow-sm">
      <div class="flex justify-between items-center mb-2">
          <h2 class="font-bold text-lg text-[var(--accent)]">Punto de Venta</h2>
          
          <!-- SWITCH: ACTIVAR MODO PRUEBAS -->
          <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
            <span :class="modoPruebas ? 'text-yellow-600 font-bold' : 'text-gray-500'">Modo Certificación SII</span>
            <div class="relative">
                <input type="checkbox" v-model="modoPruebas" class="sr-only">
                <div class="block w-10 h-6 rounded-full bg-gray-300" :class="{'!bg-yellow-500': modoPruebas}"></div>
                <div class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition" :class="{'translate-x-4': modoPruebas}"></div>
            </div>
          </label>
      </div>

      <!-- BOTONERA DE PRUEBAS (SOLO VISIBLE SI ACTIVAS EL SWITCH) -->
      <div v-if="modoPruebas" class="flex flex-wrap gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200">
          <span class="text-xs font-bold text-yellow-700 w-full">CARGAR CASO:</span>
          <button @click="cargarCaso(1)" class="px-3 py-1 text-xs font-bold bg-white border border-yellow-400 rounded hover:bg-yellow-100 shadow-sm">CASO 1 (Aceite)</button>
          <button @click="cargarCaso(2)" class="px-3 py-1 text-xs font-bold bg-white border border-yellow-400 rounded hover:bg-yellow-100 shadow-sm">CASO 2 (Regalo)</button>
          <button @click="cargarCaso(3)" class="px-3 py-1 text-xs font-bold bg-white border border-yellow-400 rounded hover:bg-yellow-100 shadow-sm">CASO 3 (Sandwic)</button>
          <button @click="cargarCaso(4)" class="px-3 py-1 text-xs font-bold bg-white border border-yellow-400 rounded hover:bg-yellow-100 shadow-sm">CASO 4 (Exento)</button>
          <button @click="cargarCaso(5)" class="px-3 py-1 text-xs font-bold bg-white border border-yellow-400 rounded hover:bg-yellow-100 shadow-sm">CASO 5 (Arroz)</button>
      </div>
    </div>

    <!-- CUERPO PRINCIPAL (GRID) -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden pb-1">
      
      <!-- LADO IZQUIERDO: PRODUCTOS -->
      <div class="lg:col-span-2 flex flex-col overflow-hidden">
         <!-- BARRA DE ESCANEO -->
         <div class="p-4 bg-[var(--panel)] rounded mb-4 flex gap-2 border border-[var(--border)] shadow-sm">
            <input v-model="scan" @keyup.enter="handleScanEnter" placeholder="Escanea código..." class="flex-1 p-3 bg-[var(--input-bg)] rounded border border-[var(--input-border)] text-lg outline-none focus:border-[var(--accent)]" />
            <button @click="handleScanEnter" class="px-6 bg-[var(--accent)] text-[var(--text-on-accent)] font-bold rounded hover:opacity-90 transition shadow">AÑADIR</button>
         </div>

         <!-- GRILLA DE PRODUCTOS -->
         <div class="p-4 bg-[var(--panel)] rounded flex-1 flex flex-col overflow-hidden border border-[var(--border)] shadow-sm relative">
             <input v-model="q" @input="search" placeholder="Buscar producto..." class="w-full p-2 mb-3 bg-[var(--input-bg)] rounded border border-[var(--input-border)] outline-none focus:border-[var(--accent)]" />
             
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
         <div class="p-4 border-b border-[var(--border)] bg-[var(--bg-deep)] flex justify-between items-center">
             <h3 class="font-bold text-lg">Ticket</h3>
             <span v-if="tipoVenta" class="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded font-bold">{{ tipoVenta }}</span>
         </div>

         <div class="flex-1 overflow-y-auto p-2 custom-scroll">
             <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] italic opacity-50">
                 Carro vacío
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

         <div class="p-4 border-t border-[var(--border)] bg-[var(--panel)]">
             <div class="flex justify-between items-end mb-4">
                 <span class="text-[var(--text-secondary)] font-medium uppercase text-xs tracking-wider">Total</span>
                 <span class="text-3xl font-bold text-[var(--accent)]">{{ formatPrice(total) }}</span>
             </div>
             
             <!-- BOTON PRINCIPAL DE PAGO -->
             <button @click="procesarVenta" 
                class="w-full py-4 rounded font-bold shadow-lg transition transform active:scale-[0.98] flex items-center justify-center gap-2"
                :class="modoPruebas ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'"
                :disabled="procesando">
                <span v-if="procesando">Procesando...</span>
                <span v-else>
                    {{ modoPruebas ? `EMITIR DTE (${tipoVenta})` : 'PAGAR' }}
                </span>
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

// Estados para certificación
const modoPruebas = ref(false)
const tipoVenta = ref('') 

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

// --- CARGADOR DE CASOS DE PRUEBA ---
function cargarCaso(n) {
    cart.value = [];
    tipoVenta.value = `CASO-${n}`;
    const idDummy = 1; // ID genérico, el backend usará el nombre y precio que mandemos aquí

    if (n === 1) {
        cart.value.push({ id_producto: idDummy, nombre: "Cambio de aceite", precio: 19900, cantidad: 1, subtotal: 19900 });
        cart.value.push({ id_producto: idDummy, nombre: "Alineacion y balanceo", precio: 9900, cantidad: 1, subtotal: 9900 });
    } else if (n === 2) {
        cart.value.push({ id_producto: idDummy, nombre: "Papel de regalo", precio: 120, cantidad: 17, subtotal: 120*17 });
    } else if (n === 3) {
        cart.value.push({ id_producto: idDummy, nombre: "Sandwic", precio: 1500, cantidad: 2, subtotal: 1500*2 });
        cart.value.push({ id_producto: idDummy, nombre: "Bebida", precio: 550, cantidad: 2, subtotal: 550*2 });
    } else if (n === 4) {
        // OJO: Nombres deben coincidir con la lógica del backend para detectar exento
        cart.value.push({ id_producto: idDummy, nombre: "item afecto 1", precio: 1590, cantidad: 8, subtotal: 1590*8 });
        cart.value.push({ id_producto: idDummy, nombre: "item exento 2", precio: 1000, cantidad: 2, subtotal: 1000*2 });
    } else if (n === 5) {
        cart.value.push({ id_producto: idDummy, nombre: "Arroz", precio: 700, cantidad: 5, subtotal: 700*5 });
    }
}

const total = computed(() => cart.value.reduce((a,b) => a + (b.subtotal||0), 0))

async function procesarVenta() {
    if (cart.value.length === 0) return alert('El carrito está vacío')
    if (procesando.value) return

    procesando.value = true
    const user = currentUser.value || {}

    // Payload para guardar en BD Local
    const payloadVenta = {
        id_usuario: user.id || 1,
        id_empresa: user.empresaId || 1,
        total: total.value,
        // Enviamos el nombre explícito para que el backend lo guarde en detalle_venta
        detalles: cart.value.map(i => ({ 
            id_producto: i.id_producto, 
            cantidad: i.cantidad, 
            precio_unitario: i.precio, 
            nombre: i.nombre // CRÍTICO: Enviamos el nombre del caso de prueba
        })),
        pagos: [{ id_pago: 1, monto: total.value }],
        usarImpresora: false 
    }

    try {
        // 1. Guardar Venta
        const resp = await emitirVenta(payloadVenta)
        const dataVenta = resp?.data ?? resp
        
        let folioFinal = 'INT-' + dataVenta.venta.id_venta;
        let timbreFinal = null;

        // 2. Si estamos en modo pruebas, llamamos al endpoint de certificación
        if (modoPruebas.value) {
            try {
                const resDte = await api.post('/dte/emitir-prueba', { 
                    idVenta: dataVenta.venta.id_venta, 
                    caso: tipoVenta.value 
                })
                
                const dteData = resDte.data;
                if (!dteData.ok) throw new Error(dteData.error || "Error SimpleAPI");

                folioFinal = dteData.folio;
                timbreFinal = dteData.timbre;
                alert(`✅ ÉXITO SII: Folio ${folioFinal} generado.`);
            } catch (errDte) {
                console.error("Fallo DTE:", errDte);
                alert("❌ Falló envío al SII: " + errDte.message);
                // Si falla el DTE en pruebas, detenemos el flujo
                procesando.value = false;
                return; 
            }
        }

        // 3. Imprimir (Siempre intentamos imprimir, sea prueba o real)
        if (window.electronAPI?.printFromData) {
            const savedConfig = JSON.parse(localStorage.getItem('printer_config') || '{}')
            const printData = {
                empresa: { razonSocial: 'MIPOSRA SPA', rut: '21.289.176-2', direccion: 'Temuco' },
                venta: { id_venta: folioFinal, fecha: new Date().toLocaleString() },
                detalles: payloadVenta.detalles.map(d => ({ ...d, subtotal: d.cantidad * d.precio_unitario })),
                total: total.value
            }
            const opts = {
                type: savedConfig.type || 'usb',
                ip: savedConfig.info?.ip,
                vid: savedConfig.lastUsbVid,
                pid: savedConfig.lastUsbPid,
                content417: timbreFinal || folioFinal
            }
            await window.electronAPI.printFromData(printData, opts)
        }

        // Limpiar todo al finalizar
        cart.value = []
        if (modoPruebas.value) tipoVenta.value = '' // Limpiar caso

    } catch (e) {
        console.error(e)
        alert('Error: ' + e.message)
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
<template>
  <div class="p-4 h-full flex flex-col bg-[var(--bg-deep)] text-[var(--text-primary)] transition-colors">
    
    <div class="mb-4 flex flex-wrap items-center gap-4 bg-[var(--panel)] p-3 rounded border border-[var(--border)] shadow-sm">
      
      <div class="flex items-center gap-2">
        <label class="font-bold text-sm text-[var(--text-secondary)]">Impresora</label>
        <select v-model="printerType" class="p-2 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none focus:border-[var(--accent)]">
          <option value="usb">USB</option>
          <option value="lan">LAN (Red)</option>
        </select>
      
        <div v-if="printerType === 'lan'" class="flex items-center gap-2">
          <input v-model="printerInfo.ip" placeholder="192.168.x.x" class="p-2 w-36 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none" />
          <input v-model.number="printerInfo.port" type="number" placeholder="9100" class="p-2 w-20 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none" />
        </div>

        <div v-if="printerType === 'usb'" class="flex items-center gap-2">
           <select v-model="selectedUsbDevice" class="p-2 w-48 md:w-64 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none">
              <option :value="null">-- Seleccionar --</option>
              <option v-for="(dev, idx) in usbDevices" :key="idx" :value="dev.val">{{ dev.name }}</option>
           </select>
           <button @click="listUsbDevices" class="p-2 bg-[var(--accent)] text-[var(--text-on-accent)] rounded hover:opacity-90 transition" title="Recargar Lista">
             🔄
           </button>
        </div>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <label class="flex items-center cursor-pointer select-none">
          <input type="checkbox" v-model="usarImpresora" class="mr-2">
          <span class="text-sm font-medium">Imprimir Ticket</span>
        </label>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden pb-1">
      
      <div class="lg:col-span-2 flex flex-col overflow-hidden h-full">
         <div class="p-4 bg-[var(--panel)] rounded mb-4 flex gap-2 border border-[var(--border)] shadow-sm shrink-0">
            <input v-model="scan" @keyup.enter="handleScanEnter" placeholder="Código de barras (Enter)" class="flex-1 p-3 bg-[var(--input-bg)] rounded border border-[var(--input-border)] text-lg outline-none focus:border-[var(--accent)]" />
            <button @click="handleScanEnter" class="px-6 bg-[var(--accent)] text-[var(--text-on-accent)] font-bold rounded hover:opacity-90 transition shadow">AÑADIR</button>
         </div>

         <div class="p-4 bg-[var(--panel)] rounded flex-1 flex flex-col overflow-hidden border border-[var(--border)] shadow-sm relative h-full">
             <input v-model="q" @input="search" placeholder="Buscar por nombre..." class="w-full p-2 mb-3 bg-[var(--input-bg)] rounded border border-[var(--input-border)] outline-none focus:border-[var(--accent)] shrink-0" />
             
             <div v-if="isLoading" class="absolute inset-0 top-[60px] bg-[var(--panel)]/80 backdrop-blur-sm flex items-center justify-center z-10">
                <span class="text-[var(--accent)] font-bold animate-pulse">Cargando...</span>
             </div>

             <div class="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 content-start pr-2 custom-scroll">
                <div v-for="p in productos" :key="p.id_producto" 
                     class="p-3 bg-[var(--bg-deep)] border border-[var(--border)] rounded cursor-pointer hover:border-[var(--accent)] transition-all flex flex-col justify-between h-24 group active:scale-95 shadow-sm"
                     @click="addProduct(p)">
                    
                    <div class="font-bold text-sm line-clamp-2 leading-tight group-hover:text-[var(--accent)]">
                        {{ p.nombre }}
                    </div>
                    
                    <div class="flex justify-between items-end mt-1">
                        <span class="text-xs text-[var(--text-secondary)]">Stock: {{ p.stock }}</span>
                        <div class="text-[var(--text-primary)] font-mono font-bold text-right">
                            {{ formatPrice(p.precio) }}
                        </div>
                    </div>
                </div>

                <div v-if="!isLoading && productos.length === 0" class="col-span-full text-center text-gray-400 py-10">
                    No hay productos disponibles.
                </div>
             </div>
         </div>
      </div>

      <div class="bg-[var(--panel)] rounded flex flex-col h-full border border-[var(--border)] shadow-sm overflow-hidden">
         <div class="p-4 border-b border-[var(--border)] bg-[var(--bg-deep)]">
             <h3 class="font-bold text-lg">Ticket de Venta</h3>
         </div>

         <div class="flex-1 overflow-y-auto p-2 custom-scroll">
             <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] italic opacity-50">
                 Carrito Vacío
             </div>
             
             <div v-else v-for="(it,i) in cart" :key="i" class="flex justify-between items-center p-2 mb-1 bg-[var(--bg-deep)] rounded border border-[var(--border)]">
                 <div class="flex-1 pr-2">
                     <div class="text-sm font-medium leading-tight">{{ it.nombre }}</div>
                     <div class="text-xs text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                         <span>{{ formatPrice(it.precio) }}</span>
                         <span>x</span>
                         <input type="number" v-model.number="it.cantidad" min="1" class="w-12 bg-[var(--input-bg)] text-center border border-[var(--input-border)] rounded h-6" @change="it.subtotal = it.cantidad * it.precio">
                     </div>
                 </div>
                 <div class="text-right">
                     <div class="font-bold">{{ formatPrice(it.subtotal) }}</div>
                     <button @click="cart.splice(i, 1)" class="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase">Quitar</button>
                 </div>
             </div>
         </div>

         <div class="p-4 border-t border-[var(--border)] bg-[var(--panel)] mt-auto">
             <div class="flex justify-between items-end mb-4">
                 <span class="text-[var(--text-secondary)] font-medium uppercase text-xs tracking-wider">Total</span>
                 <span class="text-3xl font-bold text-[var(--accent)]">{{ formatPrice(total) }}</span>
             </div>
             
             <div class="grid grid-cols-3 gap-2">
                 <button @click="clear" class="col-span-1 py-3 bg-gray-200 text-gray-700 rounded font-bold">Limpiar</button>
                 <button @click="checkout" :disabled="isLoading" class="col-span-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50">
                    <span v-if="isLoading">Procesando...</span>
                    <span v-else>PAGAR</span>
                 </button>
             </div>
         </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { fetchProducts, emitirVenta } from '../api'
import { useAuth } from '../composables/useAuth.js'
import { generarTicketEscPos } from "../utils/escposEncoder.js"; // IMPORTANTE
import { PrinterService } from '../utils/PrinterService.js';     // IMPORTANTE

const { currentUser } = useAuth()

// CONFIG
const savedConfig = JSON.parse(localStorage.getItem('printer_config') || '{}')
const printerType = ref(savedConfig.type || 'usb')
const printerInfo = ref(savedConfig.info || { ip: '', port: 9100 })
const usarImpresora = ref(savedConfig.active !== undefined ? savedConfig.active : true)
const usbDevices = ref([])
const selectedUsbDevice = ref(savedConfig.lastUsbVal || null) // Guardamos el valor (VID/PID)
const isLoading = ref(false)

const isElectron = !!window.electronAPI;

const scan = ref(''); const q = ref(''); const productos = ref([]); const cart = ref([]);
const total = computed(() => cart.value.reduce((a,b) => a + (b.subtotal||0), 0));
const isLoading = ref(false)
const isElectron = !!window.electronAPI;

// WATCHER
watch([printerType, printerInfo, usarImpresora, selectedUsbDevice], () => {
  localStorage.setItem('printer_config', JSON.stringify({
      type: printerType.value,
      info: printerInfo.value,
      active: usarImpresora.value,
      lastUsbVal: selectedUsbDevice.value // Guardamos el objeto VID/PID
  }))
}, { deep: true })

function formatPrice(val) { return new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP'}).format(val||0) }
function clear() { cart.value = [] }

async function search() {
    isLoading.value = true
    
    // 1. OBTENER ID EMPRESA
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    // Intenta user.id_empresa, sino empresa.id_empresa, sino 1
    const myEmpresaId = session.user?.id_empresa || session.empresa?.id_empresa || 1;

    try {
        // 2. LLAMADA A TU API
        const r = await fetchProducts(q.value, myEmpresaId)
        
        // 3. ASIGNACIÓN SEGURA
        // Axios devuelve { data: [...] }, a veces el interceptor devuelve [...] directo
        const data = r.data || r; 
        productos.value = Array.isArray(data) ? data : [];
        
    } catch(e) { 
        console.error("Error cargando productos:", e)
        productos.value = []
    } finally { 
        isLoading.value = false 
    }
}

// --- IMPRESORAS ---
async function listUsbDevices() {
    isLoading.value = true;
    try {
        usbDevices.value = await PrinterService.listarUSB();
        
        // Recuperar seleccion si existe
        if (savedConfig.lastUsbVal && usbDevices.value.length > 0) {
            // Buscamos coincidencia por VID/PID
            const saved = savedConfig.lastUsbVal;
            const found = usbDevices.value.find(d => d.val.vid === saved.vid && d.val.pid === saved.pid);
            if(found) selectedUsbDevice.value = found.val;
        }
        // Si es Web y solo hay uno (el hardcodeado), seleccionarlo por defecto
        if (!isElectron && usbDevices.value.length === 1) {
            selectedUsbDevice.value = usbDevices.value[0].val;
        }
    } catch(e) { console.error(e); }
    finally { isLoading.value = false; }
}

// --- CHECKOUT ---
async function checkout() {
    if (cart.value.length === 0) return alert('Carrito vacío');
    isLoading.value = true;

    // ... (Tu preparación de payload IGUAL) ...
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    const user = currentUser.value || {};
    const empresa = session.empresa || {};
    const payload = {
        id_usuario: user.id || 1, id_empresa: user.empresaId || 1, total: total.value,
        detalles: cart.value.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad, precio_unitario: i.precio, nombre: i.nombre })),
        pagos: [{ id_pago: 1, monto: total.value }], usarImpresora: false
    };

    try {
        const resp = await emitirVenta(payload);
        const data = resp?.data ?? resp;
        if (!data) throw new Error("Sin respuesta");

        const folioReal = data.folio || '---';
        const timbreXml = data.timbre;

        if (usarImpresora.value) {
            // Datos Objeto (Para Electron)
            const printDataObj = {
                empresa: { razonSocial: empresa.nombre, rut: empresa.rut, direccion: empresa.direccion },
                venta: { id_venta: folioReal, fecha: new Date().toLocaleString() },
                detalles: payload.detalles.map(d => ({ ...d, subtotal: d.cantidad * d.precio_unitario })),
                total: total.value
            };

            // Datos Bytes (Para Web/QZ)
            // Generamos los bytes SOLO si no es electron (para ahorrar proceso)
            let rawBytes = null;
            if (!isElectron) {
                rawBytes = generarTicketEscPos(printDataObj, timbreXml);
            }

            // ENVIAR AL SERVICIO
            await PrinterService.imprimir({
                printerType: printerType.value,
                printerVal: selectedUsbDevice.value, // Objeto {vid, pid}
                ip: printerInfo.value.ip,
                port: printerInfo.value.port,
                dataObj: printDataObj,
                rawBytes: rawBytes,
                content417: timbreXml
            });
        }
        
        cart.value = [];
        if(isElectron) alert('Venta OK');

    } catch (e) {
        console.error(e);
        alert('Error: ' + (e.message || e));
    } finally {
        isLoading.value = false;
    }
}

function addProduct(p) {
    const exist = cart.value.find(i => i.id_producto === p.id_producto)
    if (exist) { exist.cantidad++; exist.subtotal = exist.cantidad * exist.precio }
    else { cart.value.push({ ...p, cantidad: 1, subtotal: p.precio }) }
}


async function handleScanEnter() {
    if(!scan.value) return
    // Aquí podrías optimizar para buscar solo por código exacto si tu backend lo soporta
    // Por ahora reusamos fetchProducts
    try {
        const session = JSON.parse(localStorage.getItem('session') || '{}')
        const myEmpresaId = session.user?.id_empresa || 1;
        const r = await fetchProducts(scan.value, myEmpresaId)
        const list = r.data || r
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
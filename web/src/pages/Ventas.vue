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
           <button @click="fillLocalIp" class="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-2 rounded font-bold" title="Usar mi subred">Mi IP</button>
        </div>

        <div v-if="printerType === 'usb'" class="flex items-center gap-2">
           <select v-model="selectedUsbDevice" class="p-2 w-48 md:w-64 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none" @change="handleUsbSelect">
              <option :value="null">-- Seleccionar --</option>
              <option v-for="(dev, idx) in usbDevices" :key="idx" :value="dev.val">{{ dev.name }}</option>
           </select>
           <button @click="listUsbDevices" class="p-2 bg-[var(--accent)] text-[var(--text-on-accent)] rounded hover:opacity-90 transition" title="Recargar USB">🔄</button>
        </div>
      </div>
      
      <div class="ml-auto flex items-center gap-2">
        <label class="flex items-center cursor-pointer select-none">
           <input type="checkbox" v-model="usarImpresora" class="mr-2 accent-[var(--accent)]">
           <span class="text-sm font-medium">Imprimir Ticket</span>
        </label>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden pb-1">
      
      <div class="lg:col-span-2 flex flex-col overflow-hidden">
         
         <div class="p-4 bg-[var(--panel)] rounded mb-4 border border-[var(--border)] shadow-sm">
             <input 
                ref="searchInput"
                v-model="q" 
                @input="search" 
                placeholder="Buscar por nombre, código o marca..." 
                class="w-full p-3 bg-[var(--input-bg)] rounded border border-[var(--input-border)] text-lg outline-none focus:border-[var(--accent)] placeholder:text-gray-500" 
             />
         </div>

         <div class="p-4 bg-[var(--panel)] rounded flex-1 flex flex-col overflow-hidden border border-[var(--border)] shadow-sm relative">
             <div v-if="isLoading" class="absolute inset-0 bg-[var(--panel)]/80 backdrop-blur-sm flex items-center justify-center z-10">
                <svg class="animate-spin h-8 w-8 text-[var(--accent)]" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             </div>

             <div class="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 content-start pr-2 custom-scroll">
                 <div v-if="productos.length === 0 && !isLoading" class="col-span-full text-center text-gray-500 py-10 italic">
                    Sin resultados.
                 </div>
                 
                 <div v-for="p in productos" :key="p.id_producto" 
                      class="p-3 bg-[var(--bg-deep)] border border-[var(--border)] rounded cursor-pointer hover:border-[var(--accent)] transition-all flex flex-col justify-between h-24 group active:scale-95"
                      @click="addProduct(p)">
                    <div class="font-bold text-sm line-clamp-2 group-hover:text-[var(--accent)]">{{ p.nombre }}</div>
                    <div class="flex justify-between items-end">
                       <span v-if="p.codigo_barra" class="text-[10px] text-[var(--text-secondary)] font-mono">{{ p.codigo_barra }}</span>
                       <div class="text-[var(--text-secondary)] font-mono font-bold group-hover:text-[var(--text-primary)]">{{ formatPrice(p.precio) }}</div>
                    </div>
                 </div>
             </div>
         </div>
      </div>

      <div class="bg-[var(--panel)] rounded flex flex-col h-full border border-[var(--border)] shadow-sm overflow-hidden">
         <div class="p-4 border-b border-[var(--border)] bg-[var(--bg-deep)]"><h3 class="font-bold text-lg">Ticket de Venta</h3></div>
         <div class="flex-1 overflow-y-auto p-2 custom-scroll">
             <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] italic opacity-50">Carrito Vacío</div>
             
             <div v-else v-for="(it,i) in cart" :key="i" class="flex justify-between items-center p-2 mb-1 bg-[var(--bg-deep)] rounded border border-[var(--border)] group">
                 <div class="flex-1 pr-2">
                     <div class="text-sm font-medium leading-tight">{{ it.nombre }}</div>
                     <div class="text-xs text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                         <span>{{ formatPrice(it.precio) }}</span><span>x</span>
                         <input type="number" v-model.number="it.cantidad" min="1" class="w-12 bg-[var(--input-bg)] text-center border border-[var(--input-border)] rounded h-6" @change="it.subtotal = it.cantidad * it.precio">
                     </div>
                 </div>
                 <div class="text-right flex flex-col items-end">
                     <div class="font-bold">{{ formatPrice(it.subtotal) }}</div>
                     <button @click="cart.splice(i, 1)" class="text-[10px] text-red-500 hover:text-red-600 font-bold opacity-0 group-hover:opacity-100 uppercase">Quitar</button>
                 </div>
             </div>
         </div>

         <div class="p-4 border-t border-[var(--border)] bg-[var(--panel)]">
             <div class="flex justify-between items-end mb-4">
                 <span class="text-[var(--text-secondary)] font-medium uppercase text-xs tracking-wider">Total</span>
                 <span class="text-3xl font-bold text-[var(--accent)]">{{ formatPrice(total) }}</span>
             </div>
             <div class="grid grid-cols-3 gap-2">
                 <button @click="clear" class="col-span-1 py-3 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded font-bold transition">Limpiar</button>
                 <button @click="checkout" :disabled="isLoading" class="col-span-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold shadow-lg transition transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                    <span v-if="isLoading">Procesando...</span><span v-else>PAGAR (F9)</span>
                 </button>
             </div>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { fetchProducts, emitirVenta } from '../api'
import { useAuth } from '../composables/useAuth.js'
import { generarTicketEscPos } from "../utils/escposEncoder.js"; 
import { PrinterService } from '../utils/PrinterService.js'; 
import { ScannerListener } from '../utils/ScannerListener.js'; // IMPORTAR SCANNER

const { currentUser } = useAuth()
const searchInput = ref(null)

// --- CONFIG IMPRESORA ---
const savedConfig = JSON.parse(localStorage.getItem('printer_config') || '{}')
const printerType = ref(savedConfig.type || 'usb')
const printerInfo = ref(savedConfig.info || { ip: '', port: 9100 })
const usarImpresora = ref(savedConfig.active !== undefined ? savedConfig.active : true)
const usbDevices = ref([])
const selectedUsbDevice = ref(savedConfig.lastUsbVal || null) 
const isLoading = ref(false)
const isElectron = !!window.electronAPI;

watch([printerType, printerInfo, usarImpresora, selectedUsbDevice], () => {
  const valToSave = (isElectron || selectedUsbDevice.value === null) ? selectedUsbDevice.value : null;
  localStorage.setItem('printer_config', JSON.stringify({
      type: printerType.value,
      info: printerInfo.value,
      active: usarImpresora.value,
      lastUsbVal: valToSave
  }))
}, { deep: true })

// --- ESTADO VENTA ---
const q = ref(''); const productos = ref([]); const cart = ref([]);
const total = computed(() => cart.value.reduce((a,b) => a + (b.subtotal||0), 0));
function formatPrice(val) { return new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP'}).format(val||0) }
function clear() { cart.value = []; q.value = ''; search(); }

// --- MANEJO DE ESCÁNER GLOBAL ---
async function handleGlobalScan(code, isInputFocused) {
    // 1. Si el foco está en el buscador manual, dejamos que el input actúe normalmente
    // para no duplicar la búsqueda.
    if (isInputFocused) return;

    // 2. Si no hay foco (escaneo al aire), buscamos y agregamos automáticamente
    try {
        const r = await fetchProducts(code); 
        const list = r.data ?? r;
        
        if (list && list.length > 0) {
            // Producto encontrado: Agregamos el primero (match exacto o cercano)
            addProduct(list[0]);
            // Opcional: Feedback visual/sonoro
            console.log("Producto escaneado:", list[0].nombre);
        } else {
            alert('Producto no encontrado: ' + code);
        }
    } catch (e) {
        console.error("Error al buscar escaneo:", e);
    }
}

// --- LOGICA PRODUCTOS ---
async function search() {
    isLoading.value = true;
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    const myEmpresaId = session.user?.id_empresa || 1;
    try {
        const r = await fetchProducts(q.value, myEmpresaId);
        productos.value = r.data || r || [];
    } catch(e) { productos.value = []; }
    finally { isLoading.value = false; }
}

function addProduct(p) {
    const exist = cart.value.find(i => i.id_producto === p.id_producto);
    if (exist) { 
        exist.cantidad++; 
        exist.subtotal = exist.cantidad * exist.precio 
    } else { 
        cart.value.push({ ...p, cantidad: 1, subtotal: p.precio }) 
    }
}

// --- CHECKOUT / IMPRESIÓN ---
async function checkout() {
    if (cart.value.length === 0) return alert('Carrito vacío');
    isLoading.value = true;
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    const user = currentUser.value || {};
    const empresa = session.empresa || {};
    
    const payload = {
        id_usuario: user.id || 1, 
        id_empresa: user.empresaId || 1, 
        total: total.value,
        detalles: cart.value.map(i => ({ 
            id_producto: i.id_producto, 
            cantidad: i.cantidad, 
            precio_unitario: i.precio, 
            nombre: i.nombre 
        })),
        pagos: [{ id_pago: 1, monto: total.value }], 
        usarImpresora: false // Backend no imprime, lo hacemos desde front
    };

    try {
        const resp = await emitirVenta(payload);
        const data = resp?.data ?? resp;
        if (!data) throw new Error("Sin respuesta del servidor");

        const folioReal = data.folio || '---';
        const timbreXml = data.timbre;

        if (usarImpresora.value) {
            const printDataObj = {
                empresa: { razonSocial: empresa.nombre, rut: empresa.rut, direccion: empresa.direccion },
                venta: { id_venta: folioReal, fecha: new Date().toLocaleString() },
                detalles: payload.detalles.map(d => ({ ...d, subtotal: d.cantidad * d.precio_unitario })),
                total: total.value
            };
            
            // Generar bytes para web si es necesario
            let rawBytes = null;
            if (!isElectron) {
                rawBytes = await generarTicketEscPos(printDataObj, timbreXml);
            }

            await PrinterService.imprimir({
                printerType: printerType.value,
                printerVal: selectedUsbDevice.value,
                ip: printerInfo.value.ip,
                port: printerInfo.value.port,
                dataObj: printDataObj, 
                rawBytes: rawBytes,    
                content417: timbreXml  
            });
        }
        
        // Reset
        cart.value = [];
        if(isElectron) alert('Venta finalizada');

    } catch (e) {
        console.error(e);
        alert('Error: ' + (e.message || e));
    } finally {
        isLoading.value = false;
    }
}

// --- HELPERS INTERFAZ ---
async function listUsbDevices() {
    isLoading.value = true;
    try {
        usbDevices.value = await PrinterService.listarUSB();
        // Autoselección Electron
        if (isElectron && savedConfig.lastUsbVal && usbDevices.value.length > 0) {
            const saved = savedConfig.lastUsbVal;
            const found = usbDevices.value.find(d => d.val.vid === saved.vid && d.val.pid === saved.pid);
            if(found) selectedUsbDevice.value = found.val;
        }
    } catch(e) {} finally { isLoading.value = false; }
}

async function handleUsbSelect() {
    if (!isElectron && selectedUsbDevice.value === "NEW_WEBUSB") {
        const result = await PrinterService.requestWebUsb();
        if (result) {
            usbDevices.value = [result];
            selectedUsbDevice.value = result.val;
        } else {
            selectedUsbDevice.value = null; 
        }
    }
}

async function fillLocalIp() {
    if (isElectron) {
        try {
            const ip = await window.electronAPI.getLocalIp();
            if(ip) printerInfo.value.ip = ip;
        } catch(e) {}
    }
}

// --- CICLO DE VIDA ---
onMounted(() => {
    // 1. Cargar productos iniciales
    search();
    
    // 2. Cargar impresoras
    listUsbDevices();
    if(isElectron) fillLocalIp();

    // 3. ACTIVAR ESCUCHA GLOBAL DE ESCÁNER
    ScannerListener.onScan(handleGlobalScan);
});

onUnmounted(() => {
    // LIMPIAR ESCUCHA
    ScannerListener.offScan(handleGlobalScan);
});
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
</style>
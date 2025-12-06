<template>
  <div class="p-4 h-full flex flex-col bg-[var(--bg-deep)] text-[var(--text-primary)] transition-colors">
    <!-- ... (TEMPLATE SIN CAMBIOS VISUALES) ... -->
    <div class="mb-4 flex flex-wrap items-center gap-4 bg-[var(--panel)] p-3 rounded border border-[var(--border)] shadow-sm">
      <div class="flex items-center gap-2">
        <label class="font-bold text-sm text-[var(--text-secondary)]">Impresora</label>
        <select v-model="printerType" class="p-2 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none focus:border-[var(--accent)]">
          <option value="usb">USB</option>
          <option value="lan">LAN (Red)</option>
        </select>
        
        <div v-if="printerType === 'lan'" class="flex items-center gap-2">
           <input v-model="printerInfo.ip" placeholder="192.168.x.x" class="p-2 w-36 rounded bg-[var(--input-bg)]" />
           <input v-model.number="printerInfo.port" type="number" placeholder="9100" class="p-2 w-20 rounded bg-[var(--input-bg)]" />
           <button @click="fillLocalIp" class="text-xs bg-blue-600 text-white px-2 py-2 rounded">Mi IP</button>
        </div>

        <div v-if="printerType === 'usb'" class="flex items-center gap-2">
           <select v-model="selectedUsbDevice" class="p-2 w-48 md:w-64 rounded bg-[var(--input-bg)]" @change="handleUsbSelect">
              <option :value="null">-- Seleccionar --</option>
              <option v-for="(dev, idx) in usbDevices" :key="idx" :value="dev.val">{{ dev.name }}</option>
           </select>
           <button @click="listUsbDevices" class="p-2 bg-[var(--accent)] text-white rounded">🔄</button>
        </div>
      </div>
      
      <div class="ml-auto flex items-center gap-2">
        <label class="flex items-center cursor-pointer select-none">
           <input type="checkbox" v-model="usarImpresora" class="mr-2"> Imprimir Ticket
        </label>
      </div>
    </div>

    <!-- ... (RESTO DEL TEMPLATE EXACTAMENTE IGUAL) ... -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden pb-1">
      <div class="lg:col-span-2 flex flex-col overflow-hidden">
         <div class="p-4 bg-[var(--panel)] rounded mb-4 flex gap-2 border border-[var(--border)] shadow-sm">
            <input v-model="scan" @keyup.enter="handleScanEnter" placeholder="Código de barras (Enter)" class="flex-1 p-3 bg-[var(--input-bg)] rounded" />
            <button @click="handleScanEnter" class="px-6 bg-[var(--accent)] text-white font-bold rounded">AÑADIR</button>
         </div>
         <div class="p-4 bg-[var(--panel)] rounded flex-1 flex flex-col overflow-hidden relative">
             <input v-model="q" @input="search" placeholder="Buscar por nombre..." class="w-full p-2 mb-3 bg-[var(--input-bg)] rounded" />
             <div class="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 content-start pr-2 custom-scroll">
                <div v-for="p in productos" :key="p.id_producto" class="p-3 bg-[var(--bg-deep)] border rounded cursor-pointer hover:border-[var(--accent)] h-24 flex flex-col justify-between" @click="addProduct(p)">
                    <div class="font-bold text-sm line-clamp-2">{{ p.nombre }}</div>
                    <div class="text-right font-mono">{{ formatPrice(p.precio) }}</div>
                </div>
             </div>
         </div>
      </div>

      <div class="bg-[var(--panel)] rounded flex flex-col h-full border border-[var(--border)] shadow-sm overflow-hidden">
         <div class="p-4 border-b border-[var(--border)] bg-[var(--bg-deep)]"><h3 class="font-bold text-lg">Ticket</h3></div>
         <div class="flex-1 overflow-y-auto p-2 custom-scroll">
             <div v-for="(it,i) in cart" :key="i" class="flex justify-between items-center p-2 mb-1 bg-[var(--bg-deep)] rounded border">
                 <div class="flex-1 pr-2">
                     <div class="text-sm font-medium">{{ it.nombre }}</div>
                     <div class="text-xs text-[var(--text-secondary)]">{{ formatPrice(it.precio) }} x <input type="number" v-model.number="it.cantidad" class="w-10 bg-[var(--input-bg)] text-center rounded"></div>
                 </div>
                 <div class="text-right">
                     <div class="font-bold">{{ formatPrice(it.subtotal) }}</div>
                     <button @click="cart.splice(i, 1)" class="text-[10px] text-red-500 uppercase">Quitar</button>
                 </div>
             </div>
         </div>
         <div class="p-4 border-t bg-[var(--panel)]">
             <div class="flex justify-between mb-4"><span class="text-xs font-bold uppercase">Total</span><span class="text-3xl font-bold">{{ formatPrice(total) }}</span></div>
             <button @click="checkout" :disabled="isLoading" class="w-full py-3 bg-green-600 text-white font-bold rounded">PAGAR</button>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { fetchProducts, emitirVenta } from '../api'
import { useAuth } from '../composables/useAuth.js'
import { generarTicketEscPos } from "../utils/escposEncoder.js"; 
import { PrinterService } from '../utils/PrinterService.js';     

const { currentUser } = useAuth()

// CONFIG
const savedConfig = JSON.parse(localStorage.getItem('printer_config') || '{}')
const printerType = ref(savedConfig.type || 'usb')
const printerInfo = ref(savedConfig.info || { ip: '', port: 9100 })
const usarImpresora = ref(savedConfig.active !== undefined ? savedConfig.active : true)
const usbDevices = ref([])
const selectedUsbDevice = ref(null) 
const isLoading = ref(false)

const isElectron = !!window.electronAPI;

// WATCHER (Ojo: Para WebUSB no podemos guardar el objeto 'device' en localStorage porque es complejo.
// Guardamos solo flag o intentamos reconectar al inicio)
watch([printerType, printerInfo, usarImpresora], () => {
  localStorage.setItem('printer_config', JSON.stringify({
      type: printerType.value,
      info: printerInfo.value,
      active: usarImpresora.value,
      // No guardamos lastUsbVal complejo aquí para evitar errores de serialización en WebUSB
  }))
}, { deep: true })

const scan = ref(''); const q = ref(''); const productos = ref([]); const cart = ref([]);
const total = computed(() => cart.value.reduce((a,b) => a + (b.subtotal||0), 0));
function formatPrice(val) { return new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP'}).format(val||0) }
function clear() { cart.value = [] }

// --- LISTAR USB ---
async function listUsbDevices() {
    isLoading.value = true;
    try {
        usbDevices.value = await PrinterService.listarUSB();
        
        // Si hay una impresora "Click para conectar" (WebUSB), la pre-seleccionamos
        if (!isElectron && usbDevices.value.length > 0 && !selectedUsbDevice.value) {
             // Si ya tenemos permiso, seleccionamos el primero
             if (usbDevices.value[0].val !== "NEW_WEBUSB") {
                 selectedUsbDevice.value = usbDevices.value[0].val;
             }
        }
    } catch(e) { console.error(e); }
    finally { isLoading.value = false; }
}

// --- MANEJAR SELECCIÓN USB (Especial para WebUSB) ---
async function handleUsbSelect() {
    if (!isElectron && selectedUsbDevice.value === "NEW_WEBUSB") {
        // El usuario seleccionó "Click para conectar"
        const result = await PrinterService.requestWebUsb();
        if (result) {
            // Actualizamos la lista con el dispositivo ya autorizado
            usbDevices.value = [result];
            selectedUsbDevice.value = result.val;
        } else {
            selectedUsbDevice.value = null; // Cancelado
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

// ... (search, addProduct, handleScanEnter IGUALES) ...
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
    if (exist) { exist.cantidad++; exist.subtotal = exist.cantidad * exist.precio }
    else { cart.value.push({ ...p, cantidad: 1, subtotal: p.precio }) }
}
async function handleScanEnter() {
    if(!scan.value) return;
    try {
        const r = await fetchProducts(scan.value);
        const list = r.data ?? r;
        if (list && list.length > 0) addProduct(list[0]);
    } catch(e){}
    scan.value = '';
}

// --- CHECKOUT ---
async function checkout() {
    if (cart.value.length === 0) return alert('Carrito vacío');
    isLoading.value = true;

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

            // Datos Bytes (Para Web)
            let rawBytes = null;
            if (!isElectron) {
                rawBytes = generarTicketEscPos(printDataObj, timbreXml);
            }

            // ENVIAR
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
        
        cart.value = [];
        if(isElectron) alert('Venta OK');

    } catch (e) {
        console.error(e);
        alert('Error: ' + (e.message || e));
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    // search(); 
    listUsbDevices();
    if(isElectron) fillLocalIp();
});
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
</style>
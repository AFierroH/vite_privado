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
          <div class="relative group">
             <input v-model="printerInfo.ip" placeholder="192.168.x.x" class="p-2 w-36 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none focus:border-[var(--accent)]" />
             <div class="absolute hidden group-hover:block bottom-full mb-1 left-0 bg-black text-white text-xs p-1 rounded">IP de la impresora</div>
          </div>
          <input v-model.number="printerInfo.port" type="number" placeholder="9100" class="p-2 w-20 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none focus:border-[var(--accent)]" />
          
          <button @click="fillLocalIp" class="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-2 rounded font-bold" title="Usar mi subred">
            Mi IP
          </button>
        </div>

        <div v-if="printerType === 'usb'" class="flex items-center gap-2">
           <select v-model="selectedUsbDevice" class="p-2 w-48 md:w-64 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none focus:border-[var(--accent)]">
              <option :value="null">-- Seleccionar --</option>
              <option v-for="(dev, idx) in usbDevices" :key="idx" :value="dev">{{ dev.name }}</option>
           </select>
           <button @click="listUsbDevices" class="p-2 bg-[var(--accent)] text-[var(--text-on-accent)] rounded hover:opacity-90 transition" title="Recargar USB">
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
          <div class="ml-2 text-sm font-medium">Imprimir Ticket</div>
        </label>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden pb-1">
      
      <div class="lg:col-span-2 flex flex-col overflow-hidden">
         <div class="p-4 bg-[var(--panel)] rounded mb-4 flex gap-2 border border-[var(--border)] shadow-sm">
            <input v-model="scan" @keyup.enter="handleScanEnter" placeholder="Código de barras (Enter)" class="flex-1 p-3 bg-[var(--input-bg)] rounded border border-[var(--input-border)] text-lg outline-none focus:border-[var(--accent)]" />
            <button @click="handleScanEnter" class="px-6 bg-[var(--accent)] text-[var(--text-on-accent)] font-bold rounded hover:opacity-90 transition shadow">AÑADIR</button>
         </div>

         <div class="p-4 bg-[var(--panel)] rounded flex-1 flex flex-col overflow-hidden border border-[var(--border)] shadow-sm relative">
             <input v-model="q" @input="search" placeholder="Buscar por nombre..." class="w-full p-2 mb-3 bg-[var(--input-bg)] rounded border border-[var(--input-border)] outline-none focus:border-[var(--accent)]" />
             
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
             <h3 class="font-bold text-lg">Ticket de Venta</h3>
         </div>

         <div class="flex-1 overflow-y-auto p-2 custom-scroll">
             <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] italic opacity-50">
                 Vacío
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
                     <button @click="cart.splice(i, 1)" class="text-[10px] text-red-500 hover:text-red-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wide">Quitar</button>
                 </div>
             </div>
         </div>

         <div class="p-4 border-t border-[var(--border)] bg-[var(--panel)]">
             <div class="flex justify-between items-end mb-4">
                 <span class="text-[var(--text-secondary)] font-medium uppercase text-xs tracking-wider">Total</span>
                 <span class="text-3xl font-bold text-[var(--accent)]">{{ formatPrice(total) }}</span>
             </div>
             
             <div class="grid grid-cols-3 gap-2">
                 <button @click="clear" class="col-span-1 py-3 bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 rounded font-bold transition">Limpiar</button>
                 <button @click="checkout" :disabled="isLoading" class="col-span-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold shadow-lg transition transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
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
import { generarTicketEscPos } from "../utils/escposEncoder.js";
import { printFromWebRaw } from "../utils/printWeb.js";

// IMPORTAMOS QZ TRAY (Solo funcionará en web, Electron lo ignorará o no lo usará)
import qz from 'qz-tray'; 

const { currentUser } = useAuth()

const savedConfig = JSON.parse(localStorage.getItem('printer_config') || '{}')
const printerType = ref(savedConfig.type || 'usb')
const printerInfo = ref(savedConfig.info || { ip: '', port: 9100 })
const usarImpresora = ref(savedConfig.active !== undefined ? savedConfig.active : true)
const usbDevices = ref([])
const selectedUsbDevice = ref(null)
const isLoading = ref(false)

// DETECTAR ENTORNO
const isElectron = !!window.electronAPI;

// Guardar config automáticamente
watch([printerType, printerInfo, usarImpresora, selectedUsbDevice], () => {
  // En WEB, selectedUsbDevice es {name: "Printer"}, en ELECTRON es {name, vid, pid}
  // Guardamos lo necesario para recuperar
  localStorage.setItem('printer_config', JSON.stringify({
      type: printerType.value,
      info: printerInfo.value,
      active: usarImpresora.value,
      // Guardamos el objeto completo para simplificar la recarga
      lastUsbDevice: selectedUsbDevice.value 
  }))
}, { deep: true })

const scan = ref('')
const q = ref('')
const productos = ref([])
const cart = ref([])

function formatPrice(val) { return new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP'}).format(val||0) }

// --- HELPERS UNIFICADOS (BÚSQUEDA) ---
async function listUsbDevices() {
    isLoading.value = true;
    usbDevices.value = [];

    // 1. MODO ELECTRON
    if (isElectron) {
        try {
            const list = await window.electronAPI.listUsbDevices()
            usbDevices.value = list
            
            // Recuperar selección previa (por VID/PID)
            if (savedConfig.lastUsbDevice && savedConfig.lastUsbDevice.vid) {
                const found = list.find(d => d.vid === savedConfig.lastUsbDevice.vid && d.pid === savedConfig.lastUsbDevice.pid)
                if (found) selectedUsbDevice.value = found
            }
        } catch(e) { console.error("Error Electron USB:", e) }
    
    // 2. MODO WEB (QZ TRAY)
    } else {
        try {
            // Conectar si no está activo
            if (!qz.websocket.isActive()) {
                await qz.websocket.connect();
            }
            // Buscar impresoras en el sistema (Windows Spooler)
            const printers = await qz.printers.find();
            
            // Mapeamos a objetos para que el <select> no se rompa (espera .name)
            usbDevices.value = printers.map(pName => ({ name: pName, isQZ: true }));

            // Recuperar selección previa (por Nombre)
            if (savedConfig.lastUsbDevice && savedConfig.lastUsbDevice.name) {
                const found = usbDevices.value.find(d => d.name === savedConfig.lastUsbDevice.name)
                if (found) selectedUsbDevice.value = found
            }
        } catch(e) {
            console.error("Error QZ Tray:", e);
            alert("Error QZ Tray: Asegúrate de tenerlo instalado y abierto.");
        }
    }
    isLoading.value = false;
}

async function fillLocalIp() {
    if (isElectron) {
        try {
            const ip = await window.electronAPI.getLocalIp()
            if(ip) {
                const parts = ip.split('.')
                if(parts.length === 4) {
                     printerInfo.value.ip = `${parts[0]}.${parts[1]}.${parts[2]}.`
                } else {
                     printerInfo.value.ip = ip
                }
            }
        } catch(e) { alert("Error IP Electron: " + e) }
    } else {
        alert("En modo Web no podemos detectar tu IP local automáticamente.");
    }
}

// --- LOGICA VENTA ---
async function search() {
    isLoading.value = true
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    const myEmpresaId = session.user?.id_empresa || 1;
    try {
        const r = await fetchProducts(q.value, myEmpresaId)
        productos.value = r.data ?? r ?? []
    } catch(e) { productos.value = [] }
    finally { isLoading.value = false }
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
    
    isLoading.value = true;
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    const user = currentUser.value || {}
    const empresa = session.empresa || {}
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
        usarImpresora: false // Siempre false al backend, nosotros imprimimos
    }

    try {
        const resp = await emitirVenta(payload)
        const data = resp?.data ?? resp
        if (!data) throw new Error("Sin respuesta del servidor")

        const folioReal = data.folio || data.venta?.id_venta || '---';
        const timbreXml = data.timbre; 

        // PREPARAR DATOS DE IMPRESIÓN (OBJETO)
        const printData = {
            empresa: { 
                razonSocial: empresa.nombre || 'Sin Nombre',
                rut: empresa.rut || '22.222.222-2',
                direccion: empresa.direccion || 'Temuco'
            },
            venta: { id_venta: folioReal, fecha: new Date().toLocaleString() },
            detalles: payload.detalles.map(d => ({ ...d, subtotal: d.cantidad * d.precio_unitario })),
            total: total.value
        }

        // --- IMPRESIÓN ---
        if (usarImpresora.value) {
            
            // =========================
            // CASO 1: MODO ELECTRON
            // =========================
            if (isElectron) {
                const opts = {
                    type: printerType.value,
                    ip: printerInfo.value.ip,
                    port: printerInfo.value.port,
                    vid: selectedUsbDevice.value?.vid,
                    pid: selectedUsbDevice.value?.pid,
                    content417: timbreXml
                }
                const r = await window.electronAPI.printFromData(printData, opts)
                if (!r.ok) alert('Venta OK, Error impresora: ' + r.error)

            // =========================
            // CASO 2: MODO WEB (QZ TRAY)
            // =========================
            } else {
                try {
                    // Generar bytes ESC/POS (Necesitas importar tu función existente)
                    const bytes = generarTicketEscPos(printData, timbreXml);
                    
                    // Conectar QZ
                    if (!qz.websocket.isActive()) await qz.websocket.connect();

                    // Configurar destino
                    let config;
                    if (printerType.value === 'lan') {
                        config = qz.configs.create({ host: printerInfo.value.ip, port: printerInfo.value.port });
                    } else {
                        // USB por nombre
                        if (!selectedUsbDevice.value?.name) throw new Error("Selecciona una impresora USB");
                        config = qz.configs.create(selectedUsbDevice.value.name);
                    }

                    // Enviar
                    await qz.print(config, bytes);
                    console.log("Impresión Web enviada");

                } catch (qzErr) {
                    console.error("Error QZ:", qzErr);
                    alert("Error imprimiendo (Web): " + qzErr);
                }
            }
        }

        cart.value = [];

    } catch (e) {
        console.error(e)
        alert('Error: ' + (e.message || e))
    } finally {
        isLoading.value = false;
    }
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
    // search() // Si quieres buscar productos al inicio
    listUsbDevices() // Llama a la funcion unificada
})
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
</style>
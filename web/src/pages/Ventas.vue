<template>
  <div class="h-full flex flex-col bg-[var(--bg-deep)] text-[var(--text-primary)] transition-colors overflow-hidden">
    
    <div class="p-2 bg-[var(--panel)] border-b border-[var(--border)] shadow-sm flex flex-col gap-2">
      <div class="hidden md:flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
           <label class="text-xs font-bold">Impresora</label>
           <select v-model="printerType" class="p-1 text-xs rounded bg-[var(--input-bg)] border border-[var(--input-border)]">
             <option value="usb">USB</option>
             <option value="lan">LAN</option>
           </select>
           <label class="flex items-center cursor-pointer select-none ml-2">
             <input type="checkbox" v-model="usarImpresora" class="mr-1 accent-[var(--accent)]">
             <span class="text-xs">Ticket</span>
           </label>
        </div>
      </div>

      <div class="flex gap-2">
        <div class="relative flex-1">
            <input 
              ref="searchInput"
              v-model="q" 
              @input="search" 
              placeholder="Buscar producto..." 
              class="w-full p-2 pl-3 rounded bg-[var(--input-bg)] border border-[var(--input-border)] outline-none focus:border-[var(--accent)]" 
            />
        </div>
        
        <button @click="toggleScanner" class="bg-blue-600 text-white px-3 py-2 rounded shadow flex items-center gap-2">
            📷 <span class="hidden sm:inline">Escanear</span>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-hidden relative">
      
      <div v-if="showScanner" class="absolute inset-0 z-50 bg-black flex flex-col">
          <div class="p-4 flex justify-between items-center bg-gray-900 text-white">
              <h3 class="font-bold">Escaneando...</h3>
              <button @click="toggleScanner" class="text-red-500 font-bold px-4 py-2 border border-red-500 rounded">CERRAR X</button>
          </div>
          <div id="reader" class="flex-1 bg-black w-full"></div>
          <div class="p-4 text-center text-gray-400 text-sm">
              Apunta la cámara al código de barras
          </div>
      </div>

      <div class="hidden md:grid grid-cols-3 gap-4 h-full p-4">
          <div class="col-span-2 flex flex-col bg-[var(--panel)] rounded border border-[var(--border)] overflow-hidden">
              <div class="flex-1 overflow-y-auto p-2 grid grid-cols-3 lg:grid-cols-4 gap-3 content-start custom-scroll">
                  <div v-for="p in productos" :key="p.id_producto" 
                       @click="addProduct(p)"
                       class="p-2 bg-[var(--bg-deep)] border border-[var(--border)] rounded cursor-pointer hover:border-[var(--accent)] flex flex-col justify-between h-24 active:scale-95">
                       <div class="font-bold text-xs line-clamp-2">{{ p.nombre }}</div>
                       <div class="text-right font-mono font-bold text-sm text-[var(--accent)]">{{ formatPrice(p.precio) }}</div>
                  </div>
              </div>
          </div>
          <div class="col-span-1 bg-[var(--panel)] rounded border border-[var(--border)] flex flex-col overflow-hidden">
              <TicketCart :cart="cart" :total="total" @remove="removeFromCart" @clear="clear" @checkout="checkout" :isLoading="isLoading" />
          </div>
      </div>

      <div class="md:hidden flex flex-col h-full">
          <div class="flex border-b border-[var(--border)] bg-[var(--panel)]">
              <button @click="activeTab = 'products'" :class="['flex-1 py-3 text-center font-bold text-sm', activeTab==='products' ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'text-[var(--text-secondary)]']">
                  📦 Productos
              </button>
              <button @click="activeTab = 'cart'" :class="['flex-1 py-3 text-center font-bold text-sm', activeTab==='cart' ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'text-[var(--text-secondary)]']">
                  🛒 Carrito ({{ cart.length }})
              </button>
          </div>

          <div class="flex-1 overflow-y-auto bg-[var(--bg-deep)] p-2">
              
              <div v-show="activeTab === 'products'" class="grid grid-cols-2 gap-3">
                  <div v-for="p in productos" :key="p.id_producto" 
                       @click="addProduct(p)"
                       class="p-3 bg-[var(--panel)] border border-[var(--border)] rounded shadow-sm active:scale-95 transition-transform">
                       <div class="font-bold text-sm mb-1">{{ p.nombre }}</div>
                       <div class="flex justify-between items-center">
                           <span class="text-xs text-gray-500">{{ p.codigo_barra }}</span>
                           <span class="font-bold text-[var(--accent)]">{{ formatPrice(p.precio) }}</span>
                       </div>
                  </div>
                  <div v-if="productos.length === 0" class="col-span-2 text-center py-10 text-gray-500">Sin resultados</div>
              </div>

              <div v-show="activeTab === 'cart'" class="h-full flex flex-col">
                  <TicketCart :cart="cart" :total="total" @remove="removeFromCart" @clear="clear" @checkout="checkout" :isLoading="isLoading" />
              </div>
          </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch, h, nextTick} from 'vue'
import { fetchProducts, emitirVenta } from '../api'
import { useAuth } from '../composables/useAuth.js'
import { generarTicketEscPos } from "../utils/escposEncoder.js"; 
import { PrinterService } from '../utils/PrinterService.js'; 
import { ScannerListener } from '../utils/ScannerListener.js';
import { Html5Qrcode } from "html5-qrcode" 

const TicketCart = (props, { emit }) => {
    return h('div', { class: 'flex flex-col h-full' }, [
        h('div', { class: 'flex-1 overflow-y-auto p-2' }, 
            props.cart.length === 0 
            ? h('div', { class: 'h-full flex items-center justify-center text-gray-500 italic' }, 'Carrito Vacío')
            : props.cart.map((it, i) => h('div', { class: 'flex justify-between p-2 mb-2 bg-[var(--bg-deep)] rounded border border-[var(--border)]' }, [
                h('div', {}, [
                    h('div', { class: 'font-bold text-sm' }, it.nombre),
                    h('div', { class: 'text-xs text-gray-400' }, `${it.cantidad} x ${props.total/props.cart.reduce((a,b)=>a+b.subtotal,0) ? it.precio : it.precio}`) // Simplificado para visual
                ]),
                h('div', { class: 'text-right' }, [
                    h('div', { class: 'font-bold' }, `$${it.subtotal}`),
                    h('button', { class: 'text-xs text-red-500 font-bold p-1', onClick: () => emit('remove', i) }, 'X')
                ])
            ]))
        ),
        h('div', { class: 'p-4 bg-[var(--panel)] border-t border-[var(--border)]' }, [
            h('div', { class: 'flex justify-between items-end mb-4' }, [
                h('span', { class: 'text-xs uppercase font-bold' }, 'Total'),
                h('span', { class: 'text-2xl font-bold text-[var(--accent)]' }, `$${props.total}`)
            ]),
            h('button', { 
                class: 'w-full py-3 bg-green-600 text-white font-bold rounded shadow disabled:opacity-50',
                disabled: props.isLoading,
                onClick: () => emit('checkout')
            }, props.isLoading ? 'Procesando...' : 'PAGAR')
        ])
    ])
}


const { currentUser } = useAuth()
const searchInput = ref(null)
const activeTab = ref('products') 
const showScanner = ref(false)
let html5QrCode = null

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

const q = ref(''); const productos = ref([]); const cart = ref([]);
const total = computed(() => cart.value.reduce((a,b) => a + (b.subtotal||0), 0));
function formatPrice(val) { return new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP'}).format(val||0) }
function clear() { cart.value = []; q.value = ''; search(); }

async function handleGlobalScan(code, isInputFocused) {
    if (isInputFocused) return;

    try {
        console.log("Buscando código escaneado:", code);

        const session = JSON.parse(localStorage.getItem('session') || '{}');
        const myEmpresaId = session.user?.id_empresa || 1; 
        const r = await fetchProducts(code, myEmpresaId); 
        
        const list = r.data ?? r;
        
        if (list && list.length > 0) {
            const producto = list[0];
            if (producto.id_empresa && producto.id_empresa !== myEmpresaId) {
                 alert('PELIGRO: Se detectó un producto de otra empresa. Revisa tu base de datos.');
                 return;
            }

            addProduct(producto);
        } else {
            alert('Producto no encontrado con código: ' + code);
        }
    } catch (e) {
        console.error("Error al buscar escaneo:", e);
    }
}
async function toggleScanner() {
    if (showScanner.value) {
        // Cerrar
        if (html5QrCode) {
            await html5QrCode.stop().catch(err => console.error(err));
            html5QrCode = null;
        }
        showScanner.value = false;
    } else {
        // Abrir
        showScanner.value = true;
        await nextTick(); // Esperar a que el div #reader exista
        
        html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
        .catch(err => {
            console.error("Error iniciando cámara", err);
            alert("No se pudo iniciar la cámara. Verifica permisos HTTPS.");
            showScanner.value = false;
        });
    }
}
function onScanSuccess(decodedText, decodedResult) {
    console.log(`Código escaneado: ${decodedText}`);
    handleGlobalScan(decodedText, false);
    
    // Opcional: Cerrar escáner al encontrar uno, o dejarlo abierto para escaneo continuo
    // toggleScanner(); 

    alert(`Escaneado: ${decodedText}`);
}

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

async function checkout() {
    if (cart.value.length === 0) return alert('Carrito vacío');
    isLoading.value = true;
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    const user = currentUser.value || session.user || {};
    const empresa = session.empresa || {};
    const myEmpresaId = user.id_empresa || user.empresaId || 1;
    const payload = {
        id_usuario: user.id || 1, 
        id_empresa: myEmpresaId,
        total: total.value,
        detalles: cart.value.map(i => ({ 
            id_producto: i.id_producto, 
            cantidad: i.cantidad, 
            precio_unitario: i.precio, 
            nombre: i.nombre 
        })),
        pagos: [{ id_pago: 1, monto: total.value }], 
        usarImpresora: false 
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
        
        cart.value = [];
        if(isElectron) alert('Venta finalizada');

    } catch (e) {
        console.error(e);
        alert('Error: ' + (e.message || e));
    } finally {
        isLoading.value = false;
    }
}

async function listUsbDevices() {
    isLoading.value = true;
    try {
        usbDevices.value = await PrinterService.listarUSB();
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

onMounted(() => {
    search();
    listUsbDevices();
    if(isElectron) fillLocalIp();
    ScannerListener.onScan(handleGlobalScan);
});

onUnmounted(() => {
    ScannerListener.offScan(handleGlobalScan);
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
});
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
</style>
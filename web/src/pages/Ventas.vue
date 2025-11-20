<template>
  <div class="p-4">
    <div class="mb-4 flex items-center gap-4">
      <div class="flex items-center gap-2">
        <label class="text-white">Modo:</label>
        <select v-model="sessionMode" class="p-2 rounded bg-[#081026] text-white">
          <option value="normal">Normal</option>
          <option value="voucher">Voucher</option>
        </select>
      </div>

      <div class="flex items-center gap-2 ml-6 p-2 bg-[#0d1b3a] rounded border border-gray-700">
        <label class="text-white font-bold">Impresora:</label>
        <select v-model="printerType" class="p-2 rounded bg-[#081026] text-white">
          <option value="lan">Red (LAN)</option>
          <option value="usb">USB (Directo)</option>
        </select>
      
        <div v-if="printerType === 'lan'" class="flex items-center gap-2">
          <input v-model="printerInfo.ip" placeholder="192.168.X.X" class="p-2 w-32 rounded bg-[#081026] text-white" />
          <input v-model.number="printerInfo.port" type="number" placeholder="9100" class="p-2 w-20 rounded bg-[#081026] text-white" />
        </div>

        <div v-if="printerType === 'usb'" class="flex items-center gap-2">
           <select v-model="selectedUsbDevice" class="p-2 w-64 rounded bg-[#081026] text-white">
              <option :value="null">-- Selecciona Dispositivo --</option>
              <option v-for="(dev, idx) in usbDevices" :key="idx" :value="dev">
                 {{ dev.name }}
              </option>
           </select>
           <button @click="listUsbDevices" class="px-3 py-2 bg-blue-600 rounded text-white text-sm">🔄 Escanear USB</button>
        </div>
      </div>

      <div class="ml-auto flex items-center gap-3">
        <label class="text-white flex items-center gap-1 cursor-pointer">
          <input type="checkbox" v-model="usarImpresora" />
          <span>🖨️ Activar Impresión</span>
        </label>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-6">
        <div class="col-span-2">
            <div class="p-4 bg-[var(--panel)] rounded mb-4">
                 <div class="flex items-center gap-3">
                    <input v-model="scan" @keyup.enter="handleScanEnter" placeholder="Escanea código o ingresa SKU" class="p-2 bg-[#081026] rounded w-1/2 text-white" />
                    <button @click="handleScanEnter" class="px-3 py-2 bg-[var(--accent)] rounded text-black">Añadir</button>
                    <div class="ml-auto">
                        <button @click="testPrint" class="px-3 py-2 bg-gray-600 rounded text-white hover:bg-gray-500">Probar Ticket</button>
                    </div>
                 </div>
             </div>
             <div class="p-4 bg-[var(--panel)] rounded">
                 <input v-model="q" @input="search" placeholder="Buscar productos..." class="w-full p-2 mb-3 bg-[#081026] rounded text-white" />
                 <div class="grid grid-cols-3 gap-3">
                    <div v-for="p in productos" :key="p.id_producto" class="p-3 bg-[#071226] rounded cursor-pointer hover:bg-[#1a2642]" @click="addProduct(p)">
                        <div class="font-medium">{{ p.nombre }}</div>
                        <div class="text-sm text-[var(--muted)]">{{ formatPrice(p.precio) }}</div>
                    </div>
                 </div>
             </div>
        </div>
        
        <div>
            <div class="p-4 bg-[var(--panel)] rounded h-full flex flex-col">
                <h3 class="mb-4 font-bold text-xl border-b border-gray-700 pb-2">Ticket de Venta</h3>
                <div class="flex-1 overflow-y-auto">
                     <div v-for="(it,i) in cart" :key="i" class="flex justify-between py-2 border-b border-gray-800 items-center">
                        <div>
                            <div class="font-medium">{{it.nombre}}</div>
                            <div class="text-xs text-gray-400">{{ formatPrice(it.precio) }} x {{ it.cantidad }}</div>
                        </div>
                        <div class="font-bold">{{ formatPrice(it.subtotal) }}</div>
                     </div>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-700">
                    <div class="flex justify-between text-xl font-bold mb-4">
                        <span>TOTAL</span>
                        <span>{{ formatPrice(total) }}</span>
                    </div>
                    <button class="w-full py-3 bg-green-600 hover:bg-green-500 rounded text-white font-bold text-lg shadow" @click="checkout">
                        COBRAR E IMPRIMIR
                    </button>
                    <button class="w-full mt-2 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300" @click="clear">
                        Cancelar
                    </button>
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
// Si no hay guardada, ponemos vacío en IP
const printerInfo = ref(savedConfig.info || { ip: '', port: 9100 }) 

const usbDevices = ref([]) 
const selectedUsbDevice = ref(null)
const usarImpresora = ref(savedConfig.active !== undefined ? savedConfig.active : true)

watch([printerType, printerInfo, usarImpresora, selectedUsbDevice], () => {
  const configToSave = {
    type: printerType.value,
    info: printerInfo.value,
    active: usarImpresora.value,
    lastUsbVid: selectedUsbDevice.value?.vid,
    lastUsbPid: selectedUsbDevice.value?.pid
  }
  localStorage.setItem('printer_config', JSON.stringify(configToSave))
}, { deep: true })

const scan = ref('')
const q = ref('')
const productos = ref([])
const cart = ref([])
const sessionMode = ref('normal')
const voucherNumber = ref('')
const voucherLoaded = ref(null)

// --- FUNCIONES ---
function formatPrice(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(value) || 0)
}

async function listUsbDevices() {
  try {
    console.log('Escaneando USB...')
    const list = await window.electronAPI?.listUsbDevices?.() || []
    usbDevices.value = list
    
    // Lógica inteligente: Si ya teníamos uno guardado, lo buscamos
    if (savedConfig.lastUsbVid && savedConfig.lastUsbPid) {
        const found = list.find(d => d.vid === savedConfig.lastUsbVid && d.pid === savedConfig.lastUsbPid)
        if (found) selectedUsbDevice.value = found
    } 
    // Si no, seleccionamos el primero por defecto
    else if (list.length > 0 && !selectedUsbDevice.value) {
        selectedUsbDevice.value = list[0] 
    }
    console.log('USB Devices:', list)
  } catch (err) { console.error(err) }
}

async function search() {
  try {
    const r = await fetchProducts(q.value)
    productos.value = r.data ?? r
  } catch (err) { productos.value = [] }
}

function addProduct(p) {
  const found = cart.value.find(it => it.id_producto === p.id_producto)
  if (found) { found.cantidad++; found.subtotal = found.cantidad * p.precio }
  else { cart.value.push({ ...p, cantidad: 1, subtotal: p.precio }) }
}
function clear() { cart.value = []; voucherLoaded.value = null; }
const total = computed(() => cart.value.reduce((a, b) => a + (b.subtotal || 0), 0))

async function checkout() {
  if (cart.value.length === 0) return alert('Carrito vacío')

  const session = JSON.parse(localStorage.getItem('session') || '{}')
  const user = currentUser.value ?? {}
  const empresa = session.empresa || {} 

  const detallesPayload = cart.value.map(i => ({
    id_producto: i.id_producto,
    cantidad: i.cantidad,
    precio_unitario: i.precio,
    nombre: i.nombre
  }))

  const payload = {
    id_usuario: user.id || 1,
    id_empresa: user.empresaId ?? 1,
    total: total.value,
    detalles: detallesPayload,
    pagos: [{ id_pago: 1, monto: total.value }],
    usarImpresora: usarImpresora.value
  }

  try {
    const resp = await emitirVenta(payload)
    const data = resp?.data ?? resp 
    if (!data) return alert('Error respuesta backend')

    if (usarImpresora.value && window.electronAPI?.printFromData) {
       const saleForPrinter = {
          empresa: {
             razonSocial: empresa.nombre || 'Sin Nombre',
             rut: empresa.rut || 'Sin Rut',
             direccion: empresa.direccion || '',
          },
          venta: { 
             id_venta: data.venta?.id_venta || '---',
             fecha: new Date().toLocaleString('es-CL'),
          },
          detalles: cart.value.map(i => ({
             nombre: i.nombre, cantidad: i.cantidad, precio_unitario: i.precio, subtotal: i.subtotal
          })),
          total: total.value
       }

       const printOptions = {
          type: printerType.value, 
          ip: printerInfo.value.ip,
          port: printerInfo.value.port,
          vid: selectedUsbDevice.value?.vid,
          pid: selectedUsbDevice.value?.pid,
          content417: data.timbre || `VENTA-${data.id_venta}`
       }

       const r = await window.electronAPI.printFromData(saleForPrinter, printOptions)
       if (!r.ok) alert('Venta OK, pero error impresión: ' + r.error)
    }
    
    cart.value = []
    alert('Venta exitosa')
  } catch (err) {
    console.error(err)
    alert('Error procesando venta')
  }
}

async function testPrint() {
    if (!window.electronAPI?.printFromData) return alert('Electron no detectado')
    
    const dummy = {
        empresa: { razonSocial: 'TEST SYSTEM', rut: '1-9', direccion: 'Calle Falsa 123' },
        venta: { id_venta: 'TEST-001', fecha: new Date().toLocaleString() },
        detalles: [{ nombre: 'Producto Test', cantidad: 1, precio_unitario: 1000, subtotal: 1000 }],
        total: 1000
    }
    
    const opts = {
        type: printerType.value,
        ip: printerInfo.value.ip,
        port: printerInfo.value.port,
        vid: selectedUsbDevice.value?.vid,
        pid: selectedUsbDevice.value?.pid,
        content417: 'TEST-CODE'
    }
    
    const r = await window.electronAPI.printFromData(dummy, opts)
    if(!r.ok) alert(r.error)
}

onMounted(() => {
  search()
  listUsbDevices() 
})

async function handleScanEnter() {  }
async function redeemVoucher() {  }
</script>

<style scoped>

</style>
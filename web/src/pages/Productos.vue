<template>
  <div class="h-full flex flex-col p-4 bg-[var(--bg-deep)] text-[var(--text-primary)] transition-colors">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">Inventario de Productos</h2>
      <button @click="abrirModal()" class="px-4 py-2 rounded-lg font-bold shadow hover:opacity-90 transition btn-primary">
        + Nuevo Producto
      </button>
    </div>

    <div class="flex-1 bg-[var(--panel)] p-4 rounded-lg border border-[var(--border)] overflow-hidden flex flex-col shadow-sm relative">
       <div class="mb-4 relative">
         <input v-model="q" @input="buscarDesdeCero" placeholder="Buscar por nombre, código, marca..." class="w-full p-3 pl-10 bg-[var(--input-bg)] rounded-lg border border-[var(--input-border)] outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
         <span class="absolute left-3 top-3.5 text-gray-400">🔍</span>
      </div>

      <div class="overflow-y-auto flex-1 pr-2 space-y-2 custom-scroll relative" @scroll="handleScroll">
          <div v-for="p in productos" :key="p.id_producto" class="flex justify-between p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-deep)] items-center group">
            <div class="flex-1 min-w-0 pr-4">
              <div class="flex items-center gap-2">
                <div class="font-bold text-lg truncate">{{ p.nombre }}</div>
                <span v-if="p.marca" class="text-xs bg-gray-600 text-white px-1.5 rounded">{{ p.marca }}</span>
                <span v-if="p.descuento_pct > 0" class="text-xs bg-red-500 text-white px-1.5 rounded font-bold">-{{ p.descuento_pct }}%</span>
              </div>
              
              <div class="text-sm text-[var(--text-secondary)] flex flex-wrap gap-3 mt-1 items-center">
                 <span class="bg-[var(--panel)] px-2 py-0.5 rounded border border-[var(--border)] text-xs font-mono">STOCK: {{ p.stock }}</span>
                 
                 <div class="flex items-center gap-2">
                    <span :class="{'line-through text-gray-500 text-xs': p.descuento_pct > 0, 'font-bold text-[var(--accent)]': p.descuento_pct === 0}">
                        {{ formatPrice(p.precio) }}
                    </span>
                    <span v-if="p.descuento_pct > 0" class="font-bold text-red-400">
                        {{ formatPrice(p.precio - (p.precio * p.descuento_pct / 100)) }}
                    </span>
                 </div>

                 <span v-if="p.codigo_barra" class="text-xs text-gray-400">Cod: {{ p.codigo_barra }}</span>
              </div>
            </div>
            
            <div class="flex gap-2 shrink-0">
               <button @click="editarProducto(p)" class="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition">Editar</button>
               <button @click="eliminarProducto(p.id_producto)" class="px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition">✕</button>
            </div>
          </div>
          
          <div v-if="isLoading" class="py-4 text-center text-[var(--text-secondary)]">Cargando...</div>
          <div v-if="productos.length === 0 && !isLoading" class="py-10 text-center text-gray-500 italic">No hay productos</div>
      </div>
    </div>

    <div v-if="mostrarModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto py-4">
      <div class="bg-[var(--panel)] p-6 rounded-xl shadow-2xl w-full max-w-lg border border-[var(--border)] my-auto relative">
        <h3 class="text-xl font-bold mb-5 border-b border-[var(--border)] pb-2 text-[var(--text-primary)]">
            {{ productoActual.id_producto ? 'Editar Producto' : 'Nuevo Producto' }}
        </h3>
        
        <form @submit.prevent="guardarProducto" class="space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scroll">
          
          <div class="bg-blue-500/5 p-3 rounded border border-blue-500/20">
              <label class="block text-xs font-bold text-blue-400 uppercase mb-1">Código de Barra (Escanea ahora)</label>
              <input v-model="productoActual.codigo_barra" placeholder="Escanear..." class="w-full p-2 rounded bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-blue-500 text-blue-400 font-mono transition-colors outline-none" />
          </div>

          <div class="flex gap-4">
            <div class="flex-1">
                <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Nombre *</label>
                <input v-model="productoActual.nombre" class="w-full p-2.5 rounded bg-[var(--input-bg)] border border-[var(--input-border)] outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" required />
            </div>
            <div class="w-1/3">
                <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Marca</label>
                <input v-model="productoActual.marca" class="w-full p-2.5 rounded bg-[var(--input-bg)] border border-[var(--input-border)] outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
            </div>
          </div>

          <div>
              <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Proveedor</label>
              <input v-model="productoActual.proveedor" class="w-full p-2.5 rounded bg-[var(--input-bg)] border border-[var(--input-border)] outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
          </div>
          <div>
              <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Descripción</label>
              <textarea v-model="productoActual.descripcion" rows="2" class="w-full p-2.5 rounded bg-[var(--input-bg)] border border-[var(--input-border)] outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"></textarea>
          </div>

          <div class="flex gap-4">
              <div class="flex-1">
                  <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Precio *</label>
                  <input v-model.number="productoActual.precio" type="number" min="0" class="w-full p-2.5 rounded bg-[var(--input-bg)] border border-[var(--input-border)] outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" required />
              </div>
              <div class="flex-1">
                  <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Stock *</label>
                  <input v-model.number="productoActual.stock" type="number" min="0" class="w-full p-2.5 rounded bg-[var(--input-bg)] border border-[var(--input-border)] outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" required />
              </div>
          </div>

          <div class="flex gap-4 bg-[var(--bg-deep)] p-3 rounded border border-[var(--border)]">
              <div class="flex-1">
                  <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">N° Sellos (0-4)</label>
                  <input v-model.number="productoActual.n_sellos" type="number" min="0" max="4" class="w-full p-2 rounded bg-[var(--panel)] border border-[var(--input-border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
              </div>
              <div class="flex-1">
                  <label class="block text-xs font-bold text-red-400 uppercase mb-1">Desc. (%)</label>
                  <input v-model.number="productoActual.descuento_pct" type="number" min="0" max="100" class="w-full p-2 rounded bg-[var(--panel)] border border-[var(--input-border)] text-[var(--text-primary)] outline-none focus:border-red-400 placeholder-red-200" placeholder="0" />
              </div>
          </div>

          <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <button type="button" @click="cerrarModal" class="px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 rounded font-medium transition">Cancelar</button>
            <button type="submit" class="px-6 py-2 rounded bg-[var(--accent)] text-white font-bold shadow hover:opacity-90 transition">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { fetchProducts, addProduct, updateProduct, deleteProduct } from '../api'
import { ScannerListener } from '../utils/ScannerListener.js'; 

// VARIABLES
const productos = ref([]);
const q = ref('');
const isLoading = ref(false);
const page = ref(1);
const limit = 20;
const hasMore = ref(true);

const mostrarModal = ref(false);
// Inicialización completa para evitar undefined
const productoActual = ref({ 
    nombre: '', 
    precio: 0, 
    stock: 0, 
    codigo_barra: '', 
    marca: '',
    proveedor: '',
    descripcion: '',
    n_sellos: 0,
    descuento_pct: 0
});

function formatPrice(v) { return '$ ' + new Intl.NumberFormat('es-CL').format(v) }

// --- LOGICA ESCANER EN MODAL ---
function handleModalScan(code, isInputFocused) {
    if (mostrarModal.value) {
        productoActual.value.codigo_barra = code;
    }
}

// --- CRUD ---
async function buscarDesdeCero() {
    page.value = 1; hasMore.value = true; productos.value = [];
    await loadMore();
}

async function loadMore() {
    if (isLoading.value || !hasMore.value) return;
    isLoading.value = true;
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    const myEmpresaId = session.user?.id_empresa || 1;
    try {
        const r = await fetchProducts(q.value, myEmpresaId, page.value, limit);
        const nuevos = r.data || r || [];
        if (nuevos.length < limit) hasMore.value = false;
        productos.value = [...productos.value, ...nuevos];
        page.value++;
    } catch(e) {} finally { isLoading.value = false; }
}

// AQUÍ ESTÁ LA CORRECCIÓN CLAVE
function abrirModal() {
    productoActual.value = { 
        nombre: '', 
        precio: 0, 
        stock: 0, 
        codigo_barra: '', 
        marca: '',
        proveedor: '',
        descripcion: '',
        n_sellos: 0,
        descuento_pct: 0
    };
    mostrarModal.value = true;
}

function cerrarModal() { mostrarModal.value = false; }

function editarProducto(p) { 
    // Copiamos todo el objeto producto, asegurando que si algún campo es null venga vacío
    productoActual.value = { 
        ...p,
        proveedor: p.proveedor || '',
        descripcion: p.descripcion || '',
        n_sellos: p.n_sellos || 0,
        descuento_pct: p.descuento_pct || 0
    }; 
    mostrarModal.value = true; 
}

async function guardarProducto() {
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    const payload = { ...productoActual.value, id_empresa: session.user?.id_empresa || 1 };
    try {
        if (payload.id_producto) await updateProduct(payload.id_producto, payload);
        else await addProduct(payload);
        cerrarModal();
        buscarDesdeCero();
    } catch(e) { alert('Error guardando'); }
}

async function eliminarProducto(id) {
    if(confirm('Eliminar?')) {
        await deleteProduct(id);
        productos.value = productos.value.filter(p => p.id_producto !== id);
    }
}

function handleScroll(e) {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 50) loadMore();
}

// --- CICLO DE VIDA ---
onMounted(() => {
    buscarDesdeCero();
    ScannerListener.onScan(handleModalScan); 
});
onUnmounted(() => {
    ScannerListener.offScan(handleModalScan); 
});
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
</style>
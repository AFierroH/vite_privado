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
         <input
            v-model="q"
            @input="load"
            placeholder="Buscar por nombre o código..."
            class="w-full p-3 pl-10 bg-[var(--input-bg)] rounded-lg border border-[var(--input-border)] outline-none focus:border-[var(--accent)] text-[var(--text-primary)] transition-colors"
         />
         <svg class="w-5 h-5 text-[var(--text-secondary)] absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      </div>

      <div v-if="isLoading" class="absolute inset-0 top-[80px] bg-[var(--panel)]/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
          <svg class="animate-spin h-10 w-10 text-[var(--accent)] mb-3" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span class="text-sm font-bold text-[var(--text-secondary)]">Cargando inventario...</span>
      </div>

      <div v-else-if="productos.length === 0" class="text-[var(--text-secondary)] text-center py-10 flex-1 flex flex-col items-center justify-center">
        <svg class="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
        No se encontraron productos.
      </div>

      <div v-else class="overflow-y-auto flex-1 pr-2 space-y-2 custom-scroll">
          <div v-for="p in productos" :key="p.id_producto" class="flex justify-between p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-deep)] transition-colors items-center group">
            
            <div class="flex-1 min-w-0 pr-4">
              <div class="font-bold text-lg text-[var(--text-primary)] truncate">{{ p.nombre }}</div>
              <div class="text-sm text-[var(--text-secondary)] flex gap-3 mt-1 items-center">
                 <span class="bg-[var(--panel)] px-2 py-0.5 rounded border border-[var(--border)] text-xs font-mono">STOCK: {{ p.stock }}</span>
                 <span class="font-bold text-[var(--accent)]">{{ formatPrice(p.precio) }}</span>
              </div>
            </div>

            <div class="flex gap-2 shrink-0">
              <button @click="agregarStock(p.id_producto)" class="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 rounded font-bold transition text-sm" title="Sumar Stock">+1</button>
              <button @click="quitarStock(p.id_producto)" class="px-3 py-1.5 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 rounded font-bold transition text-sm" title="Restar Stock">-1</button>
              <button @click="editarProducto(p)" class="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 rounded transition text-sm font-medium">Editar</button>
              <button @click="eliminarProducto(p.id_producto)" class="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 rounded transition text-sm font-medium">✕</button>
            </div>
          </div>
      </div>
    </div>

    <div v-if="mostrarModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
      <div class="bg-[var(--panel)] p-6 rounded-xl shadow-2xl w-full max-w-md border border-[var(--border)] transform transition-all scale-100">
        <h3 class="text-xl font-bold mb-5 text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
            {{ productoActual.id_producto ? 'Editar Producto' : 'Nuevo Producto' }}
        </h3>
        
        <form @submit.prevent="guardarProducto" class="space-y-4">
          <div>
              <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Nombre del Producto</label>
              <input v-model="productoActual.nombre" class="w-full p-2.5 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all" required />
          </div>
          
          <div class="flex gap-4">
              <div class="flex-1">
                  <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Precio Venta</label>
                  <input v-model.number="productoActual.precio" type="number" min="0" class="w-full p-2.5 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all" required />
              </div>
              <div class="flex-1">
                  <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Stock Inicial</label>
                  <input v-model.number="productoActual.stock" type="number" min="0" class="w-full p-2.5 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all" required />
              </div>
          </div>

          <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <button type="button" @click="cerrarModal" class="px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 rounded-lg font-medium transition">Cancelar</button>
            <button type="submit" class="px-6 py-2 rounded-lg font-bold shadow-lg transition btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  fetchProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  agregarStockApi,
  quitarStockApi
} from '../api'

const productos = ref([])
const q = ref('')
const isLoading = ref(false)
const mostrarModal = ref(false)
const productoActual = ref({ nombre: '', precio: 0, stock: 0 })

function formatPrice(value) {
    return '$ ' + new Intl.NumberFormat('es-CL').format(value)
}

async function load() {
  isLoading.value = true
  const tInicio = performance.now()

  const session = JSON.parse(localStorage.getItem('session') || '{}')
  const myEmpresaId = session.user?.id_empresa || 1; 

  try {
    // Pasamos explícitamente el ID
    const r = await fetchProducts(q.value, myEmpresaId)
    const data = r.data ?? r
    productos.value = Array.isArray(data) ? data : []
    const tFinal = performance.now() // Cronómetro Fin
    console.log(`Rendimiento Carga: ${(tFinal - tInicio).toFixed(2)} ms | ${productos.value.length} items`)
  } catch (e) {
    console.error("Error cargando productos:", e)
    productos.value = []
  } finally {
    isLoading.value = false
  }
}

function abrirModal() {
  productoActual.value = { nombre: '', precio: 0, stock: 0 }
  mostrarModal.value = true
}

function cerrarModal() {
  mostrarModal.value = false
}

function editarProducto(p) {
  productoActual.value = { ...p }
  mostrarModal.value = true
}

async function guardarProducto() {
  try {
      if (productoActual.value.id_producto) {
        await updateProduct(productoActual.value.id_producto, productoActual.value)
      } else {
        await addProduct(productoActual.value)
      }
      cerrarModal()
      load() 
  } catch(e) { 
      alert('Error al guardar producto') 
  }
}

async function agregarStock(id) {
  try { await agregarStockApi(id, 1); load(); } catch(e){}
}

async function quitarStock(id) {
  try { await quitarStockApi(id, 1); load(); } catch(e){}
}

async function eliminarProducto(id) {
  if (confirm('¿Estás seguro de eliminar este producto?')) {
    try { await deleteProduct(id); load(); } catch(e) { alert('No se pudo eliminar'); }
  }
}

onMounted(load)
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
</style>
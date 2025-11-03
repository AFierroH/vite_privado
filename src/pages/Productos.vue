<template>
  <div>
    <div class="mb-4 flex justify-between items-center">
      <h2 class="text-xl font-semibold">Productos</h2>
      <button @click="abrirModal()" class="bg-[var(--accent)] px-3 py-2 rounded text-black">
        Nuevo Producto
      </button>
    </div>

    <div class="bg-[var(--panel)] p-4 rounded">
      <input
        v-model="q"
        @input="load"
        placeholder="Buscar..."
        class="w-full p-2 bg-[#081026] rounded text-white mb-4"
      />

      <div v-if="productos.length === 0" class="text-[var(--muted)] text-center py-4">
        No hay productos registrados.
      </div>

      <div
        v-for="p in productos"
        :key="p.id_producto"
        class="flex justify-between border-b border-gray-800 py-2 items-center"
      >
        <div>
          <div class="font-semibold">{{ p.nombre }}</div>
          <div class="text-sm text-[var(--muted)]">Stock: {{ p.stock }} | ${{ p.precio }}</div>
        </div>

        <div class="flex gap-2">
          <button @click="agregarStock(p.id_producto)" class="px-2 py-1 bg-green-600 text-white rounded">+1</button>
          <button @click="quitarStock(p.id_producto)" class="px-2 py-1 bg-yellow-600 text-white rounded">-1</button>
          <button @click="editarProducto(p)" class="px-2 py-1 bg-blue-600 text-white rounded">Editar</button>
          <button @click="eliminarProducto(p.id_producto)" class="px-2 py-1 bg-red-600 text-white rounded">X</button>
        </div>
      </div>
    </div>

    <!-- MODAL NUEVO / EDITAR -->
    <div v-if="mostrarModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center">
      <div class="bg-[var(--panel)] p-6 rounded shadow w-[400px]">
        <h3 class="text-lg font-semibold mb-3">{{ productoActual.id_producto ? 'Editar' : 'Nuevo' }} Producto</h3>
        <form @submit.prevent="guardarProducto">
          <input v-model="productoActual.nombre" placeholder="Nombre" class="w-full p-2 mb-2 rounded bg-[#081026] text-white" />
          <input v-model.number="productoActual.precio" placeholder="Precio" type="number" class="w-full p-2 mb-2 rounded bg-[#081026] text-white" />
          <input v-model.number="productoActual.stock" placeholder="Stock" type="number" class="w-full p-2 mb-2 rounded bg-[#081026] text-white" />
          <div class="flex justify-end gap-2">
            <button type="button" @click="cerrarModal" class="px-3 py-1 bg-gray-600 text-white rounded">Cancelar</button>
            <button type="submit" class="px-3 py-1 bg-[var(--accent)] text-black rounded">Guardar</button>
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
const mostrarModal = ref(false)
const productoActual = ref({ nombre: '', precio: 0, stock: 0 })

async function load() {
  try {
    const r = await fetchProducts(q.value)
    productos.value = r.data
  } catch {
    productos.value = [{ id_producto: 1, nombre: 'Demo', precio: 1500, stock: 10 }]
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
  if (productoActual.value.id_producto) {
    await updateProduct(productoActual.value.id_producto, productoActual.value)
  } else {
    await addProduct(productoActual.value)
  }
  cerrarModal()
  load()
}

async function agregarStock(id) {
  await agregarStockApi(id, 1)
  load()
}

async function quitarStock(id) {
  await quitarStockApi(id, 1)
  load()
}

async function eliminarProducto(id) {
  if (confirm('¿Eliminar producto?')) {
    await deleteProduct(id)
    load()
  }
}

onMounted(load)
</script>

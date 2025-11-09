<template>
  <aside class="w-1/5 max-w-[300px] bg-[var(--panel)] border-r border-gray-800 p-4 flex flex-col">
    <div class="mb-6">
      <div class="text-lg font-bold text-white">{{ user?.empresa || 'MiEmpresa' }}</div>
      <div class="text-xs text-[var(--muted)]">{{ user?.email || 'Cuenta demo' }}</div>
    </div>

    <nav class="flex-1 overflow-auto">
      <template v-for="item in filteredItems" :key="item.key">
        <button @click="$router.push(item.route)"
          class="w-full text-left px-3 py-2 rounded mb-1 text-[var(--muted)] hover:bg-[var(--accent)] hover:text-black transition">
          {{ item.title }}
        </button>
      </template>
    </nav>

    <button
      @click="$emit('logout')"
      class="mt-4 px-3 py-2 text-left rounded text-red-400 hover:bg-red-500 hover:text-white transition">
      Cerrar sesión
    </button>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
defineProps({ user: Object })

const items = [
  { key:'dashboard', title:'Dashboard', route:'/dashboard' },
  { key:'ventas', title:'Ventas', route:'/ventas' },
  { key:'productos', title:'Productos', route:'/productos', adminOnly: true },
  { key:'estadisticas', title:'Estadísticas', route:'/estadisticas', adminOnly: true },
  { key:'config', title:'Configuración', route:'/config', adminOnly: true },
  { key:'usuarios', title:'Usuarios', route:'/usuarios' },
  { key:'importer', title:'Importar BD', route:'/importer' },
  { key:'impresora', title:'Prueba', route:'/impresora' }
]

const filteredItems = computed(() =>
  (props.user?.rol === 'admin') ? items : items.filter(i => !i.adminOnly)
)
</script>

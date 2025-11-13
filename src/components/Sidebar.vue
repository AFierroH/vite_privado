<template>
  <aside 
    class="h-full bg-[var(--panel)] border-r border-gray-800 p-4 flex flex-col transition-all duration-300"
    :class="[
      'w-20', // Req #3: Colapsado por defecto en móvil
      isCollapsed ? 'lg:w-20' : 'lg:w-64' // Req #2: Estado en desktop
    ]"
  >
    <div class="mb-6">
      <div class="text-lg font-bold text-white">
        <span :class="{ 'hidden': isCollapsed }">MiEmpresa</span>
      </div>
      
      <div 
        class="text-xs text-[var(--muted)] hidden lg:inline"
        :class="{ 'lg:hidden': isCollapsed }"
      >
        {{ user?.email || 'Cuenta' }}
      </div>
    </div>
    
    <nav class="flex-1 overflow-auto">
      <template v-for="item in filteredItems" :key="item.key">
        <button
          @click="$router.push(item.route)"
          class="w-full text-left px-3 py-2 rounded mb-1 text-[var(--muted)] hover:bg-[var(--accent)] hover:text-black transition flex items-center gap-2"
          :class="{ 'lg:justify-center': isCollapsed }"
        >
          <span 
            class="hidden lg:inline-block"
            :class="{ 'lg:hidden': isCollapsed }"
          >
            {{ item.title }}
          </span>
        </button>
      </template>
    </nav>
    
    <div 
      class="mt-4 text-xs text-[var(--muted)] hidden lg:inline"
      :class="{ 'lg:hidden': isCollapsed }"
    >
      <div class="mb-2">Atajos</div>
      <div>• Ctrl+P: Imprimir</div>
    </div>
    
    <button
      @click="$emit('logout')"
      class="mt-6 text-sm text-red-400 hover:text-red-300 border-t border-gray-700 pt-3 text-left flex items-center gap-2"
      :class="{ 'lg:justify-center': isCollapsed }"
    >
      <span 
        class="hidden lg:inline-block" 
        :class="{ 'lg:hidden': isCollapsed }"
      >
        Cerrar sesión
      </span>
    </button>
 </aside>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  user: Object,
  isCollapsed: Boolean 
})

const items = [
  { key: 'dashboard', title: 'Dashboard', route: '/dashboard' },
  { key: 'ventas', title: 'Ventas', route: '/ventas' },
  { key: 'productos', title: 'Productos', route: '/productos', adminOnly: true },
  { key: 'estadisticas', title: 'Estadísticas', route: '/estadisticas', adminOnly: true },
  { key: 'config', title: 'Configuración', route: '/config', adminOnly: true },
  { key: 'usuarios', title: 'Usuarios', route: '/usuarios' },
  { key: 'importer', title: 'Importar BD', route: '/importer' },
]

const filteredItems = computed(() => {
  return props.user?.rol === 'admin'
    ? items
    : items.filter(i => !i.adminOnly)
})
</script>

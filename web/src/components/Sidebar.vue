<template>
  <aside 
    class="bg-[#0b1221] border-r border-gray-800 flex flex-col transition-all duration-300 z-50"
    :class="[
      // MÓVIL: Fixed y fuera de pantalla por defecto
      'fixed inset-y-0 left-0 lg:relative',
      isCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-20' : 'translate-x-0 w-64'
    ]"
  >
    <div class="p-4 border-b border-gray-800 flex items-center justify-between h-16">
      <div class="flex items-center gap-3 overflow-hidden">
        <img v-if="empresa?.logo_url" :src="empresa.logo_url" class="w-8 h-8 rounded object-contain bg-white" />
        <div v-else class="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-white shrink-0">
            {{ empresa?.nombre?.charAt(0) || 'P' }}
        </div>
        
        <div class="font-bold text-white whitespace-nowrap transition-opacity duration-200" 
             :class="{ 'lg:opacity-0 lg:w-0': isCollapsed }">
             {{ empresa?.nombre || 'Mi POS' }}
        </div>
      </div>

      <button @click="$emit('toggle')" class="text-gray-400 hover:text-white lg:block hidden">
         <svg v-if="!isCollapsed" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path></svg>
         <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
      </button>
      
      <button @click="$emit('toggle')" class="lg:hidden text-gray-400">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    </div>
    
    <nav class="flex-1 overflow-y-auto p-2 space-y-1">
      <template v-for="item in filteredItems" :key="item.key">
        <button
          @click="navigate(item.route)"
          class="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group"
          :class="[
             $route.path === item.route ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#1a2642] hover:text-white'
          ]"
          :title="isCollapsed ? item.title : ''"
        >
          <span class="shrink-0">
             <div class="w-5 h-5 bg-current opacity-50 rounded-sm"></div> 
          </span>
          
          <span class="whitespace-nowrap transition-opacity duration-200"
                :class="{ 'lg:opacity-0 lg:w-0 lg:hidden': isCollapsed }">
            {{ item.title }}
          </span>
        </button>
      </template>
    </nav>
    
    <div class="p-4 border-t border-gray-800">
        <div class="flex items-center gap-3 mb-4 overflow-hidden" :class="{ 'lg:justify-center': isCollapsed }">
            <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs shrink-0">
                {{ user?.nombre?.charAt(0) || 'U' }}
            </div>
            <div class="text-sm text-gray-300 whitespace-nowrap" :class="{ 'lg:hidden': isCollapsed }">
                <div class="font-medium truncate w-32">{{ user?.nombre || 'Usuario' }}</div>
                <div class="text-xs text-gray-500 capitalize">{{ user?.rol }}</div>
            </div>
        </div>

        <button @click="$emit('logout')" class="w-full flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors" :class="{ 'lg:justify-center': isCollapsed }">
             <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
             <span :class="{ 'lg:hidden': isCollapsed }">Salir</span>
        </button>
    </div>
 </aside>
 
 <div v-if="!isCollapsed" @click="$emit('toggle')" class="fixed inset-0 bg-black/50 z-40 lg:hidden"></div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth } from '../store/auth' // Usamos el store directo

const props = defineProps({
  isCollapsed: Boolean 
})

const emit = defineEmits(['toggle', 'logout'])
const router = useRouter()
const route = useRoute()

// Datos desde Store Global (Reactivos)
const user = computed(() => auth.state.user)
const empresa = computed(() => auth.state.empresa)

const items = [
  { key: 'dashboard', title: 'Dashboard', route: '/dashboard' },
  { key: 'ventas', title: 'Ventas (POS)', route: '/ventas' },
  { key: 'productos', title: 'Productos', route: '/productos', adminOnly: true },
  { key: 'estadisticas', title: 'Estadísticas', route: '/estadisticas', adminOnly: true },
  { key: 'config', title: 'Configuración', route: '/config', adminOnly: true },
  { key: 'usuarios', title: 'Usuarios', route: '/usuarios' },
]

const filteredItems = computed(() => {
  return user.value?.rol === 'admin'
    ? items
    : items.filter(i => !i.adminOnly)
})

function navigate(path) {
    router.push(path)
    // En móvil, cerrar sidebar al navegar
    if (window.innerWidth < 1024) emit('toggle') 
}
</script>
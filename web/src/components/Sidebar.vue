<template>
  <aside 
    class="flex flex-col transition-all duration-300 z-50 border-r border-[var(--border)] bg-[var(--sidebar-bg)]"
    :class="[
      // MÓVIL: Fixed y fuera de pantalla por defecto
      'fixed inset-y-0 left-0 lg:relative',
      isCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-20' : 'translate-x-0 w-64'
    ]"
  >
    <div class="p-4 border-b border-[var(--border)] flex items-center justify-between h-16">
      <div class="flex items-center gap-3 overflow-hidden">
        <img v-if="empresa?.logo_url" :src="empresa.logo_url" class="w-8 h-8 rounded object-contain bg-white border border-gray-200" />
        <div v-else class="w-8 h-8 rounded bg-[var(--accent)] flex items-center justify-center font-bold text-[var(--text-on-accent)] shrink-0">
            {{ empresa?.nombre?.charAt(0) || 'P' }}
        </div>
        
        <div class="font-bold text-[var(--text-primary)] whitespace-nowrap transition-opacity duration-200" 
             :class="{ 'lg:opacity-0 lg:w-0': isCollapsed }">
             {{ empresa?.nombre || 'Mi POS' }}
        </div>
      </div>

      <button @click="$emit('toggle')" class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] lg:block hidden">
         <svg v-if="!isCollapsed" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path></svg>
         <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
      </button>
      
      <button @click="$emit('toggle')" class="lg:hidden text-[var(--text-secondary)]">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    </div>
    
    <nav class="flex-1 overflow-y-auto p-2 space-y-1">
      <template v-for="item in filteredItems" :key="item.key">
        <button
          @click="navigate(item.route)"
          class="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group"
          :class="[
             $route.path === item.route 
                ? 'bg-[var(--accent)] text-[var(--text-on-accent)] shadow-sm' 
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-deep)] hover:text-[var(--text-primary)]'
          ]"
          :title="isCollapsed ? item.title : ''"
        >
          <span class="shrink-0">
             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </span>
          
          <span class="whitespace-nowrap transition-opacity duration-200 font-medium"
                :class="{ 'lg:opacity-0 lg:w-0 lg:hidden': isCollapsed }">
            {{ item.title }}
          </span>
        </button>
      </template>
    </nav>
    
    <div class="p-4 border-t border-[var(--border)]">
        <div class="flex items-center gap-3 mb-4 overflow-hidden" :class="{ 'lg:justify-center': isCollapsed }">
            <div class="w-8 h-8 rounded-full bg-[var(--input-bg)] border border-[var(--border)] flex items-center justify-center text-xs shrink-0 text-[var(--text-primary)]">
                {{ user?.nombre?.charAt(0) || 'U' }}
            </div>
            <div class="text-sm text-[var(--text-primary)] whitespace-nowrap" :class="{ 'lg:hidden': isCollapsed }">
                <div class="font-medium truncate w-32">{{ user?.nombre || 'Usuario' }}</div>
                <div class="text-xs text-[var(--text-secondary)] capitalize">{{ user?.rol }}</div>
            </div>
        </div>

        <button @click="$emit('logout')" class="w-full flex items-center gap-2 text-red-500 hover:text-red-600 text-sm transition-colors" :class="{ 'lg:justify-center': isCollapsed }">
             <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
             <span :class="{ 'lg:hidden': isCollapsed }">Salir</span>
        </button>
    </div>
 </aside>
 
 <div v-if="!isCollapsed" @click="$emit('toggle')" class="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"></div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../store/auth'

const props = defineProps({ isCollapsed: Boolean })
const emit = defineEmits(['toggle', 'logout'])
const router = useRouter()

const user = computed(() => auth.state.user)
const empresa = computed(() => auth.state.empresa)

const items = [
  { key: 'dashboard', title: 'Dashboard', route: '/dashboard' },
  { key: 'ventas', title: 'Ventas (POS)', route: '/ventas' },
  { key: 'productos', title: 'Productos', route: '/productos', adminOnly: true },
  { key: 'estadisticas', title: 'Estadísticas', route: '/estadisticas', adminOnly: true },
  { key: 'config', title: 'Configuración', route: '/config', adminOnly: true },
  { key: 'usuarios', title: 'Usuarios', route: '/usuarios' },
  { key: 'importer', title: 'Importar BD', route: '/importer' },
  { key: 'Ventas2', title: 'Ventas ', route: '/ventas2' }
]

const filteredItems = computed(() => {
  return user.value?.rol === 'admin' ? items : items.filter(i => !i.adminOnly)
})

function navigate(path) {
    router.push(path)
    if (window.innerWidth < 1024) emit('toggle') 
}
</script>
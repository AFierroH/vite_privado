<template>
  <div class="h-screen w-screen flex bg-[var(--bg-deep)] text-[var(--text-primary)] overflow-hidden">
    
    <Sidebar 
      :is-collapsed="isCollapsed"
      :user="user"
      @toggle="toggleSidebar"
      @logout="$emit('logout')"
    />

    <div class="flex-1 flex flex-col min-w-0 transition-all duration-300"
         :class="{ 'lg:ml-0': !isCollapsed }">
      
      <header class="bg-[var(--panel)] border-b border-[var(--border)] flex items-center justify-between px-6 py-3 h-16">
        <Topbar 
          @toggle-theme="toggleTheme"
          @toggle-sidebar="toggleSidebar"
        />
      </header>

      <main class="flex-1 p-4 lg:p-6 overflow-y-auto relative bg-[var(--bg-deep)]">
        <router-view />
      </main>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import Topbar from '../components/Topbar.vue'
import { auth } from '../store/auth' // Asegúrate de tener el store

const props = defineProps({
  user: Object
})

const emit = defineEmits(['logout'])

// Estado inicial: En móvil cerrado (true), en desktop abierto (false)
const isCollapsed = ref(window.innerWidth < 1024)

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

function toggleTheme() {
  const html = document.documentElement
  const current = html.classList.contains('dark') ? 'light' : 'dark'
  html.classList.toggle('dark', current === 'dark')
}

// Listener para ajustar sidebar si cambian el tamaño de la ventana
function handleResize() {
    if (window.innerWidth < 1024) isCollapsed.value = true
    else isCollapsed.value = false
}

// --- LÓGICA DE CACHÉ DE IMPRESORA Y EVENTOS ---
onMounted(async () => {
    window.addEventListener('resize', handleResize)

    // Intentar leer la sesión para obtener la URL del logo
    const sessionStr = localStorage.getItem('session');
    if (sessionStr) {
        try {
            const session = JSON.parse(sessionStr);
            // Si existe un logo configurado, mandarlo a Electron
            if (session?.empresa?.logo_url) {
                console.log('MainLayout: Iniciando carga de logo en memoria de impresora...');
                
                if (window.electronAPI?.cacheLogo) {
                    const ok = await window.electronAPI.cacheLogo(session.empresa.logo_url);
                    if (ok) console.log('Logo procesado y listo en RAM para impresión térmica');
                    else console.warn('No se pudo procesar el logo para impresión');
                }
            }
        } catch (e) {
            console.error('Error al iniciar caché de logo:', e);
        }
    }
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
})
</script>
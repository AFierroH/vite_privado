<template>
  <div class="h-screen w-screen grid grid-rows-[auto_1fr] grid-cols-[240px_1fr] bg-[var(--bg-deep)] text-[var(--text-primary)]">
    <aside
      class="row-span-2 bg-[var(--panel)] border-r border-[var(--border)] flex flex-col"
      :class="{ 'hidden': isSidebarCollapsed }"
    >
      <Sidebar 
        :is-collapsed="isSidebarCollapsed"
        :user="user"
        @logout="$emit('logout')"
      />
    </aside>

    <header class="col-span-2 md:col-span-1 bg-[var(--panel)] border-b border-[var(--border)] flex items-center justify-between px-6 py-3">
      <Topbar 
        @toggle-theme="toggleTheme"
        @toggle-sidebar="toggleSidebar"
      />
    </header>

    <main class="p-6 overflow-y-auto bg-[var(--bg-deep)]">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue' // <--- AGREGADO onMounted
import Sidebar from '../components/Sidebar.vue'
import Topbar from '../components/Topbar.vue'

const props = defineProps({
  user: Object
})

const emit = defineEmits(['logout'])

const isSidebarCollapsed = ref(false)

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

function toggleTheme() {
  const html = document.documentElement
  const current = html.classList.contains('dark') ? 'light' : 'dark'
  html.classList.toggle('dark', current === 'dark')
}

// --- LÓGICA DE CACHÉ DE IMPRESORA ---
onMounted(async () => {
    // Intentar leer la sesión para obtener la URL del logo
    const sessionStr = localStorage.getItem('session');
    if (sessionStr) {
        try {
            const session = JSON.parse(sessionStr);
            // Si existe un logo configurado, mandarlo a Electron
            if (session?.empresa?.logo_url) {
                console.log('MainLayout: Iniciando carga de logo en memoria de impresora...');
                
                // Llamada segura a Electron (si existe el handler)
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
</script>
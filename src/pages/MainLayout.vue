<template>
  <div class="h-screen w-screen grid grid-rows-[auto_1fr] grid-cols-[240px_1fr] bg-[var(--bg-deep)] text-[var(--text-primary)]">
    <!-- Sidebar -->
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

    <!-- Topbar -->
    <header class="col-span-2 md:col-span-1 bg-[var(--panel)] border-b border-[var(--border)] flex items-center justify-between px-6 py-3">
      <Topbar 
        @toggle-theme="toggleTheme"
        @toggle-sidebar="toggleSidebar"
      />
    </header>

    <!-- Contenido principal -->
    <main class="p-6 overflow-y-auto bg-[var(--bg-deep)]">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
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
</script>

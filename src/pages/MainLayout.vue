<template>
  <div class="flex h-screen bg-[var(--bg)] overflow-hidden">
    
    <Sidebar 
      :is-collapsed="isSidebarCollapsed" 
      :user="user" 
      @logout="$emit('logout')" 
    />

    <div class="flex-1 flex flex-col overflow-hidden">
      
      <Topbar 
        @toggle-theme="toggleTheme" 
        @toggle-sidebar="toggleSidebar" 
      />
      
      <div class="flex-1 p-6 overflow-y-auto">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue' 
import Sidebar from '../components/Sidebar.vue'
import Topbar from '../components/Topbar.vue'

defineProps({
  user: { type: Object, required: true }
})
defineEmits(['logout'])

const isSidebarCollapsed = ref(false) 

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark')
  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  localStorage.setItem('theme', theme)
}
</script>
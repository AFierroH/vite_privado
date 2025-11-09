<template>
  <div class="flex h-screen">
    <Sidebar :user="user" @logout="$emit('logout')" />
    <div class="flex-1 flex flex-col">
      <Topbar @toggle-theme="toggleTheme" />
      <div class="flex-1 p-6 overflow-auto bg-[var(--bg)]">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup>
import Sidebar from '../components/Sidebar.vue'
import Topbar from '../components/Topbar.vue'

defineProps({
  user: { type: Object, required: true } // asegura que 'user' exista
})
defineEmits(['logout'])

function toggleTheme() {
  document.documentElement.classList.toggle('dark')
  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  localStorage.setItem('theme', theme)
}
</script>

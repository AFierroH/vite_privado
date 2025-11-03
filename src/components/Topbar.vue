<!-- Barra superior con buscador y user menu -->
<template>
  <div class="flex items-center justify-between p-3 bg-transparent border-b border-gray-800">
    <div class="flex items-center gap-3">
      <input v-model="q" @keyup.enter="search" placeholder="Buscar producto..." class="px-3 py-2 bg-[#081026] rounded border border-gray-800 text-white"/>
      <button @click="search" class="px-3 py-2 rounded bg-[var(--accent)] text-black font-medium">Buscar</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const q = ref('')
function search(){ window.dispatchEvent(new CustomEvent('search', { detail: q.value })) }
</script>

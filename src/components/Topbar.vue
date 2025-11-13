<template>
  <div class="flex items-center justify-between p-3 bg-transparent border-b border-gray-800">
    
    <div class="flex items-center gap-3">
      
      <button 
        @click="$emit('toggle-sidebar')" 
        class="p-2 rounded text-white hover:bg-[var(--accent)] hover:text-black transition-colors"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path>
        </svg>
      </button>

      <input v-model="q" @keyup.enter="search" placeholder="Buscar producto..." class="px-3 py-2 bg-[#081026] rounded border border-gray-800 text-white"/>
      <button @click="search" class="px-3 py-2 rounded bg-[var(--accent)] text-black font-medium">Buscar</button>
    </div>

    <div>
      <button 
        @click="$emit('toggle-theme')"
        class="p-2 rounded text-white hover:bg-[var(--accent)] hover:text-black transition-colors"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
        </svg>
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'

defineEmits(['toggle-sidebar', 'toggle-theme'])

const q = ref('')
function search(){ window.dispatchEvent(new CustomEvent('search', { detail: q.value })) }
</script>
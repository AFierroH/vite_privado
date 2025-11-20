<template>
  <div class="flex items-center justify-between p-3 w-full h-16 bg-[var(--panel)] border-b border-gray-800">
    
    <div class="flex items-center gap-4 flex-1">
      
      <button 
        @click="$emit('toggle-sidebar')" 
        class="p-2 rounded text-white hover:bg-[var(--accent)] hover:text-black lg:hidden"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>

      <div class="relative w-full max-w-md hidden md:block">
          <input 
            v-model="q" 
            @keyup.enter="search" 
            placeholder="Buscar producto global..." 
            class="w-full pl-10 pr-4 py-2 bg-[#081026] rounded-lg border border-gray-700 text-white focus:border-blue-500 focus:outline-none"
          />
          <svg class="w-5 h-5 text-gray-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      </div>
    </div>

    <div>
      <button 
        @click="$emit('toggle-theme')"
        class="p-2 rounded text-gray-400 hover:text-white transition-colors"
        title="Cambiar Tema"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
        </svg>
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
defineEmits(['toggle-sidebar', 'toggle-theme'])

const q = ref('')
function search(){ 
    // Dispara evento global para que Ventas o Productos lo escuchen
    window.dispatchEvent(new CustomEvent('search-global', { detail: q.value })) 
}
</script>
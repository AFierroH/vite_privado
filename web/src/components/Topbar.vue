<template>
  <div class="flex items-center justify-between p-3 w-full h-16 bg-[var(--panel)] border-b border-[var(--border)] transition-colors">
    
    <div class="flex items-center gap-4 flex-1">
      <button 
        @click="$emit('toggle-sidebar')" 
        class="p-2 rounded text-[var(--text-primary)] hover:bg-[var(--border)] lg:hidden"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
      </button>

      <div class="relative w-full max-w-md hidden md:block">
          <input 
            v-model="q" 
            @keyup.enter="search" 
            placeholder="Buscar producto global..." 
            class="w-full pl-10 pr-4 py-2 bg-[var(--input-bg)] rounded-lg border border-[var(--input-border)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
          <svg class="w-5 h-5 text-[var(--text-secondary)] absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      </div>
    </div>

    <div>
      <button 
        @click="$emit('toggle-theme')"
        class="p-2 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
        title="Cambiar Tema"
      >
        <svg class="w-6 h-6 dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
        <svg class="w-6 h-6 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
defineEmits(['toggle-sidebar', 'toggle-theme'])
const q = ref('')
function search(){ window.dispatchEvent(new CustomEvent('search-global', { detail: q.value })) }
</script>
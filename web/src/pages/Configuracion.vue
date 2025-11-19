<template>
  <div class="h-full w-full flex flex-col p-6 bg-[var(--bg-deep)] text-[var(--text-primary)]">
    <h2 class="text-2xl font-semibold mb-6">Configuración</h2>
    <div class="flex flex-wrap gap-4 items-center">
      <label class="text-[var(--muted)]">Tema:</label>
      <button @click="set('dark')" class="px-4 py-2 rounded bg-[#0b1220]">Oscuro</button>
      <button @click="set('light')" class="px-4 py-2 rounded bg-[#f5f5f5] text-black">Claro</button>
    </div>
  </div>
</template>

<script setup>
function set(mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark')
}
</script>

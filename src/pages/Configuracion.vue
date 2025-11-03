<!-- Configuración: modo claro/oscuro y opciones básicas -->
<template>
  <div class="p-4 bg-[var(--panel)] rounded">
    <h2 class="text-xl font-semibold mb-4">Configuración</h2>
    <div class="flex items-center gap-4">
      <label class="mr-2 text-[var(--muted)]">Tema</label>
      <button @click="set('dark')" class="px-3 py-2 rounded bg-[#0b1220]">Oscuro</button>
      <button @click="set('light')" class="px-3 py-2 rounded bg-[#0b1220]">Claro</button>
    </div>
  </div>
</template>

<script setup>
function set(t){ if(t==='dark') document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); localStorage.setItem('theme', t) }
</script>

<template>
  <div class="h-full w-full flex flex-col p-6 bg-[var(--bg-deep)] text-[var(--text-primary)] transition-colors">
    <h2 class="text-2xl font-semibold mb-6">Configuración</h2>
    
    <div class="mb-8 p-4 bg-[var(--panel)] rounded border border-[var(--border)] shadow-sm">
      <h3 class="text-lg font-medium mb-4 text-[var(--text-primary)]">Logo de la Empresa</h3>
      <div class="flex flex-col sm:flex-row items-start gap-6">
        
        <div class="w-32 h-32 bg-[var(--input-bg)] rounded flex items-center justify-center overflow-hidden border border-[var(--border)]">
          <img v-if="previewUrl" :src="previewUrl" class="object-contain w-full h-full" />
          <span v-else class="text-[var(--muted)] text-xs text-center px-2">Sin logo</span>
        </div>

        <div class="flex flex-col gap-3">
          <p class="text-sm text-[var(--muted)]">
            Este logo se usará en la barra superior y se convertirá automáticamente <br>
            a blanco y negro (150px) para los tickets.
          </p>
          
          <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/png, image/jpeg" class="hidden" />
          
          <div class="flex gap-2">
            <button @click="$refs.fileInput.click()" class="px-4 py-2 bg-[var(--input-bg)] border border-[var(--border)] rounded text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors">
              Seleccionar Imagen
            </button>
            <button v-if="selectedFile" @click="upload" class="px-4 py-2 bg-[var(--accent)] text-[var(--text-on-accent)] rounded font-bold shadow hover:opacity-90">
              Subir y Guardar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap gap-4 items-center p-4 bg-[var(--panel)] rounded border border-[var(--border)]">
      <label class="text-[var(--text-primary)] font-medium">Tema de la aplicación:</label>
      
      <button @click="set('dark')" 
        class="px-4 py-2 rounded border transition-colors flex items-center gap-2"
        :class="isDark ? 'bg-[var(--accent)] text-white border-transparent' : 'bg-[var(--input-bg)] text-[var(--text-primary)] border-[var(--border)]'">
        <span>🌙 Oscuro</span>
      </button>
      
      <button @click="set('light')" 
        class="px-4 py-2 rounded border transition-colors flex items-center gap-2"
        :class="!isDark ? 'bg-[var(--accent)] text-white border-transparent' : 'bg-[var(--input-bg)] text-[var(--text-primary)] border-[var(--border)]'">
        <span>☀️ Claro</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { uploadEmpresaLogo } from '../api'

const fileInput = ref(null)
const selectedFile = ref(null)
const previewUrl = ref(null)

// Detectar tema actual para los botones
const isDark = ref(document.documentElement.classList.contains('dark'))

function set(mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark')
  isDark.value = mode === 'dark'
  // Opcional: Guardar preferencia
  localStorage.setItem('theme', mode)
}

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

async function upload() {
  if (!selectedFile.value) return
  const session = JSON.parse(localStorage.getItem('session') || '{}')
  const empresaId = session.user?.id_empresa || session.empresa?.id_empresa || 1
  
  try {
    const updated = await uploadEmpresaLogo(empresaId, selectedFile.value)
    alert('Logo subido correctamente.')
    if (session.empresa) {
        session.empresa.logo_url = updated.logo_url
        localStorage.setItem('session', JSON.stringify(session))
    }
    if (window.electronAPI?.cacheLogo) {
       window.electronAPI.cacheLogo(updated.logo_url)
    }
  } catch (e) {
    alert('Error al subir imagen')
  }
}

onMounted(() => {
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    if (session.empresa?.logo_url) previewUrl.value = session.empresa.logo_url
    
    // Recuperar tema
    const savedTheme = localStorage.getItem('theme')
    if(savedTheme) set(savedTheme)
})
</script>
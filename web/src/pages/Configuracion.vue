<template>
  <div class="h-full w-full flex flex-col p-6 bg-[var(--bg-deep)] text-[var(--text-primary)]">
    <h2 class="text-2xl font-semibold mb-6">Configuración</h2>
    
    <div class="mb-8 p-4 bg-[var(--panel)] rounded border border-gray-800">
      <h3 class="text-lg font-medium mb-4 text-white">Logo de la Empresa</h3>
      <div class="flex items-start gap-6">
        <div class="w-32 h-32 bg-gray-700 rounded flex items-center justify-center overflow-hidden border border-gray-600">
          <img v-if="previewUrl" :src="previewUrl" class="object-contain w-full h-full" />
          <span v-else class="text-gray-400 text-xs text-center px-2">Sin logo</span>
        </div>

        <div class="flex flex-col gap-3">
          <p class="text-sm text-gray-400">
            Este logo se usará en la barra superior y se convertirá automáticamente <br>
            a blanco y negro para los tickets de la impresora térmica.
          </p>
          
          <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/png, image/jpeg" class="hidden" />
          
          <div class="flex gap-2">
            <button @click="$refs.fileInput.click()" class="px-4 py-2 bg-gray-700 rounded text-white hover:bg-gray-600">
              Seleccionar Imagen
            </button>
            <button v-if="selectedFile" @click="upload" class="px-4 py-2 bg-[var(--accent)] text-black rounded font-bold">
              Subir y Guardar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap gap-4 items-center">
      <label class="text-[var(--muted)]">Tema:</label>
      <button @click="set('dark')" class="px-4 py-2 rounded bg-[#0b1220] border border-gray-700 text-white">Oscuro</button>
      <button @click="set('light')" class="px-4 py-2 rounded bg-[#f5f5f5] text-black">Claro</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { uploadEmpresaLogo, fetchEmpresa } from '../api' 

const fileInput = ref(null)
const selectedFile = ref(null)
const previewUrl = ref(null)
const currentUser = ref(null) 

function set(mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark')
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
    const updatedEmpresa = await uploadEmpresaLogo(empresaId, selectedFile.value)
    alert('Logo subido correctamente. Se actualizará en la próxima sesión.')
    
    // Actualizar sesión local con el nuevo logo
    if (session.empresa) {
        session.empresa.logo_url = updatedEmpresa.logo_url
        localStorage.setItem('session', JSON.stringify(session))
    }
    
    // Opcional: Pre-cargar en impresora (Electron)
    if (window.electronAPI?.cacheLogo) {
       alert('Procesando imagen para impresora...')
       const ok = await window.electronAPI.cacheLogo(updatedEmpresa.logo_url)
       if(ok) alert('Imagen procesada y lista en memoria de impresión')
       else alert('Imagen subida pero error al procesar para impresión')
    }

  } catch (e) {
    console.error(e)
    alert('Error al subir imagen')
  }
}

onMounted(() => {
    // Cargar logo actual al entrar
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    if (session.empresa?.logo_url) {
        previewUrl.value = session.empresa.logo_url
    }
})
</script>
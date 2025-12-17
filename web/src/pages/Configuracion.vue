<template>
  <div class="h-full w-full flex flex-col p-6 bg-[var(--bg-deep)] text-[var(--text-primary)] transition-colors overflow-y-auto">
    <h2 class="text-2xl font-semibold mb-6">Configuración</h2>

    <!-- LOGO EMPRESA -->
    <div class="mb-8 p-4 bg-[var(--panel)] rounded border border-[var(--border)] shadow-sm">
      <h3 class="text-lg font-medium mb-4">Logo de la Empresa</h3>

      <div class="flex flex-col sm:flex-row gap-6">
        <div class="w-32 h-32 bg-[var(--input-bg)] rounded flex items-center justify-center overflow-hidden border">
          <img v-if="previewUrl" :src="previewUrl" class="object-contain w-full h-full" />
          <span v-else class="text-xs text-[var(--muted)]">Sin logo</span>
        </div>

        <div class="flex flex-col gap-3">
          <input type="file" ref="fileInput" @change="handleLogoSelect" accept="image/png, image/jpeg" class="hidden" />

          <div class="flex gap-2">
            <button @click="$refs.fileInput.click()" class="px-4 py-2 border rounded hover:bg-[var(--bg-deep)]">
              Seleccionar Imagen
            </button>

            <button v-if="logoFile" @click="uploadLogo" :disabled="isUploading" class="px-4 py-2 bg-[var(--accent)] text-white rounded font-bold hover:opacity-90 disabled:opacity-50">
              {{ isUploading ? 'Subiendo...' : 'Subir Logo' }}
            </button>
          </div>
          
          <p v-if="uploadMessage" :class="uploadSuccess ? 'text-green-500' : 'text-red-500'" class="text-sm">
            {{ uploadMessage }}
          </p>
        </div>
      </div>
    </div>

    <!-- CAF / FOLIOS -->
    <div class="mb-8 p-4 bg-[var(--panel)] rounded border border-[var(--border)] shadow-sm">
      <h3 class="text-lg font-medium mb-4">Folios SII (CAF)</h3>

      <div class="max-w-lg flex flex-col gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">Empresa</label>
          <select v-model="empresaId" class="w-full px-3 py-2 border rounded bg-[var(--input-bg)] outline-none focus:border-[var(--accent)]">
            <option v-for="e in empresas" :key="e.id_empresa" :value="e.id_empresa">
              {{ e.nombre }} ({{ e.rut }})
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Archivo CAF (XML)</label>
          <input 
            type="file" 
            accept=".xml" 
            @change="handleCafSelect"
            class="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:font-semibold file:bg-[var(--accent)] file:text-white hover:file:opacity-90"
          />
        </div>

        <button
          v-if="cafFile"
          @click="uploadCaf"
          :disabled="isCafUploading || !empresaId"
          class="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-500 disabled:opacity-50">
          {{ isCafUploading ? 'Procesando...' : 'Subir CAF XML' }}
        </button>

        <p v-if="cafMessage" :class="cafSuccess ? 'text-green-500' : 'text-red-500'" class="text-sm">
          {{ cafMessage }}
        </p>

        <!-- Mostrar info del CAF cargado -->
        <div v-if="cafInfo" class="text-sm border-t pt-3 bg-[var(--bg-deep)] p-3 rounded">
          <p class="font-bold mb-2">✅ CAF Cargado Exitosamente:</p>
          <p><b>Tipo DTE:</b> {{ cafInfo.tipo_dte }} {{ getNombreTipoDte(cafInfo.tipo_dte) }}</p>
          <p><b>Rango:</b> {{ cafInfo.folio_desde }} - {{ cafInfo.folio_hasta }}</p>
          <p><b>Folios Disponibles:</b> {{ cafInfo.folio_hasta - cafInfo.folio_actual }}</p>
          <p><b>Próximo Folio:</b> {{ cafInfo.folio_actual + 1 }}</p>
          <p><b>RUT Emisor:</b> {{ cafInfo.rut_emisor || 'N/A' }}</p>
        </div>

        <!-- Listar CAFs existentes -->
        <div v-if="cafsLista.length > 0" class="border-t pt-4">
          <h4 class="font-medium mb-3">CAFs Registrados</h4>
          <div class="space-y-2">
            <div 
              v-for="c in cafsLista" 
              :key="c.id"
              class="p-3 bg-[var(--bg-deep)] rounded border text-xs"
              :class="c.activo ? 'border-green-500' : 'border-gray-600'">
              <div class="flex justify-between items-start">
                <div>
                  <p><b>Tipo:</b> {{ c.tipo_dte }} {{ getNombreTipoDte(c.tipo_dte) }}</p>
                  <p><b>Rango:</b> {{ c.folio_desde }} - {{ c.folio_hasta }}</p>
                  <p><b>Usado hasta:</b> {{ c.folio_actual }}</p>
                  <p v-if="c.empresa"><b>Empresa:</b> {{ c.empresa.nombre }}</p>
                </div>
                <span 
                  :class="c.activo ? 'bg-green-500' : 'bg-gray-500'"
                  class="px-2 py-1 rounded text-white text-[10px] font-bold">
                  {{ c.activo ? 'ACTIVO' : 'INACTIVO' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TEMA -->
    <div class="p-4 bg-[var(--panel)] rounded border border-[var(--border)] shadow-sm">
      <h3 class="text-lg font-medium mb-4">Tema</h3>

      <div class="flex gap-4">
        <button 
          @click="setTheme('dark')" 
          :class="currentTheme === 'dark' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-deep)]'"
          class="px-4 py-2 border rounded hover:opacity-90">
          🌙 Oscuro
        </button>
        <button 
          @click="setTheme('light')" 
          :class="currentTheme === 'light' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-deep)]'"
          class="px-4 py-2 border rounded hover:opacity-90">
          ☀️ Claro
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { uploadEmpresaLogo, uploadCafXml, getEmpresas, getCafs } from '../api'

/* ---------- LOGO ---------- */
const fileInput = ref(null)
const logoFile = ref(null)
const previewUrl = ref(null)
const isUploading = ref(false)
const uploadMessage = ref('')
const uploadSuccess = ref(false)

function handleLogoSelect(e) {
  logoFile.value = e.target.files[0]
  if (logoFile.value) {
    previewUrl.value = URL.createObjectURL(logoFile.value)
    uploadMessage.value = ''
  }
}

async function uploadLogo() {
  if (!logoFile.value) return
  
  isUploading.value = true
  uploadMessage.value = ''
  
  try {
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    const empresaId = session.user?.id_empresa || 1

    const r = await uploadEmpresaLogo(empresaId, logoFile.value)
    
    let cleanUrl = r.logo_url
    if (cleanUrl.includes('http://')) {
      const parts = cleanUrl.split('/uploads/')
      if (parts.length > 1) {
        cleanUrl = '/uploads/' + parts[1]
      }
    }
    
    previewUrl.value = cleanUrl

    if (session.empresa) {
      session.empresa.logo_url = cleanUrl
      localStorage.setItem('session', JSON.stringify(session))
    }

    if (window.electronAPI) {
      await window.electronAPI.cacheLogo(empresaId, cleanUrl)
    }

    uploadSuccess.value = true
    uploadMessage.value = '✅ Logo actualizado correctamente'
    logoFile.value = null
    
  } catch (error) {
    uploadSuccess.value = false
    uploadMessage.value = `❌ Error: ${error.message || 'No se pudo subir el logo'}`
  } finally {
    isUploading.value = false
  }
}

/* ---------- CAF ---------- */
const empresas = ref([])
const empresaId = ref(null)
const cafFile = ref(null)
const cafInfo = ref(null)
const cafsLista = ref([])
const isCafUploading = ref(false)
const cafMessage = ref('')
const cafSuccess = ref(false)

function handleCafSelect(e) {
  cafFile.value = e.target.files[0]
  cafMessage.value = ''
  cafInfo.value = null
}

async function uploadCaf() {
  if (!cafFile.value || !empresaId.value) {
    cafMessage.value = '⚠️ Selecciona una empresa y un archivo CAF'
    return
  }
  
  isCafUploading.value = true
  cafMessage.value = ''
  
  try {
    console.log(`📤 Subiendo CAF para empresa ${empresaId.value}...`)
    const r = await uploadCafXml(empresaId.value, cafFile.value)
    
    cafInfo.value = r
    cafSuccess.value = true
    cafMessage.value = '✅ CAF cargado correctamente'
    cafFile.value = null
    
    // Recargar lista de CAFs
    await loadCafs()
    
  } catch (error) {
    cafSuccess.value = false
    cafMessage.value = `❌ Error: ${error.response?.data?.message || error.message || 'No se pudo procesar el CAF'}`
    console.error('Error subiendo CAF:', error)
  } finally {
    isCafUploading.value = false
  }
}

async function loadCafs() {
  try {
    cafsLista.value = await getCafs()
  } catch (error) {
    console.error('Error cargando CAFs:', error)
  }
}

function getNombreTipoDte(tipo) {
  const tipos = {
    33: '(Factura Electrónica)',
    34: '(Factura Exenta)',
    39: '(Boleta Electrónica)',
    41: '(Boleta Exenta)',
    52: '(Guía de Despacho)',
    56: '(Nota de Débito)',
    61: '(Nota de Crédito)'
  }
  return tipos[tipo] || ''
}

/* ---------- TEMA ---------- */
const currentTheme = ref('dark')

function setTheme(mode) {
  currentTheme.value = mode
  document.documentElement.classList.toggle('dark', mode === 'dark')
  localStorage.setItem('theme', mode)
}

/* ---------- INIT ---------- */
onMounted(async () => {
  try {
    empresas.value = await getEmpresas()
    
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    empresaId.value = session.user?.id_empresa || empresas.value[0]?.id_empresa

    if (session.empresa?.logo_url) {
      previewUrl.value = session.empresa.logo_url
    }

    // Cargar CAFs existentes
    await loadCafs()

    const savedTheme = localStorage.getItem('theme') || 'dark'
    setTheme(savedTheme)
    
  } catch (error) {
    console.error('Error al cargar configuración:', error)
  }
})
</script>
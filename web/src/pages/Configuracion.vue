<template>
  <div class="h-full w-full flex flex-col p-6 bg-[var(--bg-deep)] text-[var(--text-primary)] transition-colors">
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
            <button @click="$refs.fileInput.click()" class="px-4 py-2 border rounded">
              Seleccionar Imagen
            </button>

            <button v-if="logoFile" @click="uploadLogo" class="px-4 py-2 bg-[var(--accent)] text-white rounded font-bold">
              Subir Logo
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CAF / FOLIOS -->
    <div class="mb-8 p-4 bg-[var(--panel)] rounded border border-[var(--border)] shadow-sm">
      <h3 class="text-lg font-medium mb-4">Folios SII (CAF)</h3>

      <div class="max-w-lg flex flex-col gap-4">
        <select v-model="empresaId" class="px-3 py-2 border rounded bg-[var(--input-bg)]">
          <option v-for="e in empresas" :key="e.id_empresa" :value="e.id_empresa">
            {{ e.nombre }} ({{ e.rut }})
          </option>
        </select>

        <input type="file" accept=".xml" @change="handleCafSelect" />

        <button
          v-if="cafFile"
          @click="uploadCaf"
          class="px-4 py-2 bg-green-600 text-white rounded font-bold">
          Subir CAF XML
        </button>

        <div v-if="cafInfo" class="text-sm text-[var(--muted)] border-t pt-3">
          <p><b>Tipo DTE:</b> {{ cafInfo.tipo_dte }}</p>
          <p><b>Desde:</b> {{ cafInfo.folio_desde }}</p>
          <p><b>Hasta:</b> {{ cafInfo.folio_hasta }}</p>
          <p><b>Actual:</b> {{ cafInfo.folio_actual }}</p>
          <p><b>Activo:</b> {{ cafInfo.activo ? 'Sí' : 'No' }}</p>
        </div>
      </div>
    </div>

    <!-- TEMA -->
    <div class="p-4 bg-[var(--panel)] rounded border">
      <h3 class="text-lg font-medium mb-4">Tema</h3>

      <div class="flex gap-4">
        <button @click="setTheme('dark')" class="px-4 py-2 border rounded">
          Oscuro
        </button>
        <button @click="setTheme('light')" class="px-4 py-2 border rounded">
          Claro
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  uploadEmpresaLogo,
  uploadCafXml,
  getEmpresas
} from '../api'

/* ---------- LOGO ---------- */
const fileInput = ref(null)
const logoFile = ref(null)
const previewUrl = ref(null)

function handleLogoSelect(e) {
  logoFile.value = e.target.files[0]
  previewUrl.value = URL.createObjectURL(logoFile.value)
}

async function uploadLogo() {
  const session = JSON.parse(localStorage.getItem('session') || '{}')
  const empresaId = session.user?.id_empresa || 1

  const r = await uploadEmpresaLogo(empresaId, logoFile.value)
  
  // PARCHE PARA ASEGURAR HTTPS:
  // Si la respuesta es solo "/uploads/foto.png", está bien.
  // Si la respuesta trae "http://147...", lo forzamos a relativo.
  let cleanUrl = r.logo_url;
  if (cleanUrl.includes('http://')) {
      // Tomamos solo la parte desde /uploads
      const parts = cleanUrl.split('/uploads/');
      if (parts.length > 1) {
          cleanUrl = '/uploads/' + parts[1];
      }
  }
  
  previewUrl.value = cleanUrl; // Ahora será "/uploads/foto.png" y el navegador usará HTTPS automáticamente

  // Actualizar sesión local para que no desaparezca al recargar
  if(session.empresa) {
      session.empresa.logo_url = cleanUrl;
      localStorage.setItem('session', JSON.stringify(session));
  }

  // 2️⃣ Si es Electron...
  if (window.electronAPI) {
    await window.electronAPI.cacheLogo(empresaId, cleanUrl)
  }

  alert('Logo actualizado correctamente')
}

/* ---------- CAF ---------- */
const empresas = ref([])
const empresaId = ref(null)
const cafFile = ref(null)
const cafInfo = ref(null)

function handleCafSelect(e) {
  cafFile.value = e.target.files[0]
}

async function uploadCaf() {
  const r = await uploadCafXml(empresaId.value, cafFile.value)
  cafInfo.value = r
  cafFile.value = null
  alert('CAF cargado correctamente')
}

/* ---------- TEMA ---------- */
function setTheme(mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark')
  localStorage.setItem('theme', mode)
}

/* ---------- INIT ---------- */
onMounted(async () => {
  empresas.value = await getEmpresas()
  empresaId.value = empresas.value[0]?.id_empresa

  const session = JSON.parse(localStorage.getItem('session') || '{}')
  if (session.empresa?.logo_url) previewUrl.value = session.empresa.logo_url

  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) setTheme(savedTheme)
})
</script>

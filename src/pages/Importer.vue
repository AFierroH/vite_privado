<template>
  <div class="min-h-screen w-full grid grid-rows-[auto_1fr_auto] gap-4 p-6 text-[var(--text-primary)] bg-[var(--bg-deep)]">
    <h1 class="text-2xl font-bold">Importador - Mapear tablas</h1>

    <!-- CONTENIDO PRINCIPAL CON SCROLL -->
    <div class="overflow-y-auto flex flex-col gap-6">
      <!-- Sección 1: Subir archivo -->
      <section class="p-4 bg-[var(--panel)] border border-[var(--border)] rounded-lg">
        <label class="block mb-2 font-medium">1) Subir archivo .sql</label>
        <input type="file" accept=".sql" @change="onFileChange" class="text-sm" />
        <button
          class="ml-2 px-3 py-1 bg-[var(--accent)] text-[var(--text-on-accent)] rounded-lg text-sm"
          @click="upload"
          :disabled="!file"
        >
          Subir
        </button>
        <div v-if="uploadId" class="mt-2 text-sm text-green-400">
          Upload ID: {{ uploadId }}
        </div>
      </section>

      <!-- Sección 2: Mapeo -->
      <section
        v-if="parsedTables.length"
        class="p-4 bg-[var(--panel)] border border-[var(--border)] rounded-lg flex flex-col gap-4"
      >
        <label class="block font-medium">2) Elegir tablas</label>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Tabla destino (mi BD)</label>
            <select
              v-model="selectedDestTable"
              class="w-full p-2 border border-[var(--border)] rounded-lg bg-[var(--bg-deep)] text-[var(--text-primary)]"
              @change="onDestChange"
            >
              <option value="">-- elegir tabla destino --</option>
              <option v-for="(cols, tbl) in destSchema" :key="tbl" :value="tbl">{{ tbl }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Tabla origen (archivo importado)</label>
            <select
              v-model="selectedSourceTable"
              class="w-full p-2 border border-[var(--border)] rounded-lg bg-[var(--bg-deep)] text-[var(--text-primary)]"
              @change="onSourceChange"
            >
              <option value="">-- elegir tabla origen --</option>
              <option v-for="t in parsedTables" :key="t.name" :value="t.name">
                {{ t.name }} ({{ t.columns.length }} columnas)
              </option>
            </select>
          </div>
        </div>

        <!-- Mapeo -->
        <div
          v-if="selectedDestTable && selectedSourceTable"
          class="border-t border-[var(--border)] pt-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto"
        >
          <h3 class="font-semibold text-lg">3) Mapear columnas</h3>

          <div
            v-for="destField in destSchema[selectedDestTable]"
            :key="destField"
            class="flex flex-col sm:flex-row gap-2 items-center"
          >
            <div class="w-full sm:w-48 font-medium text-sm text-[var(--muted)]">{{ destField }}</div>
            <select
              v-model="mapping[destField]"
              class="flex-1 p-2 border border-[var(--border)] rounded-lg bg-[var(--bg-deep)] text-[var(--text-primary)]"
            >
              <option value="">-- no asignado --</option>
              <option value="__skip">-- SKIP --</option>
              <option v-for="col in sourceColumns" :key="col" :value="col">{{ col }}</option>
              <option value="__static">-- valor estático --</option>
            </select>

            <input
              v-if="mapping[destField] === '__static'"
              v-model="staticValues[destField]"
              placeholder="valor estático"
              class="p-2 w-32 border border-[var(--border)] rounded-lg bg-[var(--bg-deep)] text-[var(--text-primary)]"
            />
          </div>

          <div class="flex flex-wrap gap-2 mt-4">
            <button class="px-4 py-2 bg-green-600 text-white rounded-lg" @click="preview">
              Previsualizar
            </button>
            <button class="px-4 py-2 bg-blue-600 text-white rounded-lg" @click="finalizeImport">
              Importar (simulado)
            </button>
          </div>

          <!-- Preview -->
          <div
            v-if="previewResult"
            class="mt-4 p-3 border border-[var(--border)] rounded-lg bg-[var(--bg-deep)] overflow-auto"
          >
            <h4 class="font-semibold mb-2">Previsualización</h4>
            <table class="w-full table-auto text-sm">
              <thead>
                <tr class="bg-[var(--panel)]">
                  <th v-for="h in previewHeader" :key="h" class="border border-[var(--border)] px-2 py-1">
                    {{ h }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, idx) in previewResult.preview" :key="idx">
                  <td v-for="h in previewHeader" :key="h" class="border border-[var(--border)] px-2 py-1">
                    {{ r[h] ?? '' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Tablas detectadas -->
      <section
        v-if="parsedTables.length"
        class="p-4 bg-[var(--panel)] border border-[var(--border)] rounded-lg"
      >
        <h2 class="font-semibold mb-2">Tablas detectadas</h2>
        <ul class="text-sm space-y-1">
          <li v-for="t in parsedTables" :key="t.name">
            <strong>{{ t.name }}</strong> — <span class="text-[var(--muted)]">{{ t.columns.join(', ') }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import {
  uploadSql,
  getParsed,
  getDestSchema,
  previewMapping,
  processImport
} from '../api/'

const file = ref<File | null>(null)
const uploadId = ref<string | null>(null)
const parsedTables = ref<any[]>([])
const destSchema = ref<Record<string, string[]>>({})
const selectedDestTable = ref<string>('')
const selectedSourceTable = ref<string>('')
const sourceColumns = ref<string[]>([])
const mapping = reactive<Record<string, any>>({})
const staticValues = reactive<Record<string, any>>({})
const previewResult = ref<any>(null)
const previewHeader = ref<string[]>([])

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length) file.value = input.files[0]
}

async function upload() {
  if (!file.value) return alert('Selecciona un archivo .sql')

  try {
    const { data } = await uploadSql(file.value)
    if (!data.uploadId) throw new Error('No se recibió uploadId')

    uploadId.value = data.uploadId
    const parsedResp = await getParsed(data.uploadId)
    parsedTables.value = parsedResp.data

    const schemaResp = await getDestSchema()
    destSchema.value = schemaResp.data

    alert('Archivo subido y parseado correctamente')
  } catch (err: any) {
    console.error('Error en upload:', err)
    alert(`Error al subir archivo: ${err.response?.data?.message || err.message}`)
  }
}

function onSourceChange() {
  const t = parsedTables.value.find(p => p.name === selectedSourceTable.value)
  sourceColumns.value = t ? t.columns || [] : []
  if (selectedDestTable.value) {
    for (const f of destSchema.value[selectedDestTable.value]) {
      mapping[f] = ''
      staticValues[f] = ''
    }
  }
}

function onDestChange() {
  if (selectedDestTable.value) {
    for (const f of destSchema.value[selectedDestTable.value]) {
      mapping[f] = ''
      staticValues[f] = ''
    }
  }
}

async function preview() {
  if (!uploadId.value) return alert('Sube primero un archivo')
  if (!selectedDestTable.value || !selectedSourceTable.value)
    return alert('Selecciona ambas tablas')

  try {
    const payload: Record<string, any> = {}
    for (const f of destSchema.value[selectedDestTable.value]) {
      const chosen = mapping[f]
      if (chosen === '__static') payload[f] = { static: staticValues[f] ?? null }
      else payload[f] = chosen || ''
    }

    const { data } = await previewMapping({
      uploadId: uploadId.value,
      sourceTable: selectedSourceTable.value,
      destTable: selectedDestTable.value,
      mapping: payload,
    })

    previewResult.value = data
    previewHeader.value = Object.keys(data.preview[0] || {})
  } catch (err: any) {
    console.error('Error en preview:', err)
    alert(`Error al previsualizar: ${err.response?.data?.message || err.message}`)
  }
}

async function finalizeImport() {
  if (!uploadId.value) return alert('Sube primero un archivo')
  if (!selectedDestTable.value || !selectedSourceTable.value)
    return alert('Selecciona ambas tablas')

  try {
    const payload: Record<string, any> = {}
    for (const f of destSchema.value[selectedDestTable.value]) {
      const chosen = mapping[f]
      if (chosen === '__static') payload[f] = { static: staticValues[f] ?? null }
      else payload[f] = chosen || ''
    }

    const { data } = await processImport({
      uploadId: uploadId.value,
      sourceTable: selectedSourceTable.value,
      destTable: selectedDestTable.value,
      mapping: payload,
      staticValues,
    })

    if (data.inserted)
      alert(`Importación completa. Insertadas ${data.inserted} filas.`)
    else throw new Error(data.error || 'No se insertaron filas')
  } catch (err: any) {
    console.error('Error en finalizeImport:', err)
    alert(`Error en importación: ${err.response?.data?.message || err.message}`)
  }
}
</script>
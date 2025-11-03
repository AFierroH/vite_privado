<template>
  <div class="p-6 max-w-6xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">Importador - Mapear tablas</h1>

    <section class="mb-6 p-4 border rounded">
      <label class="block mb-2 font-medium">1) Subir archivo .sql</label>
      <input type="file" accept=".sql" @change="onFileChange" />
      <button class="ml-2 px-3 py-1 bg-blue-600 text-white rounded" @click="upload" :disabled="!file">Subir</button>
      <div v-if="uploadId" class="mt-2 text-sm text-green-700">Upload ID: {{ uploadId }}</div>
    </section>

    <section v-if="parsedTables.length" class="mb-6 p-4 border rounded">
      <label class="block mb-2 font-medium">2) Elegir tablas</label>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium">Tabla destino (mi BD)</label>
          <select v-model="selectedDestTable" class="w-full p-2 border rounded" @change="onDestChange">
            <option value="">-- elegir tabla destino --</option>
            <option v-for="(cols, tbl) in destSchema" :key="tbl" :value="tbl">{{ tbl }}</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium">Tabla origen (archivo importado)</label>
          <select v-model="selectedSourceTable" class="w-full p-2 border rounded" @change="onSourceChange">
            <option value="">-- elegir tabla origen --</option>
            <option v-for="t in parsedTables" :key="t.name" :value="t.name">{{ t.name }} (cols: {{ t.columns.length }})</option>
          </select>
        </div>
      </div>

      <div v-if="selectedDestTable && selectedSourceTable" class="mt-4">
        <h3 class="font-semibold">3) Mapear columnas</h3>
        <div class="mt-2 space-y-2">
          <div v-for="destField in destSchema[selectedDestTable]" :key="destField" class="flex gap-2 items-center">
            <div class="w-48 font-medium">{{ destField }}</div>
            <select v-model="mapping[destField]" class="flex-1 p-2 border rounded">
              <option value="">-- no asignado --</option>
              <option value="__skip">-- SKIP --</option>
              <option v-for="col in sourceColumns" :key="col" :value="col">{{ col }}</option>
              <option value="__static">-- valor estático --</option>
            </select>
            <div v-if="mapping[destField] === '__static'">
              <input v-model="staticValues[destField]" placeholder="valor estático" class="p-1 border rounded" />
            </div>
          </div>
        </div>

        <div class="mt-4 flex gap-2">
          <button class="px-4 py-2 bg-green-600 text-white rounded" @click="preview">Previsualizar</button>
          <button class="px-4 py-2 bg-indigo-600 text-white rounded" @click="finalizeImport">Importar (simulado)</button>
        </div>

        <div v-if="previewResult" class="mt-4 p-3 border rounded bg-gray-50">
          <h4 class="font-semibold mb-2">Previsualización</h4>
          <div class="overflow-x-auto">
            <table class="w-full table-auto text-sm">
              <thead><tr>
                <th v-for="h in previewHeader" :key="h" class="border px-2 py-1">{{ h }}</th>
              </tr></thead>
              <tbody>
                <tr v-for="(r, idx) in previewResult.preview" :key="idx">
                  <td v-for="h in previewHeader" :key="h" class="border px-2 py-1">{{ r[h] ?? '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>

    <section v-if="parsedTables.length" class="p-4 border rounded">
      <h2 class="font-semibold mb-2">Tablas detectadas</h2>
      <ul>
        <li v-for="t in parsedTables" :key="t.name" class="mb-2">
          <strong>{{ t.name }}</strong> — {{ t.columns.join(', ') }}
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const file = ref<File|null>(null);
const uploadId = ref<string | null>(null);
const parsedTables = ref<any[]>([]);
const destSchema = ref<Record<string,string[]>>({});
const selectedDestTable = ref<string>('');
const selectedSourceTable = ref<string>('');
const sourceColumns = ref<string[]>([]);
const mapping = reactive<Record<string, any>>({});
const staticValues = reactive<Record<string, any>>({});
const previewResult = ref<any>(null);
const previewHeader = ref<string[]>([]);

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length) file.value = input.files[0];
}

async function upload() {
  if (!file.value) return alert('Selecciona un archivo .sql');
  const form = new FormData();
  form.append('file', file.value);
  const res = await fetch('/api/import/upload-sql', { method: 'POST', body: form });
  const data = await res.json();
  if (data.uploadId) {
    uploadId.value = data.uploadId;
    const parsed = await (await fetch(`/api/import/parsed/${data.uploadId}`)).json();
    parsedTables.value = parsed;
    const schema = await (await fetch('/api/import/dest-schema')).json();
    destSchema.value = schema;
    alert('Archivo subido y parseado');
  } else {
    alert('Error subiendo');
  }
}

function onSourceChange() {
  const t = parsedTables.value.find(p => p.name === selectedSourceTable.value);
  sourceColumns.value = t ? (t.columns || []) : [];
  // reset mapping for selected dest table
  if (selectedDestTable.value) {
    for (const f of destSchema.value[selectedDestTable.value]) { mapping[f] = ''; staticValues[f] = ''; }
  }
}

function onDestChange() {
  // initialize mapping fields
  if (selectedDestTable.value) {
    for (const f of destSchema.value[selectedDestTable.value]) { mapping[f] = ''; staticValues[f] = ''; }
  }
}

async function preview() {
  if (!uploadId.value) return alert('Sube primero');
  if (!selectedDestTable.value || !selectedSourceTable.value) return alert('Elige tablas');
  const payload: Record<string, any> = {};
  for (const f of destSchema.value[selectedDestTable.value]) {
    const chosen = mapping[f];
    if (chosen === '__static') payload[f] = { static: staticValues[f] ?? null };
    else payload[f] = chosen || '';
  }
  const res = await fetch('/api/import/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId: uploadId.value, sourceTable: selectedSourceTable.value, destTable: selectedDestTable.value, mapping: payload })
  });
  const data = await res.json();
  if (data.error) return alert(data.error);
  previewResult.value = data;
  previewHeader.value = Object.keys(data.preview[0] || {});
}

async function finalizeImport() {
  if (!uploadId.value) return alert('Sube primero');
  if (!selectedDestTable.value || !selectedSourceTable.value) return alert('Elige tablas');

  const payload: Record<string, any> = {};
  for (const f of destSchema.value[selectedDestTable.value]) {
    const chosen = mapping[f];
    if (chosen === '__static') payload[f] = { static: staticValues[f] ?? null };
    else payload[f] = chosen || '';
  }

  const res = await fetch('/api/import/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId: uploadId.value,
      sourceTable: selectedSourceTable.value,
      destTable: selectedDestTable.value,
      mapping: payload,
      staticValues
    })
  });
  const data = await res.json();
  if (data.ok) alert(`Importación completa. Insertadas ${data.inserted} filas.`);
  else alert('Error: ' + (data.error || 'Falló la importación'));
}
</script>

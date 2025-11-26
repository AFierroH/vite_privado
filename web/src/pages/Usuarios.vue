<template>
  <div class="h-full flex flex-col p-4 bg-[var(--bg-deep)] text-[var(--text-primary)] transition-colors">
    
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">Gestión de Usuarios</h2>
      <button 
        @click="openModal()"
        class="bg-[var(--accent)] text-[var(--text-on-accent)] px-4 py-2 rounded-lg font-bold shadow hover:opacity-90 transition btn-primary"
      >
        + Nuevo Usuario
      </button>
    </div>

    <div class="flex-1 bg-[var(--panel)] p-0 rounded-lg border border-[var(--border)] shadow-sm overflow-hidden flex flex-col relative">
      
      <div v-if="isLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-[var(--panel)]/90 z-10">
          <svg class="animate-spin h-8 w-8 text-[var(--accent)] mb-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span class="text-sm font-medium text-[var(--text-secondary)]">Cargando usuarios...</span>
      </div>

      <div class="flex-1 overflow-y-auto custom-scroll">
        <table class="w-full text-sm">
            <thead class="bg-[var(--bg-deep)] text-[var(--text-secondary)] uppercase text-xs sticky top-0 border-b border-[var(--border)]">
                <tr>
                    <th class="text-left p-4 font-semibold">Usuario</th>
                    <th class="text-left p-4 font-semibold">Rol</th>
                    <th class="text-right p-4 font-semibold">Acciones</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border)]">
                <tr v-for="u in usuarios" :key="u.id_usuario" class="hover:bg-[var(--bg-deep)] transition-colors">
                    <td class="p-4">
                        <div class="font-bold text-[var(--text-primary)]">{{ u.nombre }}</div>
                        <div class="text-xs text-[var(--text-secondary)]">{{ u.email }}</div>
                    </td>
                    <td class="p-4">
                        <span class="px-2 py-1 rounded text-xs font-bold uppercase border border-[var(--border)]"
                              :class="{
                                'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300': u.rol === 'admin',
                                'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300': u.rol === 'vendedor',
                                'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300': u.rol === 'analista'
                              }">
                            {{ u.rol }}
                        </span>
                    </td>
                    <td class="p-4 text-right">
                        <button @click="openModal(u)" class="text-[var(--accent)] hover:underline mr-3 font-medium">Editar</button>
                        <button @click="remove(u.id_usuario)" class="text-red-500 hover:text-red-600 hover:underline font-medium">Eliminar</button>
                    </td>
                </tr>
            </tbody>
        </table>

        <div v-if="!isLoading && usuarios.length === 0" class="p-10 text-center text-[var(--text-secondary)] italic">
            No hay usuarios registrados.
        </div>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
      <div class="bg-[var(--panel)] p-6 rounded-xl shadow-2xl w-full max-w-md border border-[var(--border)] transform transition-all scale-100">
        <h3 class="text-xl font-bold mb-5 text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
            {{ editing ? "Editar Usuario" : "Nuevo Usuario" }}
        </h3>

        <form @submit.prevent="save" class="space-y-4">
            <div>
                <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Nombre</label>
                <input v-model="form.nombre" required class="w-full p-2.5 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors" />
            </div>
            
            <div>
                <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Email</label>
                <input v-model="form.email" type="email" required class="w-full p-2.5 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors" />
            </div>

            <div>
                <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Contraseña</label>
                <input v-model="form.clave" type="password" :placeholder="editing ? '(Dejar en blanco para no cambiar)' : 'Contraseña'" class="w-full p-2.5 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors" />
            </div>

            <div>
                <label class="block text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">Rol</label>
                <select v-model="form.rol" class="w-full p-2.5 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors">
                    <option value="admin">Administrador</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="analista">Analista</option>
                </select>
            </div>

            <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
                <button type="button" @click="showModal = false" class="px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 rounded-lg font-medium transition">Cancelar</button>
                <button type="submit" class="px-6 py-2 bg-[var(--accent)] text-[var(--text-on-accent)] rounded-lg font-bold shadow transition hover:opacity-90">Guardar</button>
            </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const usuarios = ref([])
const showModal = ref(false)
const editing = ref(false)
const isLoading = ref(false) // <--- NUEVO
const form = ref({ nombre:'', email:'', clave:'', rol:'vendedor' })

function openModal(u=null){
  showModal.value = true
  editing.value = !!u
  form.value = u ? { ...u, clave: '' } : { nombre:'', email:'', clave:'', rol:'vendedor' } // Limpiar clave al editar
}

async function load(){
  isLoading.value = true
  try{
    const res = await api.get('/usuarios')
    usuarios.value = res.data ?? res
  }catch(e){
    console.error(e)
  }finally{
    isLoading.value = false
  }
}

async function save(){
  try{
    // Si edita y clave vacía, borrar clave del payload
    const payload = { ...form.value }
    if(editing.value && !payload.clave) delete payload.clave

    if(editing.value) await api.put(`/usuarios/${form.value.id_usuario}`, payload)
    else await api.post('/usuarios', payload)
    
    await load()
    showModal.value = false
  }catch(e){ alert('Error al guardar usuario') }
}

async function remove(id){
  if(!confirm('¿Eliminar usuario? Esta acción no se puede deshacer.')) return
  try{
    await api.delete(`/usuarios/${id}`)
    load()
  }catch(e){ alert('Error al eliminar') }
}

onMounted(load)
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
</style>
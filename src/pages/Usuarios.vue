<template>
  <div>
    <div class="flex justify-between mb-4">
      <h2 class="text-xl font-semibold">Usuarios</h2>
      <button @click="openModal()" class="bg-[var(--accent)] text-black px-3 py-2 rounded">Nuevo Usuario</button>
    </div>

    <div class="bg-[var(--panel)] p-4 rounded shadow">
      <div v-for="u in usuarios" :key="u.id_usuario" class="flex justify-between py-2 border-b border-gray-800">
        <div>{{u.nombre}} ({{u.email}})</div>
        <div class="flex gap-2">
          <button @click="openModal(u)" class="text-blue-400">Editar</button>
          <button @click="remove(u.id_usuario)" class="text-red-400">Eliminar</button>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div class="bg-[#0b1220] p-6 rounded w-[400px]">
        <h3 class="text-lg font-semibold mb-4">{{editing?'Editar Usuario':'Nuevo Usuario'}}</h3>
        <input v-model="form.nombre" placeholder="Nombre" class="w-full mb-2 p-2 rounded bg-[#081026] text-white"/>
        <input v-model="form.email" placeholder="Email" class="w-full mb-2 p-2 rounded bg-[#081026] text-white"/>
        <input v-model="form.clave" placeholder="Clave" type="password" class="w-full mb-2 p-2 rounded bg-[#081026] text-white"/>
        <select v-model="form.rol" class="w-full mb-4 p-2 rounded bg-[#081026] text-white">
          <option value="admin">Admin</option>
          <option value="vendedor">Vendedor</option>
          <option value="analista">Analista</option>
        </select>
        <div class="flex justify-end gap-3">
          <button @click="showModal=false">Cancelar</button>
          <button @click="save" class="bg-[var(--accent)] text-black px-4 py-2 rounded">Guardar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'

const usuarios = ref([])
const showModal = ref(false)
const editing = ref(false)
const form = ref({ nombre:'', email:'', clave:'', rol:'vendedor' })

function openModal(u=null){
  showModal.value = true
  editing.value = !!u
  form.value = u ? { ...u } : { nombre:'', email:'', clave:'', rol:'vendedor' }
}

async function load(){
  try{
    const res = await api.get('/usuarios')
    usuarios.value = res.data
  }catch(e){
    usuarios.value = [{ id_usuario:1, nombre:'Demo', email:'demo@demo.cl', rol:'admin' }]
  }
}

async function save(){
  try{
    if(editing.value) await api.put(`/usuarios/${form.value.id_usuario}`, form.value)
    else await api.post('/usuarios', form.value)
    await load()
    showModal.value = false
  }catch(e){ alert('Error al guardar usuario') }
}

async function remove(id){
  if(!confirm('¿Eliminar usuario?')) return
  try{
    await api.delete(`/usuarios/${id}`)
    load()
  }catch(e){ alert('Error al eliminar') }
}

onMounted(load)
</script>

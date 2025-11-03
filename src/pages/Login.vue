<script setup>
import { login } from '../api'
import { auth } from '../store/auth'
import { defineEmits } from 'vue'

const emit = defineEmits(['login-success'])
let email = ''
let clave = '' // 🔹 Cambiado de "password" a "clave"

function createSession(user, token, minutes = 60) {
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  const session = { user, token, expiresAt }
  localStorage.setItem('session', JSON.stringify(session))
  auth.setSession(user, token)
  return session
}

async function doLogin() {
  try {
    const res = await login({ email, clave }) // 🔹 Enviamos "clave", no "password"
    const tok = res.data.access_token || res.data.token
    const user = res.data.user || { email }   // 🔹 Recibir usuario completo si viene del backend

    const session = createSession(user, tok)
    emit('login-success', session)
  } catch (e) {
    alert('Login fallido, usando modo demo')
    const session = createSession({ email: 'demo' }, 'demo-token')
    emit('login-success', session)
  }
}

function demo() {
  const session = createSession({ email: 'demo' }, 'demo-token')
  emit('login-success', session)
}
</script>

<template>
  <div class="flex items-center justify-center h-screen">
    <div class="w-full max-w-md bg-[var(--panel)] p-8 rounded shadow">
      <h2 class="text-2xl font-semibold mb-4">Iniciar sesión</h2>
      <form @submit.prevent="doLogin" class="space-y-3">
        <input v-model="email" placeholder="email"
          class="w-full p-2 bg-[#081026] rounded border border-gray-800 text-white"/>
        <input type="password" v-model="clave" placeholder="contraseña"
          class="w-full p-2 bg-[#081026] rounded border border-gray-800 text-white"/>
        <div class="flex justify-between items-center">
          <button class="bg-[var(--accent)] text-black px-4 py-2 rounded">Entrar</button>
          <button type="button" @click="demo">Demo</button>
        </div>
      </form>
    </div>
  </div>
</template>

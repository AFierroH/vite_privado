<script setup>
import { login } from '../api'
import { auth } from '../store/auth'
import { defineEmits, ref } from 'vue'

const emit = defineEmits(['login-success'])
const email = ref('')
const clave = ref('')

function createSession(user, token, minutes = 60) {
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  const session = { user, token, expiresAt }
  localStorage.setItem('session', JSON.stringify(session))
  auth.setSession(user, token)
  return session
}

async function doLogin() {
  if (!email.value || !clave.value) {
    alert('Por favor ingresa correo y contraseña')
    return
  }

  try {
    const res = await login({ email: email.value, clave: clave.value })
    const tok = res.data?.access_token || res.data?.token
    const user = res.data?.user

    if (!tok || !user) {
      throw new Error('Credenciales inválidas')
    }

    const session = createSession(user, tok)
    emit('login-success', session)
  } catch (e) {
    console.error('Error de login:', e)
    alert('Usuario o contraseña incorrectos')
  }
}
</script>

<template>
  <div class="flex items-center justify-center h-screen">
    <div class="w-full max-w-md bg-[var(--panel)] p-8 rounded shadow">
      <h2 class="text-2xl font-semibold mb-4">Iniciar sesión</h2>
      <form @submit.prevent="doLogin" class="space-y-3">
        <input
          v-model="email"
          placeholder="Correo electrónico"
          class="w-full p-2 bg-[#081026] rounded border border-gray-800 text-white"
        />
        <input
          type="password"
          v-model="clave"
          placeholder="Contraseña"
          class="w-full p-2 bg-[#081026] rounded border border-gray-800 text-white"
        />
        <div class="flex justify-end">
          <button class="bg-[var(--accent)] text-black px-4 py-2 rounded hover:opacity-90">
            Entrar
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
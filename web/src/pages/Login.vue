<script setup>
import { login, fetchEmpresa } from '../api'
import { auth } from '../store/auth'
import { defineEmits, ref } from 'vue'

const emit = defineEmits(['login-success'])
const email = ref('')
const clave = ref('')

function createSession(user, token, empresa, minutes = 60) {
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  
  const session = { user, token, empresa, expiresAt }
  
  localStorage.setItem('session', JSON.stringify(session)) 
  
  localStorage.setItem('token', token) 
  
  auth.setSession(user, token)
  return session
}

async function doLogin() {
  if (!email.value || !clave.value) {
    alert('Por favor ingresa correo y contraseña')
    return
  }

  try {
    const data = await login({ email: email.value, clave: clave.value })

    const tok = data.access_token || data.token
    const user = data.user

    if (!tok || !user) {
      throw new Error('Respuesta de login incompleta')
    }

    let empresaFull = data.empresa || user.empresa

    if (!empresaFull && user.id_empresa) {
        try {
            console.log('Obteniendo datos de empresa...')
            const respEmpresa = await fetchEmpresa(user.id_empresa)
            empresaFull = respEmpresa
        } catch (err) {
            console.warn('No se pudo cargar la empresa', err)

            empresaFull = { razonSocial: 'Empresa Generica', rut: '99.999.999-9' }
        }
    }

    const session = createSession(user, tok, empresaFull)
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
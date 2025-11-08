<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import LoginPage from './pages/Login.vue'
import MainLayout from './pages/MainLayout.vue'

const user = ref(null)

// recibido desde LoginPage
function handleLogin(session) {
  user.value = session.user
  localStorage.setItem('session', JSON.stringify(session))
  console.log('Sesión iniciada hasta:', session.expiresAt)
}

function logout() {
  user.value = null
  localStorage.removeItem('session')
  console.log('Sesión cerrada o expirada')
  window.location.href = '/login'
}

// Renovar sesión automáticamente
function renewSession() {
  const sessionStr = localStorage.getItem('session')
  if (!sessionStr) return

  const session = JSON.parse(sessionStr)
  const now = new Date()
  const expires = new Date(session.expiresAt)

  if (expires <= now) {
    console.log('Sesión expirada, cerrando...')
    logout()
    return
  }

  // Renovar +5 minutos calculo xd 5 * 60 * 1000ms
  session.expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  localStorage.setItem('session', JSON.stringify(session))
}

onMounted(() => {
  const sessionStr = localStorage.getItem('session')
  if (sessionStr) {
    const session = JSON.parse(sessionStr)
    const now = new Date()

    if (new Date(session.expiresAt) <= now) {
      console.log('Sesión expirada al iniciar')
      logout()
    } else {
      console.log('Sesión válida hasta:', session.expiresAt)
      user.value = session.user
    }
  }

  // Escucha eventos para renovar
  window.addEventListener('click', renewSession)
  window.addEventListener('keydown', renewSession)
  window.addEventListener('scroll', renewSession)
})

onUnmounted(() => {
  window.removeEventListener('click', renewSession)
  window.removeEventListener('keydown', renewSession)
  window.removeEventListener('scroll', renewSession)
})
</script>

<template>
  <div class="min-h-screen bg-[#071025] text-gray-100">
    <LoginPage v-if="!user" @login-success="handleLogin" />
    <MainLayout v-else :user="user" @logout="logout" />
  </div>
</template>

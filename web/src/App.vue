<script setup>
import { ref, onMounted, onUnmounted, watchEffect } from 'vue'
import { useRouter } from 'vue-router' // 1. Importar useRouter

import LoginPage from './pages/Login.vue'
import MainLayout from './pages/MainLayout.vue'

const router = useRouter() // 2. Inicializar router
const user = ref(null)
const isReady = ref(false)

function handleLogin(session) {
  user.value = session.user
  localStorage.setItem('session', JSON.stringify(session))
  console.log('Sesión iniciada:', session.user)
  
  // 3. AGREGAR ESTO: Redirigir fuera del login
  router.push('/dashboard') 
}

function logout() {
  user.value = null
  localStorage.removeItem('session')
  console.log('Sesión cerrada')
  window.location.reload()
}

function renewSession() {
  const sessionStr = localStorage.getItem('session')
  if (!sessionStr) return
  const session = JSON.parse(sessionStr)
  const now = new Date()
  if (new Date(session.expiresAt) <= now) {
    logout()
  } else {
    session.expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    localStorage.setItem('session', JSON.stringify(session))
  }
}

onMounted(() => {
  const sessionStr = localStorage.getItem('session')
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr)
      const now = new Date()
      if (new Date(session.expiresAt) > now) {
        user.value = session.user
        console.log('Sesión cargada:', session.user)
      } else {
        logout()
      }
    } catch (err) {
      logout()
    }
  }
  isReady.value = true
  window.addEventListener('click', renewSession)
  window.addEventListener('keydown', renewSession)
  window.addEventListener('scroll', renewSession)
})

onUnmounted(() => {
  window.removeEventListener('click', renewSession)
  window.removeEventListener('keydown', renewSession)
  window.removeEventListener('scroll', renewSession)
})

watchEffect(() => console.log('Usuario actual:', user.value))
</script>

<template>
  <!-- 👇 Ya no usamos flex ni justify-center -->
  <div class="h-screen w-screen bg-[var(--bg-deep)] text-[var(--text-primary)]">
    <div v-if="!isReady" class="flex items-center justify-center h-full text-gray-400">
      Cargando sesión...
    </div>

    <LoginPage v-else-if="!user" @login-success="handleLogin" />
    <MainLayout v-else :user="user" @logout="logout" />
  </div>
</template>

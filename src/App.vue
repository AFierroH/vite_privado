<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import LoginPage from './pages/Login.vue'
import MainLayout from './pages/MainLayout.vue'
const user = ref(null)
// manejadores
function handleLogin(session) {
  user.value = session.user
  localStorage.setItem('session', JSON.stringify(session))
  console.log('Sesión iniciada:', session.user)
}
function logout() {
  user.value = null
  localStorage.removeItem('session')
  console.log('Sesión cerrada')
  window.location.reload() // recarga limpia
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
// monta sesión previa
onMounted(() => {
  const sessionStr = localStorage.getItem('session')
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr)
      const now = new Date()
      if (new Date(session.expiresAt) > now) {
        user.value = session.user
      } else {
        console.log('Sesión expirada al iniciar')
        logout()
      }
    } catch (err) {
      console.warn('Sesión inválida, limpiando...')
      logout()
    }
  }
})
onUnmounted(() => {
  window.removeEventListener('click', renewSession)
  window.removeEventListener('keydown', renewSession)
})
</script>
<template>
  <div class="min-h-screen bg-[#071025] text-gray-100">
    <LoginPage v-if="!user" @login-success="handleLogin" />
    <MainLayout v-else :user="user" @logout="logout" />
<script>
console.log('USER EN MAINLAYOUT:', user.value)
</script>
  </div>
</template>
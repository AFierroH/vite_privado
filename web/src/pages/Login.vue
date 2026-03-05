<template>
  <div class="relative flex items-center justify-center h-screen overflow-hidden bg-[var(--bg-deep)] transition-colors duration-300">
    
    <canvas ref="canvasRef" class="absolute top-0 left-0 w-full h-full pointer-events-none"></canvas>

    <div class="relative z-10 w-full max-w-md bg-[var(--panel)]/90 backdrop-blur-md p-8 rounded-xl shadow-2xl border border-[var(--border)]">
      <h2 class="text-2xl font-bold mb-6 text-[var(--accent)] text-center">MiPOSra</h2>
      
      <form @submit.prevent="doLogin" class="space-y-5">
        <div>
            <label class="block text-sm font-bold text-[var(--text-secondary)] uppercase mb-1">Correo Electrónico</label>
            <input
              v-model="email"
              type="text"
              placeholder="admin@ejemplo.com"
              class="w-full p-3 bg-[var(--input-bg)] rounded-lg border border-[var(--input-border)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
        </div>
        
        <div>
            <label class="block text-sm font-bold text-[var(--text-secondary)] uppercase mb-1">Contraseña</label>
            <input
              type="password"
              v-model="clave"
              placeholder="••••••••"
              class="w-full p-3 bg-[var(--input-bg)] rounded-lg border border-[var(--input-border)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
        </div>

        <div class="flex justify-end pt-4">
          <button class="w-full btn-primary font-bold px-4 py-3 rounded-lg shadow-lg active:scale-[0.98]">
            Iniciar Sesión
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { login, fetchEmpresa } from '../api'
import { auth } from '../store/auth'
import { defineEmits, ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['login-success'])
const email = ref('')
const clave = ref('')

// --- ANIMACIÓN DE PARTÍCULAS ADAPTATIVA ---
const canvasRef = ref(null)
let animationFrameId = null
let particles = []
const mouse = { x: null, y: null, radius: 150 }

class Particle {
  constructor(canvas) {
    this.canvas = canvas
    this.x = Math.random() * canvas.width
    this.y = Math.random() * canvas.height
    this.size = Math.random() * 2 + 1
    this.speedX = Math.random() * 1 - 0.5
    this.speedY = Math.random() * 1 - 0.5
  }
  update() {
    this.x += this.speedX
    this.y += this.speedY
    if (this.x > this.canvas.width || this.x < 0) this.speedX = -this.speedX
    if (this.y > this.canvas.height || this.y < 0) this.speedY = -this.speedY
    
    let dx = mouse.x - this.x
    let dy = mouse.y - this.y
    let distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < mouse.radius) {
      const forceDirectionX = dx / distance
      const forceDirectionY = dy / distance
      const force = (mouse.radius - distance) / mouse.radius
      const directionX = forceDirectionX * force * 3
      const directionY = forceDirectionY * force * 3
      if (distance < mouse.radius) {
        this.x -= directionX
        this.y -= directionY
      }
    }
  }
  draw(ctx) {
    // Usamos un color base azulado que queda bien en ambos temas
    ctx.fillStyle = 'rgba(59, 130, 246, 0.6)'
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

function initParticles() {
  particles = []
  const canvas = canvasRef.value
  if (!canvas) return
  const numberOfParticles = (canvas.width * canvas.height) / 9000
  for (let i = 0; i < numberOfParticles; i++) {
    particles.push(new Particle(canvas))
  }
}

function animate() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  for (let i = 0; i < particles.length; i++) {
    particles[i].update()
    particles[i].draw(ctx)
    
    for (let j = i; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance < 100) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.8 - distance / 100})`
        ctx.lineWidth = 0.5
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.stroke()
      }
    }
  }
  animationFrameId = requestAnimationFrame(animate)
}

function handleResize() {
  if (canvasRef.value) {
    canvasRef.value.width = window.innerWidth
    canvasRef.value.height = window.innerHeight
    initParticles()
  }
}

function handleMouseMove(e) { mouse.x = e.x; mouse.y = e.y }
function handleMouseLeave() { mouse.x = undefined; mouse.y = undefined }

onMounted(() => {
  if (canvasRef.value) {
    canvasRef.value.width = window.innerWidth
    canvasRef.value.height = window.innerHeight
    initParticles()
    animate()
    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseout', handleMouseLeave)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseout', handleMouseLeave)
  cancelAnimationFrame(animationFrameId)
})

function createSession(user, token, empresa, minutes = 60) {
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  const userWithRole = { ...user, rol: user.rol || user.role || 'vendedor' }
  const session = { user: userWithRole, token, empresa, expiresAt }
  
  localStorage.setItem('session', JSON.stringify(session))
  localStorage.setItem('token', token)
  auth.setSession(userWithRole, token)
  return session
}

async function doLogin() {
  if (!email.value || !clave.value) return alert('Ingresa correo y contraseña')
  try {
    const data = await login({ email: email.value, clave: clave.value })
    const tok = data.access_token || data.token
    const user = data.user
    if (!tok || !user) throw new Error('Respuesta incompleta')

    let empresaFull = data.empresa || user.empresa
    if (!empresaFull && user.id_empresa) {
        try { empresaFull = await fetchEmpresa(user.id_empresa) } 
        catch (err) { empresaFull = { id_empresa: user.id_empresa, nombre: 'Sin Datos', rut: '99' } }
    }

    const session = createSession(user, tok, empresaFull)
    emit('login-success', session)

  } catch (e) {
    alert('Usuario o contraseña incorrectos')
  }
}
</script>

<style scoped>
canvas { display: block; }
</style>
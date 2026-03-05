<template>
  <div class="landing-root">

    <!-- NAVBAR -->
    <header class="topbar">
      <div class="brand-group">
        <img src="/src/assets/img/logo.png" class="logo" />
        <span class="brand">POSOFT</span>
      </div>

      <nav class="nav-links">
        <a href="https://github.com/AFierroH/pos_sii_nest" target="_blank" class="link">
          GitHub
        </a>
        <router-link to="/login" class="link">Login</router-link>
        <router-link to="/registro" class="btn-primary">
          Servicio Administrado
        </router-link>
      </nav>
    </header>

    <!-- HERO -->
    <section class="hero">
      <div class="hero-content">
        <h1>
          Sistema POS open-source listo para producción
        </h1>

        <p class="hero-sub">
          Descárgalo gratis y ejecútalo en tu propio servidor,
          o utiliza nuestro servicio administrado con hosting,
          soporte y actualizaciones incluidas.
        </p>

        <div class="hero-buttons">
          <a href="https://github.com/AFierroH/pos_sii_nest"
             target="_blank"
             class="btn-secondary">
            Ver código en GitHub
          </a>

          <router-link to="/registro" class="btn-primary large">
            Contratar servicio
          </router-link>
        </div>
      </div>
    </section>

    <!-- COMO FUNCIONA -->
    <section class="section">
      <h2>Cómo funciona</h2>

      <div class="grid-2">
        <div class="card">
          <h3>Web App</h3>
          <p>
            Gestión completa desde navegador:
            ventas, inventario, reportes,
            administración de usuarios y estadísticas.
            Multiusuario y lista para entornos reales.
          </p>
        </div>

        <div class="card">
          <h3>Aplicación de Escritorio</h3>
          <p>
            Diseñada exclusivamente para impresión.
            Se conecta a la web y no requiere
            base de datos local ni configuración compleja.
          </p>
        </div>
      </div>
    </section>

    <!-- MODELO -->
    <section class="section dark">
      <h2>Modelo Flexible</h2>

      <div class="grid-3">

        <div class="pricing-card">
          <h3>Open Source</h3>
          <p class="price">Gratis</p>
          <ul>
            <li>Código completo disponible</li>
            <li>Sin límites funcionales</li>
            <li>Instalación en tu propio servidor</li>
            <li>Control total del proyecto</li>
          </ul>
          <a href="https://github.com/AFierroH/pos_sii_nest"
             target="_blank"
             class="btn-secondary full">
            Ver repositorio
          </a>
        </div>

        <div class="pricing-card featured">
          <h3>Servicio Administrado</h3>
          <p class="price">Mensual</p>
          <ul>
            <li>Hosting seguro</li>
            <li>Backups automáticos</li>
            <li>Actualizaciones incluidas</li>
            <li>Soporte técnico directo</li>
          </ul>
          <router-link to="/registro" class="btn-primary full">
            Contratar
          </router-link>
        </div>

        <div class="pricing-card">
          <h3>Implementación Empresarial</h3>
          <p class="price">Personalizado</p>
          <ul>
            <li>Adaptaciones a medida</li>
            <li>Integraciones externas</li>
            <li>Capacitación</li>
            <li>Soporte prioritario</li>
          </ul>
          <router-link to="/contact" class="btn-secondary full">
            Contactar
          </router-link>
        </div>

      </div>
    </section>

    <!-- TECNOLOGIA -->
    <section class="section">
      <h2>Arquitectura Moderna</h2>
      <div class="tech-list">
        <span>Vue 3</span>
        <span>Node.js</span>
        <span>MySQL</span>
        <span>Docker Ready</span>
        <span>Linux Compatible</span>
      </div>
    </section>

    <!-- CONTACTO -->
    <section class="section dark">
      <h2>Contacto</h2>

      <form @submit.prevent="handleSubmit" class="contact-form">
        <input v-model="form.name" placeholder="Nombre" required />
        <input v-model="form.email" type="email" placeholder="Correo" required />
        <textarea v-model="form.message" rows="4" placeholder="Consulta..." required></textarea>
        <button type="submit" class="btn-primary full">Enviar</button>
      </form>

      <p v-if="sent" class="sent-ok">
        Mensaje enviado correctamente.
      </p>
    </section>

    <!-- FOOTER -->
    <footer class="footer">
      © 2025 POSOFT · Armin Fierro Henoch
    </footer>

  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { API_URL } from '../api.js'

const form = reactive({
  name: '',
  email: '',
  message: ''
})

const sent = ref(false)

async function handleSubmit() {
  try {
    const res = await fetch(`${API_URL}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })

    if (res.ok) {
      sent.value = true
      form.name = form.email = form.message = ''
      setTimeout(() => sent.value = false, 4000)
    }
  } catch {
    alert('Error de conexión')
  }
}
</script>

<style scoped>

/* BASE */
.landing-root {
  font-family: Inter, system-ui, sans-serif;
  background: #0b1220;
  color: #f1f5f9;
}

/* NAVBAR */
.topbar {
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:16px 24px;
  background:#0f172a;
}

.brand-group {
  display:flex;
  align-items:center;
  gap:10px;
}

.logo {
  width:34px;
  background:white;
  border-radius:6px;
  padding:4px;
}

.brand {
  font-weight:700;
  color:#3da9fc;
}

.nav-links {
  display:flex;
  gap:14px;
  align-items:center;
}

.link {
  color:#cbd5e1;
}

.btn-primary {
  background:#3da9fc;
  color:#000;
  padding:10px 16px;
  border-radius:8px;
  font-weight:600;
}

.btn-secondary {
  border:1px solid #3da9fc;
  color:#3da9fc;
  padding:10px 16px;
  border-radius:8px;
}

.large {
  padding:14px 24px;
}

.full {
  width:100%;
  text-align:center;
}

/* HERO */
.hero {
  padding:100px 20px 80px;
  text-align:center;
}

.hero h1 {
  font-size:clamp(28px, 5vw, 46px);
  margin-bottom:20px;
}

.hero-sub {
  max-width:700px;
  margin:0 auto 30px;
  color:#94a3b8;
}

.hero-buttons {
  display:flex;
  justify-content:center;
  gap:16px;
  flex-wrap:wrap;
}

/* SECTIONS */
.section {
  padding:80px 20px;
  max-width:1100px;
  margin:auto;
  text-align:center;
}

.section.dark {
  background:#111827;
}

.grid-2 {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  gap:24px;
  margin-top:40px;
}

.grid-3 {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  gap:24px;
  margin-top:40px;
}

.card {
  background:#1e293b;
  padding:24px;
  border-radius:12px;
}

.pricing-card {
  background:#1e293b;
  padding:28px;
  border-radius:14px;
  text-align:left;
}

.pricing-card.featured {
  border:2px solid #3da9fc;
}

.price {
  font-size:20px;
  font-weight:700;
  margin:12px 0;
}

.tech-list {
  display:flex;
  flex-wrap:wrap;
  justify-content:center;
  gap:14px;
  margin-top:30px;
}

.tech-list span {
  background:#1e293b;
  padding:10px 16px;
  border-radius:8px;
  font-size:14px;
}

/* CONTACT */
.contact-form {
  max-width:600px;
  margin:40px auto 0;
  display:flex;
  flex-direction:column;
  gap:14px;
}

.contact-form input,
.contact-form textarea {
  padding:12px;
  border-radius:8px;
  border:1px solid #334155;
  background:#0f172a;
  color:white;
}

.sent-ok {
  margin-top:14px;
  color:#3da9fc;
}

/* FOOTER */
.footer {
  padding:30px;
  text-align:center;
  color:#64748b;
  border-top:1px solid #1e293b;
}

/* RESPONSIVE */
@media (max-width: 768px) {
  .nav-links {
    gap:8px;
  }
}

</style>
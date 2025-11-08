<template>
  <div class="landing-root">
    <!-- TOPBAR pequeña: logo izquierdo, Login - Registro derecha -->
    <header class="topbar">
      <div class="topbar-left">
        <img src="/src/assets/img/logo.png" alt="logo" class="logo" />
        <span class="brand">POSOFT</span>
      </div>
      <nav class="topbar-right">
        <router-link to="/login" class="link">Login</router-link>
        <router-link to="/registro" class="btn-register">Registro</router-link>
      </nav>
    </header>

    <!-- HERO con CTA central -->
    <section class="hero">
      <h1 class="hero-title">Gestiona ventas e inventario sin complicaciones</h1>
      <p class="hero-sub">Rápido, seguro y diseñado para comercios reales. Empieza hoy.</p>
      <router-link to="/registro" class="cta">Comprar Servicio</router-link>

      <div class="hero-expl">
        <p>
          POSOFT (antes Pos Ventas) integra facturación, control de stock y reportes inteligentes
          para que puedas enfocarte en hacer crecer tu negocio.
        </p>
      </div>
    </section>

    <!-- Alternado: bloques azul - blanco - imagen -->
    <section class="alt-blocks">
      <div class="block dark">
        <h3>Velocidad y precisión</h3>
        <p>Procesa ventas al instante y reduce errores humanos con validaciones inteligentes.</p>
      </div>

      <div class="block light">
        <h3>Interfaz amigable</h3>
        <p>Una experiencia intuitiva para cualquier empleado, sin curvas de aprendizaje.</p>
      </div>

      <div class="block image">
        <img src="/src/assets/img/placeholder-1.png" alt="placeholder" />
      </div>

      <div class="block light">
        <h3>Multi-dispositivo</h3>
        <p>Accede desde la web o desde nuestra app de escritorio.</p>
      </div>

      <div class="block dark">
        <h3>Soporte y actualizaciones</h3>
        <p>Actualizaciones periódicas y soporte técnico directo de nuestro equipo.</p>
      </div>
    </section>

    <!-- Testimonios -->
    <section class="testimonials">
      <h2>Lo que dicen nuestros clientes</h2>
      <div class="test-grid">
        <div class="test-card">  
          <p class="quote">"POSOFT redujo mis errores de inventario a la mitad."</p>
          <p class="who">— Daniela, Tienda La Esquina</p>
        </div>
        <div class="test-card">
          <p class="quote">"Rápido y fiable, ideal para mi local."</p>
          <p class="who">— Roberto, Cafetería Central</p>
        </div>
        <div class="test-card">
          <p class="quote">"Los reportes me salvaron en la temporada alta."</p>
          <p class="who">— Sandra, Boutique</p>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section class="pricing">
      <h2>Planes</h2>
      <div class="pricing-grid">
        <div class="price-card">
          <h3>Gratis</h3>
          <p class="price">0$</p>
          <ul>
            <li>Hasta 50 productos</li>
            <li>Funciones básicas</li>
          </ul>
          <router-link to="/registro" class="price-cta">Comenzar</router-link>
        </div>

        <div class="price-card featured">
          <h3>Pyme</h3>
          <p class="price">$9/mes</p>
          <ul>
            <li>Hasta 2000 productos</li>
            <li>Reporte Avanzado</li>
            <li>Soporte prioritario</li>
          </ul>
          <router-link to="/registro" class="price-cta">Probar</router-link>
        </div>

        <div class="price-card">
          <h3>Empresa</h3>
          <p class="price">Contactar</p>
          <ul>
            <li>Integraciones personalizadas</li>
            <li>Onboarding</li>
          </ul>
          <router-link to="/contact" class="price-cta">Contactar</router-link>
        </div>
      </div>
    </section>

    <!-- Contacto: formulario → envía a backend -->
    <section class="contact">
      <h2>Contacto</h2>
      <form @submit.prevent="handleSubmit" class="contact-form">
        <input v-model="form.name" placeholder="Nombre" required />
        <input v-model="form.email" placeholder="Correo" type="email" required />
        <textarea v-model="form.message" rows="5" placeholder="Consulta..." required></textarea>
        <button type="submit" class="send-btn">Enviar</button>
      </form>
      <p v-if="sent" class="sent-ok">Mensaje enviado. Gracias — te respondemos pronto.</p>
    </section>

    <!-- Footer -->
    <footer class="site-footer">
      <div>© 2025 POSOFT · Armin Fierro Henoch</div>
      <div>Contacto: arminfierro@live.cl</div>
    </footer>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { API_URL } from '../api.js' // asegúrate de exportar API_URL
const form = reactive({ name: '', email: '', message: '' })
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
      setTimeout(()=> sent.value=false, 4000)
    } else {
      alert('Error al enviar')
    }
  } catch (err) {
    alert('Error en conexión')
  }
}
</script>

<style scoped>
/* Variables de color */
:root{
  --blue-dark: #081026;
  --blue-mid: #0A1633;
  --accent: #3DA9FC;
  --light: #f8fafc;
}

/* Reset y layout */
.landing-root { background: var(--blue-dark); color: white; font-family: Inter, system-ui, Arial; }

/* Topbar */
.topbar {
  display:flex; justify-content:space-between; align-items:center;
  padding:10px 24px; background:var(--blue-mid); border-bottom:1px solid rgba(255,255,255,0.03);
}
.topbar-left { display:flex; align-items:center; gap:12px; }
.logo { width:36px; height:36px; object-fit:contain; border-radius:6px; background:white; padding:4px; }
.brand { color:var(--accent); font-weight:700; font-size:18px; letter-spacing:0.6px; }

/* Topbar right */
.topbar-right { display:flex; gap:12px; align-items:center; }
.topbar-right .link { color:rgba(255,255,255,0.85); }
.topbar-right .btn-register { background:var(--accent); color:#000; padding:8px 12px; border-radius:8px; }

/* HERO */
.hero { text-align:center; padding:60px 18px 80px; }
.hero-title { font-size:36px; margin-bottom:8px; color:white; }
.hero-sub { color:rgba(255,255,255,0.75); margin-bottom:18px; max-width:820px; margin-left:auto; margin-right:auto; }
.cta { background:var(--accent); color:#000; padding:16px 36px; border-radius:14px; font-weight:700; text-decoration:none; }

/* Alternating blocks */
.alt-blocks { padding:40px 18px; display:grid; gap:18px; max-width:1100px; margin:0 auto; }
.block { padding:28px; border-radius:12px; color:var(--light); }
.block.dark { background:var(--blue-mid); }
.block.light { background:#fff; color:#03102a; border:1px solid rgba(3,16,42,0.06); }
.block.image img { width:100%; border-radius:10px; }

/* Testimonials */
.testimonials{ padding:40px 18px; text-align:center; }
.test-grid{ display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); max-width:1000px; margin:0 auto; }
.test-card{ background:var(--blue-mid); padding:18px; border-radius:10px; color:white; }

/* Pricing */
.pricing{ padding:40px 18px; text-align:center; }
.pricing-grid{ display:grid; gap:18px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); max-width:1000px; margin:0 auto; }
.price-card{ background:#071025; padding:20px; border-radius:10px; border:1px solid rgba(255,255,255,0.02); }
.price-card.featured{ border:2px solid var(--accent); transform: scale(1.02); }

/* Contact */
.contact{ padding:40px 18px; text-align:center; }
.contact-form{ max-width:640px; margin:0 auto; display:flex; flex-direction:column; gap:12px; }
.contact-form input, .contact-form textarea{ padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.02); color:white; outline:none; resize:vertical; }
.send-btn{ background:var(--accent); color:#000; padding:10px 18px; border-radius:8px; font-weight:700; }

/* Footer */
.site-footer{ padding:24px; text-align:center; color:rgba(255,255,255,0.6); border-top:1px solid rgba(255,255,255,0.02); }

/* Remove scrollbars where desired (may vary by browser) */
html,body { scrollbar-width: thin; }
</style>

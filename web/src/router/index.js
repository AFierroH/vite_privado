import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../pages/Dashboard.vue'
import Estadisticas from '../pages/Estadisticas.vue'
import Ventas from '../pages/Ventas.vue'
import Ventas2 from '../pages/Ventas2.vue'
import Productos from '../pages/Productos.vue'
import Configuracion from '../pages/Configuracion.vue'
import printTest from '../pages/PruebaImpresora.vue'
import Usuarios from '../pages/Usuarios.vue'
import Importer from '../pages/Importer.vue'
import Login from '../pages/Login.vue'
const routes = [
    { path: '/login', component: Login },
  { path: '/', redirect: '/login' },
  { path: '/dashboard', component: Dashboard },
  { path: '/estadisticas', component: Estadisticas },
  { path: '/ventas', component: Ventas },
  { path: '/productos', component: Productos },
  { path: '/config', component: Configuracion },
  { path: '/impresora', component: printTest },
  { path: '/importer', component: Importer },
  { path: '/usuarios', component: Usuarios },
  { path: '/Ventas2', component: Ventas2 }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

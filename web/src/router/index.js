import { createRouter, createWebHistory } from 'vue-router'

// 1. IMPORTA NORMAL SOLO EL LOGIN (Lo primero que se ve)
import Login from '../pages/Login.vue'

// 2. EL RESTO, IMPORTALOS ASÍ (Lazy Loading):
const Dashboard = () => import('../pages/Dashboard.vue')
const Estadisticas = () => import('../pages/Estadisticas.vue')
const Ventas = () => import('../pages/Ventas.vue')
const Ventas2 = () => import('../pages/Ventas2.vue')
const Productos = () => import('../pages/Productos.vue')
const Configuracion = () => import('../pages/Configuracion.vue')
const printTest = () => import('../pages/PruebaImpresora.vue')
const Usuarios = () => import('../pages/Usuarios.vue')
const Importer = () => import('../pages/Importer.vue')

const routes = [
  { path: '/login', component: Login },
  { path: '/', redirect: '/dashboard' },
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

<template>
  <aside class="w-1/5 max-w-[300px] bg-[var(--panel)] border-r border-gray-800 p-4 flex flex-col">
    <!-- ENCABEZADO -->
    <div class="mb-6">
      <div class="text-lg font-bold text-white">MiEmpresa</div>
      <div class="text-xs text-[var(--muted)]">
        {{ user?.email || 'Cuenta Demo' }}
      </div>
    </div>

    <!-- NAVEGACIÓN -->
    <nav class="flex-1 overflow-auto">
      <template v-for="item in filteredItems" :key="item.key">
        <button
          @click="$router.push(item.route)"
          class="w-full text-left px-3 py-2 rounded mb-1 text-[var(--muted)] hover:bg-[var(--accent)] hover:text-black transition"
        >
          {{ item.title }}
        </button>
      </template>
    </nav>

    <!-- SECCIÓN DE ATAJOS -->
    <div class="mt-4 text-xs text-[var(--muted)]">
      <div class="mb-2">Atajos</div>
      <div>• Ctrl+P: Imprimir</div>
    </div>

    <!-- LOGOUT -->
    <div class="mt-6 border-t border-gray-700 pt-3">
      <button
        @click="logout"
        class="w-full px-3 py-2 text-left rounded text-red-400 hover:bg-red-600 hover:text-white transition"
      >
        🔒 Cerrar sesión
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../store/auth'

defineProps({ user: Object })
const router = useRouter()

// Lista de items del menú
const items = [
  { key: 'dashboard', title: 'Dashboard', route: '/dashboard' },
  { key: 'ventas', title: 'Ventas', route: '/ventas' },
  { key: 'productos', title: 'Productos', route: '/productos', adminOnly: true },
  { key: 'estadisticas', title: 'Estadísticas', route: '/estadisticas', adminOnly: true },
  { key: 'config', title: 'Configuración', route: '/config', adminOnly: true },
  { key: 'usuarios', title: 'Usuarios', route: '/usuarios' },
  { key: 'importer', title: 'Importar BD', route: '/importer' },
  { key: 'impresora', title: 'Prueba', route: '/impresora' }
]

// Filtra ítems si el usuario no es admin
const filteredItems = computed(() =>
  auth.user?.rol === 'admin' || auth.user?.role === 'admin'
    ? items
    : items.filter(i => !i.adminOnly)
)

// Acción de logout
function logout() {
  localStorage.removeItem('session')
  auth.setSession(null, null)
  router.push('/login')
}
</script>

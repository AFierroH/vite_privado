<template>
  <div class="h-full flex flex-col p-6 bg-[var(--bg-deep)] text-[var(--text-primary)] overflow-y-auto custom-scroll transition-colors">
    
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 shrink-0">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-2">
          Hola, Usuario 👋
        </h1>
        <p class="text-sm text-[var(--text-secondary)]">Resumen de operaciones del día</p>
      </div>

      <div class="flex gap-3">
        <button class="bg-[var(--bg-deep)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-primary)] px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm">
           <span>📦</span> Inventario
        </button>
        <button class="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--text-on-accent)] px-6 py-2 rounded-lg font-bold shadow-lg shadow-[var(--accent)]/20 flex items-center gap-2 transition-all transform hover:scale-105">
           <span>🛒</span> Nueva Venta
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-[var(--panel)] p-4 rounded-xl border border-[var(--border)] shadow-sm relative overflow-hidden group">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-4xl">💰</div>
        <p class="text-sm text-[var(--text-secondary)] font-medium">Ventas de Hoy</p>
        <p class="text-2xl font-bold mt-1 text-[var(--text-primary)]">{{ formatPrice(kpis.ventasHoy) }}</p>
        <div class="mt-2 text-xs text-green-500 flex items-center font-medium">
          <span class="bg-green-500/10 px-1.5 py-0.5 rounded mr-1">↑ 12%</span> vs ayer
        </div>
      </div>

      <div class="bg-[var(--panel)] p-4 rounded-xl border border-[var(--border)] shadow-sm relative overflow-hidden group">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-4xl">🧾</div>
        <p class="text-sm text-[var(--text-secondary)] font-medium">Transacciones</p>
        <p class="text-2xl font-bold mt-1 text-[var(--text-primary)]">{{ kpis.transacciones }}</p>
        <p class="mt-2 text-xs text-[var(--text-secondary)]">Ticket prom: {{ formatPrice(kpis.ticketPromedio) }}</p>
      </div>

      <div class="bg-[var(--panel)] p-4 rounded-xl border border-red-500/30 shadow-sm relative overflow-hidden group">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-4xl text-red-500">⚠️</div>
        <p class="text-sm text-[var(--text-secondary)] font-medium">Stock Crítico</p>
        <p class="text-2xl font-bold mt-1 text-red-400">{{ kpis.stockBajo }}</p>
        <p class="mt-2 text-xs text-red-400/80 font-medium cursor-pointer hover:underline">Ver productos &rarr;</p>
      </div>

      <div class="bg-[var(--panel)] p-4 rounded-xl border border-[var(--border)] shadow-sm relative overflow-hidden group">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-4xl">📦</div>
        <p class="text-sm text-[var(--text-secondary)] font-medium">Inventario Total</p>
        <p class="text-2xl font-bold mt-1 text-[var(--text-primary)]">{{ kpis.totalProductos }}</p>
        <p class="mt-2 text-xs text-[var(--text-secondary)]">Items registrados</p>
      </div>
    </div>

    <div class="flex flex-col md:flex-row justify-between items-center mb-4">
       <h2 class="text-xl font-bold">Análisis</h2>
       
       <div class="flex bg-[var(--panel)] rounded-lg border border-[var(--border)] p-1 shadow-sm scale-90 origin-right">
          <button
              v-for="t in rangos"
              :key="t.val"
              @click="setRange(t.val)"
              :class="['px-3 py-1 rounded-md text-xs font-medium transition-colors', range === t.val ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]']">
              {{ t.label }}
          </button>
       </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
      
      <div class="lg:col-span-2 bg-[var(--panel)] p-5 rounded-xl border border-[var(--border)] shadow-sm flex flex-col h-[350px] relative">
        <h3 class="font-semibold text-sm text-[var(--text-secondary)] mb-2">Tendencia de Ventas</h3>
        <div class="relative flex-1 w-full min-h-0">
           <canvas ref="statsChart"></canvas>
        </div>
      </div>

      <div class="bg-[var(--panel)] rounded-xl border border-[var(--border)] shadow-sm flex flex-col h-[350px] relative overflow-hidden">
        <div class="p-4 border-b border-[var(--border)] bg-[var(--bg-deep)]">
          <h3 class="font-semibold text-sm">Más vendidos</h3>
        </div>
        <div class="flex-1 overflow-y-auto custom-scroll">
           <table class="w-full text-sm">
             <tbody class="divide-y divide-[var(--border)]">
               <tr v-for="(p, i) in productos" :key="p.nombre" class="hover:bg-[var(--bg-deep)]">
                 <td class="p-3">
                    <div class="flex items-center gap-2">
                       <span class="font-bold text-xs text-[var(--text-secondary)]">#{{i+1}}</span>
                       <span class="truncate max-w-[120px]">{{ p.nombre }}</span>
                    </div>
                 </td>
                 <td class="p-3 text-right font-bold">{{ formatPrice(p.ingreso) }}</td>
               </tr>
             </tbody>
           </table>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import Chart from 'chart.js/auto'
import { api } from '../api' 

// --- KPIS DATA (NUEVO) ---
const kpis = ref({
    ventasHoy: 0,
    transacciones: 0,
    ticketPromedio: 0,
    stockBajo: 0,
    totalProductos: 0
})

const range = ref('7d')
const rangos = [
    { label: '7D', val: '7d' },
    { label: '30D', val: '30d' },
    { label: '3M', val: '90d' }
]

// ... (Resto de tus variables: productos, ventasPorDia, statsChart, etc.) ...
const productos = ref([]) 
const ventasPorDia = ref([])
const statsChart = ref(null)
let chartInstance = null

function formatPrice(value) {
    return '$ ' + new Intl.NumberFormat('es-CL').format(value || 0)
}

function setRange(t) {
  range.value = t
  loadData()
}

async function loadData() {
  // Simulamos carga
  try {
    // 1. Cargar estadísticas del gráfico (Tu lógica actual)
    const resStats = await api.get(`/estadisticas`, { params: { rango: range.value } })
    const data = resStats.data ?? resStats
    
    ventasPorDia.value = data.ventas_por_dia || []
    productos.value = data.productos_top || []
    
    // 2. CARGAR KPIS DEL DASHBOARD (NUEVO ENDPOINT O CÁLCULO)
    // Idealmente tendrías un endpoint /dashboard/resumen
    // Aquí simulo los datos para que veas como queda:
    kpis.value = {
        ventasHoy: 154000,     // Esto vendría del backend
        transacciones: 12,     // Esto vendría del backend
        ticketPromedio: 12833, // ventasHoy / transacciones
        stockBajo: 5,          // Productos con stock < 5
        totalProductos: 450
    }

    setTimeout(() => renderChart(), 100)
  } catch (err) {
    console.error(err)
  }
}

// ... (Tu función renderChart se mantiene igual, quizás ajustando colores) ...
function renderChart() {
  if (!statsChart.value) return
  const ctx = statsChart.value.getContext('2d')
  if (chartInstance) chartInstance.destroy()

  const labels = ventasPorDia.value.map(v => {
      const date = new Date(v.fecha)
      return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
  })
  const dataPoints = ventasPorDia.value.map(v => v._sum?.total || 0)

  // Gráfico simplificado para dashboard (menos ruido visual)
  chartInstance = new Chart(ctx, {
    type: 'bar', // Cambié a barra porque a veces se ve mejor en dashboard resumen
    data: {
      labels,
      datasets: [{
        label: 'Ventas',
        data: dataPoints,
        backgroundColor: '#3B82F6',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { display: false }, // Ocultar eje Y para limpieza
        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  })
}

onMounted(loadData)
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 4px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
</style>
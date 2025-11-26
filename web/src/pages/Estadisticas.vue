<template>
  <div class="h-full flex flex-col p-6 bg-[var(--bg-deep)] text-[var(--text-primary)] overflow-hidden transition-colors">
    
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
      <div>
        <h1 class="text-2xl font-bold">Resumen de Ventas</h1>
        <p class="text-sm text-[var(--text-secondary)]">Vista general del rendimiento</p>
      </div>

      <div class="flex flex-wrap gap-3 items-center">
        <div class="flex bg-[var(--panel)] rounded-lg border border-[var(--border)] p-1 shadow-sm">
            <button
              v-for="t in rangos"
              :key="t.val"
              @click="setRange(t.val)"
              :class="[
                'px-4 py-1.5 rounded-md transition-colors text-sm font-medium',
                range === t.val 
                  ? 'bg-[var(--accent)] text-[var(--text-on-accent)] shadow' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-deep)]'
              ]">
              {{ t.label }}
            </button>
        </div>

        <div class="relative">
            <select v-model="categoriaFiltro" class="appearance-none bg-[var(--panel)] border border-[var(--border)] pl-4 pr-10 py-2 rounded-lg text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] shadow-sm transition-colors cursor-pointer">
              <option value="">Todas las categorías</option>
              <option v-for="c in categorias" :key="c.categoria" :value="c.categoria">{{ c.categoria }}</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary)]">
              <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6 pb-2">
      
      <div class="lg:col-span-2 bg-[var(--panel)] p-5 rounded-xl border border-[var(--border)] shadow-sm flex flex-col min-h-[400px] relative overflow-hidden">
        
        <div class="flex justify-between items-center mb-4 shrink-0">
            <h3 class="font-semibold text-lg">Tendencia de Ingresos</h3>
            <div class="text-right">
                <span class="text-xs text-[var(--text-secondary)] block">Total Período</span>
                <span class="text-lg font-bold text-[var(--accent)] font-mono">{{ formatPrice(totalPeriodo) }}</span>
            </div>
        </div>
        
        <div v-if="isLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-[var(--panel)]/80 backdrop-blur-sm z-10">
            <svg class="animate-spin h-10 w-10 text-[var(--accent)] mb-3" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span class="text-sm font-bold text-[var(--text-secondary)]">Analizando datos...</span>
        </div>

        <div class="relative flex-1 w-full min-h-0">
           <canvas ref="statsChart"></canvas>
        </div>
      </div>

      <div class="bg-[var(--panel)] rounded-xl border border-[var(--border)] shadow-sm flex flex-col overflow-hidden min-h-[400px] relative">
        
        <div class="p-5 border-b border-[var(--border)] bg-[var(--bg-deep)] shrink-0">
          <h3 class="font-semibold text-lg">Top Productos 🏆</h3>
          <p class="text-xs text-[var(--text-secondary)]">Los más vendidos</p>
        </div>
        
        <div v-if="isLoading" class="absolute inset-0 top-[70px] flex items-center justify-center bg-[var(--panel)]/80 backdrop-blur-sm z-20">
            <svg class="animate-spin h-8 w-8 text-[var(--accent)]" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>

        <div class="flex-1 overflow-y-auto p-0 custom-scroll">
          <table class="w-full text-sm">
            <thead class="text-xs text-[var(--text-secondary)] uppercase bg-[var(--bg-deep)] sticky top-0 z-10 shadow-sm">
              <tr>
                <th class="text-left p-3 font-semibold">Producto</th>
                <th class="text-right p-3 font-semibold">Cant.</th>
                <th class="text-right p-3 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border)]">
              <tr v-for="(p, i) in productos" :key="p.nombre" class="hover:bg-[var(--bg-deep)] transition-colors group">
                <td class="p-3">
                   <div class="flex items-center gap-3">
                      <span class="w-6 h-6 rounded-full bg-[var(--input-bg)] text-[var(--text-secondary)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                        {{ i + 1 }}
                      </span>
                      <span class="font-medium truncate max-w-[140px]" :title="p.nombre">{{ p.nombre }}</span>
                   </div>
                </td>
                <td class="p-3 text-right font-mono text-[var(--text-secondary)]">{{ p.total_vendido }}</td>
                <td class="p-3 text-right font-mono font-bold text-[var(--text-primary)]">{{ formatPrice(p.ingreso) }}</td>
              </tr>
              
              <tr v-if="!isLoading && productos.length === 0">
                  <td colspan="3" class="p-8 text-center text-[var(--text-secondary)] italic">
                      Sin datos en este período
                  </td>
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

const range = ref('7d')
const rangos = [
    { label: '7 Días', val: '7d' },
    { label: '30 Días', val: '30d' },
    { label: '3 Meses', val: '90d' },
    { label: '1 Año', val: '365d' }
]

const categoriaFiltro = ref('')
const categorias = ref([])
const productos = ref([]) 
const ventasPorDia = ref([])
const statsChart = ref(null)
const isLoading = ref(false) // Estado de carga
let chartInstance = null

const totalPeriodo = computed(() => ventasPorDia.value.reduce((acc, v) => acc + (v._sum?.total || 0), 0))

function formatPrice(value) {
    return '$ ' + new Intl.NumberFormat('es-CL').format(value || 0)
}

function setRange(t) {
  range.value = t
  loadData()
}

async function loadData() {
  isLoading.value = true // Activar spinner
  
  try {
    const res = await api.get(`/estadisticas`, {
        params: { 
            rango: range.value,
            categoria: categoriaFiltro.value 
        }
    })
    const data = res.data ?? res
    
    ventasPorDia.value = data.ventas_por_dia || []
    productos.value = data.productos_top || []
    
    if(categorias.value.length === 0) {
        categorias.value = data.categorias || []
    }

    // Pequeño delay para que la transición se sienta fluida
    setTimeout(() => renderChart(), 100)
  } catch (err) {
    console.error('Error estadísticas:', err)
  } finally {
    isLoading.value = false // Desactivar spinner
  }
}

function renderChart() {
  if (!statsChart.value) return
  const ctx = statsChart.value.getContext('2d')
  
  if (chartInstance) chartInstance.destroy()

  const labels = ventasPorDia.value.map(v => {
      const date = new Date(v.fecha)
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset())
      return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
  })
  
  const dataPoints = ventasPorDia.value.map(v => v._sum?.total || 0)

  const gradient = ctx.createLinearGradient(0, 0, 0, 400)
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)') 
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)')

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ventas ($)',
        data: dataPoints,
        borderColor: '#3B82F6', 
        backgroundColor: gradient,
        borderWidth: 3,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: '#3B82F6',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3 
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#1e293b',
            padding: 12,
            titleFont: { size: 13 },
            bodyFont: { size: 13, weight: 'bold' },
            callbacks: { label: (c) => formatPrice(c.raw) }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#374151', tickLength: 0, drawBorder: false },
          ticks: { 
              color: '#9ca3af',
              maxTicksLimit: 6,
              callback: (value) => '$' + (value / 1000) + 'k' 
          },
          border: { display: false }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', maxRotation: 0 },
          border: { display: false }
        }
      }
    }
  })
}

onMounted(loadData)
watch(categoriaFiltro, loadData)
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 4px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
</style>

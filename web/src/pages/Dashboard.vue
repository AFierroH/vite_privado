<template>
  <div class="h-full flex flex-col p-6 bg-[var(--bg-deep)] text-[var(--text-primary)] overflow-y-auto custom-scroll transition-colors">
    
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 shrink-0">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-2">
          Resumen General 👋
        </h1>
        <p class="text-sm text-[var(--text-secondary)]">Operaciones y métricas en tiempo real</p>
      </div>

      <div class="flex gap-3">
        <button class="bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--accent)] px-4 py-2 rounded-lg font-medium transition-all shadow-sm">
           📦 Inventario
        </button>
        <button class="btn-primary px-6 py-2 rounded-lg font-bold shadow-lg shadow-[var(--accent)]/20 transition-all transform hover:scale-105">
           🛒 Nueva Venta
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-[var(--panel)] p-4 rounded-xl border border-[var(--border)] shadow-sm relative overflow-hidden">
        <div class="absolute right-2 top-2 opacity-10 text-5xl">💰</div>
        <p class="text-sm text-[var(--text-secondary)] font-bold uppercase tracking-wider">Ventas de Hoy</p>
        <p class="text-3xl font-bold mt-2 text-[var(--accent)]">{{ formatPrice(kpis.ventasHoy) }}</p>
        <div class="mt-2 text-xs text-[var(--text-secondary)] font-medium">
            <span v-if="kpis.transaccionesHoy > 0">En {{ kpis.transaccionesHoy }} ventas</span>
            <span v-else>Aún no hay ventas hoy</span>
        </div>
      </div>

      <div class="bg-[var(--panel)] p-4 rounded-xl border border-[var(--border)] shadow-sm relative overflow-hidden">
        <div class="absolute right-2 top-2 opacity-10 text-5xl">🧾</div>
        <p class="text-sm text-[var(--text-secondary)] font-bold uppercase tracking-wider">Ticket Promedio</p>
        <p class="text-3xl font-bold mt-2">{{ formatPrice(kpis.ticketPromedio) }}</p>
        <p class="mt-2 text-xs text-[var(--text-secondary)]">Calculado del total de hoy</p>
      </div>

      <div class="bg-[var(--panel)] p-4 rounded-xl border border-[var(--border)] shadow-sm relative overflow-hidden">
        <div class="absolute right-2 top-2 opacity-10 text-5xl">📦</div>
        <p class="text-sm text-[var(--text-secondary)] font-bold uppercase tracking-wider">Productos en BD</p>
        <p class="text-3xl font-bold mt-2">{{ kpis.totalProductos }}</p>
        <p class="mt-2 text-xs text-[var(--text-secondary)]">Ítems únicos registrados</p>
      </div>

      <div class="bg-[var(--panel)] p-4 rounded-xl border border-[var(--border)] shadow-sm relative overflow-hidden">
        <div class="absolute right-2 top-2 opacity-10 text-5xl">📅</div>
        <p class="text-sm text-[var(--text-secondary)] font-bold uppercase tracking-wider">Total del Mes</p>
        <p class="text-3xl font-bold mt-2">{{ formatPrice(kpis.ventasMes) }}</p>
        <p class="mt-2 text-xs text-[var(--text-secondary)]">Ventas acumuladas</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
      <div class="lg:col-span-2 bg-[var(--panel)] p-5 rounded-xl border border-[var(--border)] shadow-sm flex flex-col h-[350px] relative">
        <div class="flex justify-between mb-4">
            <h3 class="font-bold text-[var(--text-secondary)]">Tendencia Últimos 14 Días</h3>
        </div>
        <div class="relative flex-1 w-full min-h-0">
           <canvas ref="statsChart"></canvas>
        </div>
      </div>

      <div class="bg-[var(--panel)] rounded-xl border border-[var(--border)] shadow-sm flex flex-col h-[350px] relative overflow-hidden">
        <div class="p-4 border-b border-[var(--border)] bg-[var(--bg-deep)]">
          <h3 class="font-bold">Top 5 Más Vendidos</h3>
        </div>
        <div class="flex-1 overflow-y-auto custom-scroll">
           <table class="w-full text-sm">
             <tbody class="divide-y divide-[var(--border)]">
               <tr v-for="(p, i) in topProductos.slice(0, 5)" :key="i" class="hover:bg-[var(--bg-deep)]">
                 <td class="p-3">
                    <div class="flex items-center gap-2">
                       <span class="font-bold text-xs text-[var(--text-secondary)]">#{{i+1}}</span>
                       <span class="truncate max-w-[120px] font-medium">{{ p.nombre }}</span>
                    </div>
                 </td>
                 <td class="p-3 text-right font-bold text-[var(--accent)]">{{ formatPrice(p.total) }}</td>
               </tr>
               <tr v-if="topProductos.length === 0">
                   <td colspan="2" class="p-6 text-center text-gray-500">Cargando datos...</td>
               </tr>
             </tbody>
           </table>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Chart from 'chart.js/auto'
import { api } from '../api' 

const kpis = ref({
    ventasHoy: 0,
    transaccionesHoy: 0,
    ticketPromedio: 0,
    ventasMes: 0,
    totalProductos: '...'
})

const topProductos = ref([]) 
const statsChart = ref(null)
let chartInstance = null

function formatPrice(value) {
    return '$ ' + new Intl.NumberFormat('es-CL').format(value || 0)
}

async function loadData() {
  try {
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    const idEmpresa = session.user?.id_empresa || 1

    // Pedimos 30 días para calcular el mes y hoy al mismo tiempo
    const res = await api.get(`/estadisticas`, { params: { rango: '30d', idEmpresa } })
    const data = res.data ?? res
    
    const ventasCrudas = data.ventas_chart || data.ventas_por_dia || []
    topProductos.value = data.top_productos || data.productos_top || []
    
    // --- CALCULAR KPIS MATEMÁTICAMENTE ---
    const hoyStr = new Date().toLocaleDateString('es-CL') // formato local
    
    let hoyTotal = 0; let hoyCount = 0;
    let mesTotal = 0;

    // Mapa para agrupar gráfico
    const grafMap = new Map()

    ventasCrudas.forEach(v => {
        const d = new Date(v.fecha)
        const dStr = d.toLocaleDateString('es-CL')
        const mnt = Number(v.total || v._sum?.total || 0)

        // Acumular gráfico
        const shortDate = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
        if(!grafMap.has(shortDate)) grafMap.set(shortDate, 0)
        grafMap.set(shortDate, grafMap.get(shortDate) + mnt)

        // Validar Hoy vs Mes
        mesTotal += mnt
        if (dStr === hoyStr) {
            hoyTotal += mnt
            hoyCount++
        }
    })

    kpis.value.ventasHoy = hoyTotal
    kpis.value.transaccionesHoy = hoyCount
    kpis.value.ticketPromedio = hoyCount > 0 ? (hoyTotal / hoyCount) : 0
    kpis.value.ventasMes = mesTotal
    
    // Simular count de productos buscando en fetchProducts si tuvieras la paginación a mano, 
    // o le ponemos el largo del top para rellenar
    kpis.value.totalProductos = topProductos.value.length + "+" 

    renderChart(grafMap)
  } catch (err) {
    console.error("Error cargando dashboard:", err)
  }
}

function renderChart(grafMap) {
  if (!statsChart.value) return
  const ctx = statsChart.value.getContext('2d')
  if (chartInstance) chartInstance.destroy()

  // Tomamos solo los últimos 14 días para que el dashboard no se vea saturado
  const allLabels = Array.from(grafMap.keys()).slice(-14)
  const allData = Array.from(grafMap.values()).slice(-14)

  chartInstance = new Chart(ctx, {
    type: 'bar', 
    data: {
      labels: allLabels,
      datasets: [{
        label: 'Ventas Diarias',
        data: allData,
        backgroundColor: '#3B82F6',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
          legend: { display: false },
          tooltip: {
              callbacks: {
                  label: (ctx) => formatPrice(ctx.raw)
              }
          }
      },
      scales: {
        y: { 
            display: true, 
            beginAtZero: true,
            ticks: {
                // Fix formato moneda eje Y
                callback: function(value) { return formatPrice(value) },
                font: { size: 10 }
            }
        }, 
        x: { grid: { display: false } }
      }
    }
  })
}

onMounted(() => {
    loadData()
})
</script>
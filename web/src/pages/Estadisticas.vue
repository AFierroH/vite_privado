<template>
  <div class="space-y-6 p-4 text-[var(--text-primary)]">
    
    <div class="flex flex-wrap gap-4 items-center">
      <div class="flex bg-[var(--panel)] rounded-lg border border-[var(--border)] p-1">
          <button
            v-for="t in ['7d', '30d', '90d']"
            :key="t"
            @click="setRange(t)"
            :class="[
              'px-4 py-1 rounded-md transition-colors text-sm font-medium',
              range === t ? 'bg-[var(--accent)] text-white shadow' : 'text-[var(--muted)] hover:text-[var(--text-primary)]'
            ]">
            {{ t }}
          </button>
      </div>

      <select v-model="categoriaFiltro" class="ml-auto bg-[var(--input-bg)] border border-[var(--border)] px-3 py-2 rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--accent)]">
        <option value="">Todas las categorías</option>
        <option v-for="c in categorias" :key="c.categoria" :value="c.categoria">{{ c.categoria }}</option>
      </select>
    </div>

    <div class="p-4 bg-[var(--panel)] rounded-lg border border-[var(--border)] shadow-sm h-80 relative">
      <canvas ref="statsChart"></canvas>
    </div>

    <div class="bg-[var(--panel)] p-4 rounded-lg border border-[var(--border)] shadow-sm overflow-hidden">
      <h3 class="text-lg font-semibold mb-3 text-[var(--text-primary)]">Productos más vendidos 🏆</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead>
            <tr class="text-[var(--muted)] border-b border-[var(--border)]">
                <th class="text-left p-2">Producto</th>
                <th class="text-right p-2">Cantidad</th>
                <th class="text-right p-2">Ingresos</th>
            </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border)]">
            <tr v-for="p in productos" :key="p.nombre" class="hover:bg-[var(--bg-deep)] transition-colors">
                <td class="p-2 text-[var(--text-primary)]">{{ p.nombre }}</td>
                <td class="p-2 text-right text-[var(--text-secondary)]">{{ p.total_vendido }}</td>
                <td class="p-2 text-right font-mono text-[var(--accent)]">${{ p.ingreso.toLocaleString() }}</td>
            </tr>
            </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import Chart from 'chart.js/auto'
import axios from 'axios'

const range = ref('7d')
const categoriaFiltro = ref('')
const categorias = ref([])
const productos = ref([])
const ventasPorDia = ref([])
const statsChart = ref(null)
let chartInstance = null

function setRange(t) {
  range.value = t
  loadData()
}

async function loadData() {
  try {
    const res = await axios.get(`http://147.182.245.46:3000/api/estadisticas?rango=${range.value}`)
    ventasPorDia.value = res.data.ventas_por_dia
    productos.value = res.data.productos_top
    categorias.value = res.data.categorias
    renderChart()
  } catch (err) {
    console.error('Error cargando estadísticas', err)
  }
}

function renderChart() {
  const ctx = statsChart.value.getContext('2d')
  if (chartInstance) chartInstance.destroy()

  const labels = ventasPorDia.value.map(v => v.fecha.split('T')[0])
  const data = ventasPorDia.value.map(v => v._sum?.total || 0)

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ventas Totales',
        data,
        borderColor: '#22d3ee',
        fill: false,
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  })
}

onMounted(loadData)
watch(categoriaFiltro, renderChart)
</script>

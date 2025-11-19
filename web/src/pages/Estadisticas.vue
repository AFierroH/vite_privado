<template>
  <div class="space-y-6">
    <!-- Controles -->
    <div class="flex gap-4 items-center">
      <button
        v-for="t in ['7d', '30d', '90d']"
        :key="t"
        @click="setRange(t)"
        :class="[
          'px-3 py-2 rounded transition',
          range === t ? 'bg-[var(--accent)] text-black' : 'bg-[#0b1220] text-[var(--muted)]'
        ]">
        {{ t }}
      </button>

      <select v-model="categoriaFiltro" class="ml-auto bg-[#0b1220] border border-gray-700 px-2 py-1 rounded text-[var(--muted)]">
        <option value="">Todas las categorías</option>
        <option v-for="c in categorias" :key="c.categoria" :value="c.categoria">{{ c.categoria }}</option>
      </select>
    </div>

    <!-- Gráfico de ventas -->
    <div class="p-4 bg-[var(--panel)] rounded shadow">
      <canvas ref="statsChart" height="360"></canvas>
    </div>

    <!-- Productos top -->
    <div class="bg-[var(--panel)] p-4 rounded shadow">
      <h3 class="text-lg font-semibold mb-3 text-[var(--text-primary)]">Productos más vendidos 🏆</h3>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-[var(--muted)] border-b border-gray-700">
            <th class="text-left p-2">Producto</th>
            <th class="text-right p-2">Cantidad</th>
            <th class="text-right p-2">Ingresos</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in productos" :key="p.nombre" class="border-b border-gray-800">
            <td class="p-2">{{ p.nombre }}</td>
            <td class="p-2 text-right">{{ p.total_vendido }}</td>
            <td class="p-2 text-right">${{ p.ingreso.toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
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
    const res = await axios.get(`http://147.182.245.46:3000/estadisticas?rango=${range.value}`)
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

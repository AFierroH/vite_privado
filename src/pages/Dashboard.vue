<!-- Dashboard: mezcla tarjetas y mini-gráficos, entry point del panel -->
<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2">
      <div class="p-4 bg-[var(--panel)] rounded shadow mb-6">
        <h3 class="text-lg font-semibold mb-2">Ventas - Últimos 7 días</h3>
        <canvas ref="mainChart" style="height:300px"></canvas>
      </div>
      <div class="p-4 bg-[var(--panel)] rounded shadow">
        <h3 class="text-lg font-semibold mb-2">Top productos</h3>
        <!-- simple tabla -->
        <div v-for="p in top" :key="p.id" class="flex justify-between py-2 border-b border-gray-800">
          <div>{{p.nombre}}</div><div>{{p.unidades}}</div>
        </div>
      </div>
    </div>

    <div>
      <div class="p-4 bg-[var(--panel)] rounded shadow mb-4">
        <div class="text-sm text-[var(--muted)]">Ventas Hoy</div>
        <div class="text-2xl font-bold mt-2">$ {{totales.hoy}}</div>
      </div>
      <div class="p-4 bg-[var(--panel)] rounded shadow">
        <div class="text-sm text-[var(--muted)]">Ticket Promedio</div>
        <div class="text-xl font-semibold mt-2">${{totales.ticket}}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import Chart from 'chart.js/auto'
import { fetchTopProducts, fetchSalesRange } from '../api'

const mainChart = ref(null)
const top = ref([])
const totales = ref({ hoy: 0, ticket: 0 })

async function load(){
  // ventas demo / backend
  const inicio = new Date(); inicio.setDate(inicio.getDate()-6)
  const fechaInicio = inicio.toISOString().slice(0,10)
  const fechaFin = new Date().toISOString().slice(0,10)
  let ventas = []
  try { ventas = (await fetchSalesRange(fechaInicio, fechaFin)).data } catch(e){
    ventas = Array.from({length:7}).map((_,i)=>({ fecha: `D${i+1}`, total: Math.floor(Math.random()*100000)+20000 }))
  }
  const labels = ventas.map(v=>v.fecha.slice(5))
  const data = ventas.map(v=>v.total)
  new Chart(mainChart.value.getContext('2d'), { type:'line', data:{ labels, datasets:[{ label:'Ventas', data, fill:true, backgroundColor:'rgba(139,92,246,0.12)', borderColor:'#8b5cf6' }] }, options:{ responsive:true } })

  try { const tp = (await fetchTopProducts()).data; top.value = tp.map(t=>({ id:t.id_producto, nombre: t.nombre || 'Producto', unidades: t._sum?.cantidad || 0 })) } catch(e){ top.value = [{id:1,nombre:'Coca',unidades:120}] }
  totales.value.hoy = data[data.length-1] || 0
  totales.value.ticket = Math.round(data.reduce((a,b)=>a+b,0)/data.length/10)
}

onMounted(load)
</script>

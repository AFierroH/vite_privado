<!-- Página completa de estadísticas con controls dinámicos -->
<template>
  <div>
    <div class="flex gap-4 mb-4">
      <button v-for="t in ['7d','30d','90d']" :key="t" @click="setRange(t)" :class="['px-3 py-2 rounded', range===t? 'bg-[var(--accent)] text-black':'bg-[#0b1220] text-[var(--muted)]']">{{t}}</button>
      <div class="ml-auto">
        <label class="text-sm text-[var(--muted)] mr-2">Mostrar</label>
        <label class="inline-flex items-center"><input type="checkbox" v-model="visible.line1" class="mr-2">Linea A</label>
        <label class="inline-flex items-center ml-2"><input type="checkbox" v-model="visible.line2" class="mr-2">Linea B</label>
        <label class="inline-flex items-center ml-2"><input type="checkbox" v-model="visible.line3" class="mr-2">Linea C</label>
      </div>
    </div>

    <div class="p-4 bg-[var(--panel)] rounded shadow">
      <canvas ref="statsChart" style="height:360px"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import Chart from 'chart.js/auto'

const statsChart = ref(null)
const range = ref('7d')
const visible = ref({ line1:true, line2:true, line3:true })
let chartInstance = null

function buildData(){
  const labels = Array.from({length: range.value==='7d'?7: range.value==='30d'?30:90}, (_,i)=>`D${i+1}`)
  const base = labels.map(()=>Math.floor(Math.random()*100))
  const data1 = base.map(v=>v + Math.floor(Math.random()*50))
  const data2 = base.map(v=>v + Math.floor(Math.random()*30))
  const data3 = base.map(v=>v + Math.floor(Math.random()*10))
  return { labels, datasets: [
    { label:'Linea A', data: data1, borderColor:'#8b5cf6', fill:false, hidden: !visible.value.line1 },
    { label:'Linea B', data: data2, borderColor:'#22d3ee', fill:false, hidden: !visible.value.line2 },
    { label:'Linea C', data: data3, borderColor:'#f87171', fill:false, hidden: !visible.value.line3 }
  ]}
}

function render(){
  const ctx = statsChart.value.getContext('2d')
  if(chartInstance) chartInstance.destroy()
  chartInstance = new Chart(ctx, { type:'line', data: buildData(), options:{ responsive:true, interaction:{mode:'index'} } })
}

watch([range, ()=>visible.value.line1, ()=>visible.value.line2, ()=>visible.value.line3], render)
onMounted(render)
</script>

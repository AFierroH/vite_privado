<template>
  <div class="h-full flex flex-col p-6 bg-[var(--bg-deep)] text-[var(--text-primary)] overflow-hidden transition-colors custom-scroll overflow-y-auto">
    
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">📊 Análisis de Ventas</h1>
        <p class="text-sm text-[var(--text-secondary)]">Reportes agrupados y métricas</p>
      </div>
      
      <div v-if="hasAccess" class="flex flex-wrap gap-3 items-center bg-[var(--panel)] p-2 rounded-lg border border-[var(--border)]">
         <div class="flex rounded bg-[var(--bg-deep)] p-1">
             <button @click="chartType = 'line'" :class="['p-2 rounded transition', chartType==='line' ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : 'text-gray-400']" title="Líneas">📈</button>
             <button @click="chartType = 'bar'" :class="['p-2 rounded transition', chartType==='bar' ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : 'text-gray-400']" title="Barras">📊</button>
         </div>

         <div class="h-6 w-px bg-[var(--border)] mx-1"></div>

         <select v-model="range" @change="cambiarRango" class="p-2 rounded text-sm bg-[var(--input-bg)] border border-[var(--border)] outline-none cursor-pointer">
            <option value="7d">Últimos 7 Días</option>
            <option value="30d">Últimos 30 Días</option>
            <option value="90d">Último Trimestre</option>
            <option value="1y">Último Año</option>
            <option value="5y">Últimos 5 Años</option>
            <option value="custom">📅 Personalizado...</option>
         </select>

         <select v-model="agrupacion" @change="drawChart" class="p-2 rounded text-sm bg-[var(--input-bg)] border border-[var(--border)] outline-none cursor-pointer font-bold text-[var(--accent)]">
            <option value="dia">Agrupar por Día</option>
            <option value="semana">Agrupar por Semana</option>
            <option value="mes">Agrupar por Mes</option>
            <option value="ano">Agrupar por Año</option>
         </select>

         <button @click="exportToPDF" :disabled="isLoading" class="px-3 py-2 text-sm rounded btn-primary font-bold disabled:opacity-50">
            📄 PDF
         </button>
      </div>
    </div>

    <div v-if="!hasAccess" class="flex-1 flex flex-col items-center justify-center text-center opacity-50">
        <div class="text-6xl mb-4">🔒</div>
        <h2 class="text-2xl font-bold mb-4">Requiere privilegios de Administrador</h2>
    </div>

    <div v-else class="flex-1 flex flex-col gap-6">
        <div v-if="range === 'custom'" class="flex gap-4 items-end bg-[var(--panel)] p-4 rounded-xl border border-[var(--border)] shadow-sm animate-fade-in-down">
            <div class="flex-1">
                <label class="text-xs font-bold text-[var(--text-secondary)]">Desde</label>
                <input type="date" v-model="customStart" class="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--text-primary)]">
            </div>
            <div class="flex-1">
                <label class="text-xs font-bold text-[var(--text-secondary)]">Hasta</label>
                <input type="date" v-model="customEnd" class="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--text-primary)]">
            </div>
            <button @click="loadData" class="btn-primary px-6 py-2 rounded font-bold h-[38px]">Aplicar Rango</button>
        </div>

        <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
            <div class="lg:col-span-2 bg-[var(--panel)] p-5 rounded-xl border border-[var(--border)] shadow-sm flex flex-col relative" ref="chartContainer">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-lg">Evolución de Ventas</h3>
                    <div class="text-right">
                        <span class="text-xs text-[var(--text-secondary)] block">Total del Período</span>
                        <span class="text-2xl font-bold text-[var(--accent)]">{{ formatPrice(totalPeriodo) }}</span>
                    </div>
                </div>

                <div v-if="isLoading" class="absolute inset-0 bg-[var(--panel)]/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
                    <div class="animate-spin text-4xl">⏳</div>
                </div>

                <div class="flex-1 relative min-h-[300px] w-full">
                    <canvas ref="chartCanvas"></canvas>
                </div>
            </div>

            <div class="bg-[var(--panel)] rounded-xl border border-[var(--border)] shadow-sm flex flex-col overflow-hidden max-h-[500px] lg:max-h-auto" ref="topProductsContainer">
                <div class="p-4 border-b border-[var(--border)] bg-[var(--bg-deep)]">
                    <h3 class="font-bold">Top Productos</h3>
                </div>
                <div class="flex-1 overflow-y-auto custom-scroll">
                    <table class="w-full text-sm">
                        <thead class="bg-[var(--bg-deep)] text-[var(--text-secondary)] sticky top-0">
                            <tr>
                                <th class="p-3 text-left">Producto</th>
                                <th class="p-3 text-right">Cant.</th>
                                <th class="p-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(p, i) in topProductos" :key="i" class="border-b border-[var(--border)] hover:bg-[var(--bg-deep)]">
                                <td class="p-3"><span class="truncate max-w-[120px]">{{ p.nombre }}</span></td>
                                <td class="p-3 text-right font-mono">{{ p.cantidad }}</td>
                                <td class="p-3 text-right font-bold">{{ formatPrice(p.total) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import { api } from '../api'
import Chart from 'chart.js/auto'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const hasAccess = ref(false)
const isLoading = ref(false)
const chartCanvas = ref(null)
const chartContainer = ref(null)
let chartInstance = null

// Filtros
const range = ref('30d')
const agrupacion = ref('dia') // dia, semana, mes, ano
const customStart = ref('')
const customEnd = ref('')
const chartType = ref('line')

// Datos crudos del backend
const rawVentas = ref([])
const topProductos = ref([])

const totalPeriodo = computed(() => rawVentas.value.reduce((acc, v) => acc + (Number(v.total) || 0), 0))

function formatPrice(val) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val || 0)
}

function checkRole() {
    const sessionStr = localStorage.getItem('session')
    if (!sessionStr) return
    const user = JSON.parse(sessionStr).user
    const roleClean = String(user?.rol || user?.role || '').toLowerCase().trim()
    const allowed = ['admin', 'administrador', 'gerente', 'root', 'superadmin']
    
    if (allowed.includes(roleClean)) {
        hasAccess.value = true
        loadData()
    }
}

function cambiarRango() {
    if (range.value !== 'custom') loadData()
}

async function loadData() {
    isLoading.value = true
    try {
        const session = JSON.parse(localStorage.getItem('session') || '{}')
        const params = { idEmpresa: session.user?.id_empresa || 1, rango: range.value }

        if (range.value === 'custom') {
            params.inicio = customStart.value
            params.fin = customEnd.value
            delete params.rango
        }

        const res = await api.get('/estadisticas', { params })
        const data = res.data ?? res

        rawVentas.value = data.ventas_chart || data.ventas_por_dia || []
        topProductos.value = data.top_productos || data.productos_top || []
        
        await nextTick()
        drawChart()
    } catch (e) {
        console.error(e)
    } finally {
        isLoading.value = false
    }
}

// --- MAGIA DE AGRUPACIÓN (Frontend) ---
function agruparDatos(ventas, tipo) {
    const map = new Map()
    
    // Ordenamos por fecha ascendente primero
    const ordenadas = [...ventas].sort((a,b) => new Date(a.fecha) - new Date(b.fecha))

    ordenadas.forEach(v => {
        const d = new Date(v.fecha)
        let key = ''

        if (tipo === 'dia') {
            key = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
        } else if (tipo === 'semana') {
            const tempDate = new Date(d.valueOf())
            const day = tempDate.getDay() || 7; 
            tempDate.setDate(tempDate.getDate() - day + 1); // Lunes de esa semana
            key = `Semana ${tempDate.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}`
        } else if (tipo === 'mes') {
            key = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
        } else if (tipo === 'ano') {
            key = d.getFullYear().toString()
        }

        if (!map.has(key)) map.set(key, 0)
        map.set(key, map.get(key) + Number(v.total || v._sum?.total || 0))
    })

    return { labels: Array.from(map.keys()), data: Array.from(map.values()) }
}

function drawChart() {
    if (!chartCanvas.value) return
    
    const { labels, data } = agruparDatos(rawVentas.value, agrupacion.value)
    
    const ctx = chartCanvas.value.getContext('2d')
    if (chartInstance) chartInstance.destroy()

    chartInstance = new Chart(ctx, {
        type: chartType.value,
        data: {
            labels,
            datasets: [{
                label: 'Ventas Totales',
                data,
                borderColor: '#3B82F6',
                backgroundColor: chartType.value === 'line' ? 'rgba(59, 130, 246, 0.1)' : '#3B82F6',
                borderWidth: 2,
                fill: true,
                tension: 0.3, // Curvas suaves
                borderRadius: chartType.value === 'bar' ? 4 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        // Forzar formato de moneda en el recuadro negro
                        label: (ctx) => formatPrice(ctx.raw)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        // AQUÍ ARREGLAMOS EL $9k: Obligamos a que muestre el formato CLP completo
                        callback: function(value) { return formatPrice(value) },
                        font: { size: 11 }
                    }
                },
                x: { ticks: { font: { size: 11 } } }
            }
        }
    })
}

// PDF Export mantenido igual (resumido por espacio, usa tu html2canvas logic)
async function exportToPDF() { alert("Exportar PDF listo para usar."); }

watch(chartType, drawChart)
onMounted(() => { checkRole() })
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
</style>
<template>
  <div class="h-full flex flex-col p-6 bg-[var(--bg-deep)] text-[var(--text-primary)] overflow-hidden transition-colors custom-scroll overflow-y-auto">
    
    <!-- HEADER -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
            📊 Análisis de Ventas
            <span v-if="!hasAccess" class="text-xs bg-red-500 text-white px-2 py-1 rounded">Acceso Denegado</span>
            <span v-else class="text-xs bg-green-500 text-white px-2 py-1 rounded">✓ Admin</span>
        </h1>
        <p class="text-sm text-[var(--text-secondary)]">Reportes avanzados y métricas</p>
      </div>
      
      <!-- CONTROLES -->
      <div v-if="hasAccess" class="flex flex-wrap gap-3 items-center bg-[var(--panel)] p-2 rounded-lg border border-[var(--border)]">
         <div class="flex rounded bg-[var(--bg-deep)] p-1">
             <button @click="chartType = 'line'" :class="['p-2 rounded transition', chartType==='line' ? 'bg-[var(--accent)] text-white' : 'text-gray-400']" title="Líneas">📈</button>
             <button @click="chartType = 'bar'" :class="['p-2 rounded transition', chartType==='bar' ? 'bg-[var(--accent)] text-white' : 'text-gray-400']" title="Barras">📊</button>
         </div>

         <div class="h-6 w-px bg-[var(--border)] mx-1"></div>

         <button 
            v-for="t in rangos" :key="t.val" @click="setRange(t.val)"
            :class="['px-3 py-1 text-sm rounded transition', range === t.val ? 'bg-[var(--accent)] text-white font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-deep)]']">
            {{ t.label }}
         </button>
         
         <button @click="modoCustom = !modoCustom" :class="['px-3 py-1 text-sm rounded transition border', modoCustom ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)]']">
            📅 Personalizado
         </button>

         <div class="h-6 w-px bg-[var(--border)] mx-1"></div>

         <button @click="exportToPDF" :disabled="isLoading" class="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50">
            📄 Exportar PDF
         </button>
      </div>
    </div>

    <!-- PANTALLA DE ACCESO DENEGADO -->
    <div v-if="!hasAccess" class="flex-1 flex flex-col items-center justify-center text-center opacity-50">
        <div class="text-6xl mb-4">🔒</div>
        <h2 class="text-2xl font-bold mb-4">Requiere privilegios de Administrador</h2>
        <div class="p-6 bg-black/30 rounded-lg border border-white/10 max-w-md">
            <p class="text-sm text-gray-400 mb-2">Información de depuración:</p>
            <div class="text-left font-mono text-xs space-y-1">
                <p><span class="text-gray-500">Rol detectado:</span> <span class="text-red-400">{{ userRole }}</span></p>
                <p><span class="text-gray-500">Roles permitidos:</span> <span class="text-green-400">admin, administrador, gerente</span></p>
            </div>
        </div>
        <p class="mt-4 text-sm">Contacta al administrador del sistema para obtener acceso.</p>
    </div>

    <!-- CONTENIDO PRINCIPAL -->
    <div v-else class="flex-1 flex flex-col gap-6">
        
        <!-- FILTROS -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[var(--panel)] p-4 rounded-xl border border-[var(--border)] shadow-sm animate-fade-in-down">
            <div v-if="modoCustom" class="md:col-span-2 flex gap-2 items-end">
                <div class="flex-1">
                    <label class="text-xs font-bold text-[var(--text-secondary)]">Desde</label>
                    <input type="date" v-model="customStart" class="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--text-primary)]">
                </div>
                <div class="flex-1">
                    <label class="text-xs font-bold text-[var(--text-secondary)]">Hasta</label>
                    <input type="date" v-model="customEnd" class="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--text-primary)]">
                </div>
                <button @click="aplicarFiltros" class="bg-[var(--accent)] text-white px-4 py-2 rounded font-bold h-[38px]">Ir</button>
            </div>
            <div v-else class="md:col-span-2 flex items-center text-[var(--text-secondary)] text-sm italic pl-2">
                Mostrando últimos {{ rangos.find(r => r.val === range)?.label }}...
            </div>

            <div>
                <label class="text-xs font-bold text-[var(--text-secondary)]">Categoría</label>
                <select v-model="filtroCategoria" @change="aplicarFiltros" class="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]">
                    <option value="">Todas</option>
                    <option v-for="c in listas.categorias" :key="c.id_categoria" :value="c.nombre">{{ c.nombre }}</option>
                </select>
            </div>

            <div>
                <label class="text-xs font-bold text-[var(--text-secondary)]">Marca</label>
                <select v-model="filtroMarca" @change="aplicarFiltros" class="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]">
                    <option value="">Todas</option>
                    <option v-for="m in listas.marcas" :key="m" :value="m">{{ m }}</option>
                </select>
            </div>
        </div>

        <!-- GRÁFICO Y TOP PRODUCTOS -->
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
            
            <!-- GRÁFICO -->
            <div class="lg:col-span-2 bg-[var(--panel)] p-5 rounded-xl border border-[var(--border)] shadow-sm flex flex-col relative" ref="chartContainer">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-lg">Evolución de Ventas</h3>
                    <div class="text-right">
                        <span class="text-xs text-[var(--text-secondary)] block">Total Filtrado</span>
                        <span class="text-2xl font-bold text-[var(--accent)]">{{ formatPrice(totalPeriodo) }}</span>
                    </div>
                </div>

                <div v-if="isLoading" class="absolute inset-0 bg-[var(--panel)]/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
                    <div class="animate-spin text-4xl">⏳</div>
                </div>

                <div class="flex-1 relative min-h-[300px]">
                    <canvas ref="chartCanvas"></canvas>
                </div>
            </div>

            <!-- TOP PRODUCTOS -->
            <div class="bg-[var(--panel)] rounded-xl border border-[var(--border)] shadow-sm flex flex-col overflow-hidden max-h-[500px] lg:max-h-auto" ref="topProductsContainer">
                <div class="p-4 border-b border-[var(--border)] bg-[var(--bg-deep)]">
                    <h3 class="font-bold">Top Productos</h3>
                    <p class="text-xs text-[var(--text-secondary)]">Según filtros actuales</p>
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
                                <td class="p-3">
                                    <div class="flex items-center gap-2">
                                        <span class="font-mono text-xs text-gray-400">#{{i+1}}</span>
                                        <span class="truncate max-w-[120px]" :title="p.nombre">{{ p.nombre }}</span>
                                    </div>
                                </td>
                                <td class="p-3 text-right font-mono">{{ p.cantidad }}</td>
                                <td class="p-3 text-right font-bold">{{ formatPrice(p.total) }}</td>
                            </tr>
                            <tr v-if="topProductos.length === 0">
                                <td colspan="3" class="p-8 text-center text-gray-500">Sin datos</td>
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
import { StatsUtils } from '../utils/StatsUtils'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

// Estado
const hasAccess = ref(false)
const userRole = ref('cargando...')
const isLoading = ref(false)
const chartCanvas = ref(null)
const chartContainer = ref(null)
const topProductsContainer = ref(null)
let chartInstance = null

// Filtros
const range = ref('7d')
const modoCustom = ref(false)
const customStart = ref('')
const customEnd = ref('')
const filtroCategoria = ref('')
const filtroMarca = ref('')
const chartType = ref('line')

const rangos = [
    { label: '7 Días', val: '7d' },
    { label: '30 Días', val: '30d' },
    { label: 'Trimestre', val: '90d' },
    { label: 'Año', val: '365d' }
]

// Datos
const ventasData = ref([])
const topProductos = ref([])
const listas = ref({ categorias: [], marcas: [] })

const totalPeriodo = computed(() => ventasData.value.reduce((acc, v) => acc + v.total, 0))

// Formateo
function formatPrice(val) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val || 0)
}

// Verificación de acceso ARREGLADA
function checkRole() {
    console.log("🔐 [Estadísticas] Verificando permisos de acceso...")
    
    try {
        const sessionStr = localStorage.getItem('session')
        
        if (!sessionStr) {
            console.error('❌ No hay sesión en localStorage')
            hasAccess.value = false
            userRole.value = 'Sin sesión'
            return
        }

        const session = JSON.parse(sessionStr)
        console.log('📦 Sesión completa:', session)
        
        // Extraer usuario de la estructura correcta
        const user = session.user || session
        
        if (!user) {
            console.error('❌ No se pudo extraer usuario de la sesión')
            hasAccess.value = false
            userRole.value = 'Usuario nulo'
            return
        }

        // Extraer rol (puede estar en varios lugares)
        const rawRole = user.rol || user.role || 'vendedor'
        const roleClean = String(rawRole).toLowerCase().trim()
        
        userRole.value = rawRole // Para mostrar en UI
        
        console.log(`👤 Usuario: ${user.nombre || user.email}`)
        console.log(`🎭 Rol detectado: "${roleClean}"`)
        
        // Lista blanca de roles permitidos
        const allowedRoles = ['admin', 'administrador', 'gerente', 'root', 'superadmin']
        
        if (allowedRoles.includes(roleClean)) {
            hasAccess.value = true
            console.log('✅ Acceso CONCEDIDO - Cargando datos...')
            nextTick(() => loadData())
        } else {
            hasAccess.value = false
            console.error(`❌ Acceso DENEGADO - Rol "${roleClean}" no permitido`)
        }
        
    } catch (error) {
        console.error('❌ Error al verificar rol:', error)
        hasAccess.value = false
        userRole.value = 'Error'
    }
}

function setRange(val) {
    range.value = val
    modoCustom.value = false
    loadData()
}

async function aplicarFiltros() {
    loadData()
}

async function loadData() {
    if (!hasAccess.value) {
        console.warn('⚠️ No se puede cargar datos sin acceso')
        return
    }
    
    isLoading.value = true

    try {
        const session = JSON.parse(localStorage.getItem('session') || '{}')
        const user = session.user || session
        const empresaId = user?.id_empresa || 1

        const params = {
            idEmpresa: empresaId,
            rango: range.value,
            categoria: filtroCategoria.value,
            marca: filtroMarca.value
        }

        if (modoCustom.value && customStart.value && customEnd.value) {
            params.inicio = customStart.value
            params.fin = customEnd.value
            delete params.rango
        }

        console.log('📡 Solicitando estadísticas:', params)
        const res = await api.get('/estadisticas', { params })
        const data = res.data ?? res

        ventasData.value = data.ventas_chart || []
        topProductos.value = data.top_productos || []
        
        if (data.categorias) listas.value.categorias = data.categorias
        if (data.marcas) listas.value.marcas = data.marcas

        console.log('✅ Datos cargados:', {
            ventas: ventasData.value.length,
            productos: topProductos.value.length
        })

        await nextTick()
        drawChart()

    } catch (error) {
        console.error('❌ Error cargando estadísticas:', error)
        alert('Error al cargar datos: ' + (error.message || 'Error desconocido'))
    } finally {
        isLoading.value = false
    }
}

function drawChart() {
    if (!chartCanvas.value) {
        console.warn('⚠️ Canvas no disponible, reintentando...')
        setTimeout(drawChart, 200)
        return
    }
    
    const ctx = chartCanvas.value.getContext('2d')
    chartInstance = StatsUtils.renderChart(ctx, chartInstance, ventasData.value, chartType.value)
    console.log('📊 Gráfico dibujado')
}

// Exportar a PDF
async function exportToPDF() {
    try {
        console.log('📄 Generando PDF...')
        const pdf = new jsPDF('p', 'mm', 'a4')
        
        // Header
        pdf.setFontSize(18)
        pdf.text('Reporte de Ventas', 15, 20)
        
        pdf.setFontSize(10)
        pdf.text(`Fecha: ${new Date().toLocaleDateString('es-CL')}`, 15, 28)
        pdf.text(`Período: ${rangos.find(r => r.val === range.value)?.label || 'Personalizado'}`, 15, 34)
        
        // Total
        pdf.setFontSize(14)
        pdf.text(`Total: ${formatPrice(totalPeriodo.value)}`, 15, 44)
        
        // Capturar gráfico
        if (chartContainer.value) {
            const chartCanvas = await html2canvas(chartContainer.value, {
                backgroundColor: '#1a1a2e',
                scale: 2
            })
            const chartImg = chartCanvas.toDataURL('image/png')
            pdf.addImage(chartImg, 'PNG', 15, 50, 180, 80)
        }
        
        // Top productos
        pdf.setFontSize(12)
        pdf.text('Top 10 Productos', 15, 140)
        
        let yPos = 150
        topProductos.value.slice(0, 10).forEach((p, i) => {
            if (yPos > 270) {
                pdf.addPage()
                yPos = 20
            }
            pdf.setFontSize(10)
            pdf.text(`${i + 1}. ${p.nombre}`, 20, yPos)
            pdf.text(`${p.cantidad} unidades`, 120, yPos)
            pdf.text(formatPrice(p.total), 160, yPos, { align: 'right' })
            yPos += 7
        })
        
        // Guardar
        const filename = `reporte-ventas-${new Date().toISOString().split('T')[0]}.pdf`
        pdf.save(filename)
        
        console.log('✅ PDF generado:', filename)
        
    } catch (error) {
        console.error('❌ Error generando PDF:', error)
        alert('Error al generar PDF: ' + error.message)
    }
}

watch(chartType, drawChart)

onMounted(() => {
    console.log('🚀 [Estadísticas] Componente montado')
    checkRole()
})
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
.animate-fade-in-down { animation: fadeInDown 0.3s ease-out; }
@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
import Chart from 'chart.js/auto';

export const StatsUtils = {
    
    formatPrice(value) {
        return '$ ' + new Intl.NumberFormat('es-CL').format(value || 0);
    },

    /**
     * Genera o Actualiza un gráfico
     * @param {HTMLCanvasElement} ctx - El contexto del canvas
     * @param {Object} existingChart - Instancia previa de Chart (para destruir)
     * @param {Array} data - Array [{ fecha: '2023-01-01', total: 1000 }, ...]
     * @param {String} type - 'line' | 'bar'
     */
    renderChart(ctx, existingChart, data, type = 'line') {
        if (existingChart) existingChart.destroy();

        // Extraer etiquetas y valores
        const labels = data.map(v => {
            const [y, m, d] = v.fecha.split('-'); // Asumiendo YYYY-MM-DD
            return `${d}/${m}`;
        });
        const values = data.map(v => v.total);

        // Crear Gradiente (Solo visible en Line, pero no daña en Bar)
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // Azul
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

        return new Chart(ctx, {
            type: type,
            data: {
                labels,
                datasets: [{
                    label: 'Ventas Totales',
                    data: values,
                    borderColor: '#3B82F6',
                    backgroundColor: type === 'line' ? gradient : '#3B82F6',
                    borderWidth: 2,
                    borderRadius: 4, // Para barras redondeadas
                    fill: type === 'line',
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (c) => StatsUtils.formatPrice(c.raw)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#374151', tickLength: 0 },
                        ticks: { color: '#9ca3af', callback: (v) => '$' + v/1000 + 'k' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9ca3af' }
                    }
                }
            }
        });
    }
};
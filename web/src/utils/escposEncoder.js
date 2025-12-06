import EscPosEncoder from 'esc-pos-encoder';
import bwipjs from 'bwip-js';

// Helper para formatear CLP
const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

/**
 * Genera los bytes ESC/POS para el ticket, incluyendo el Timbre PDF417.
 * @param {Object} data - Datos de la venta (empresa, detalles, total)
 * @param {String} timbreStr - El string XML del <TED>...</TED>
 * @returns {Uint8Array} Bytes listos para QZ Tray
 */
export async function generarTicketEscPos(data, timbreStr) {
    const encoder = new EscPosEncoder();

    // 1. ENCABEZADO
    encoder.initialize()
           .align('center')
           .bold(true)
           .text(data.empresa.razonSocial || 'EMPRESA')
           .newline()
           .bold(false)
           .size('small')
           .text(`RUT: ${data.empresa.rut || '-'}`)
           .newline()
           .text(data.empresa.direccion || 'Temuco')
           .newline()
           .newline();

    // 2. DATOS VENTA
    encoder.align('left')
           .text('--------------------------------')
           .newline()
           .text(`BOLETA N: ${data.venta.id_venta}`)
           .newline()
           .text(`FECHA:    ${data.venta.fecha}`)
           .newline()
           .text('--------------------------------')
           .newline();

    // 3. DETALLES (Tabla manual)
    // EscPosEncoder no tiene tablas complejas, alineamos a mano o simple
    data.detalles.forEach(d => {
        const nombre = (d.nombre || '').substring(0, 20);
        encoder.text(`${d.cantidad} ${nombre}`)
               .align('right')
               .text(formatCLP(d.subtotal))
               .align('left')
               .newline();
    });

    encoder.text('--------------------------------')
           .newline();

    // 4. TOTALES
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    encoder.align('right')
           .text(`Neto: ${formatCLP(neto)}`)
           .newline()
           .text(`IVA: ${formatCLP(iva)}`)
           .newline()
           .size('normal')
           .bold(true)
           .text(`TOTAL: ${formatCLP(total)}`)
           .bold(false)
           .newline()
           .newline();

    // 5. GENERAR TIMBRE PDF417 (WEB)
    if (timbreStr) {
        try {
            // Creamos un canvas en memoria
            const canvas = document.createElement('canvas');
            
            // Usamos BWIP-JS para dibujar el PDF417 en el canvas
            // OJO: Usamos bwipjs.toCanvas (versión navegador)
            bwipjs.toCanvas(canvas, {
                bcid: 'pdf417',       // Tipo de código
                text: timbreStr,      // El XML del TED
                scale: 2,             // Escala (2 es un buen equilibrio para 80mm)
                height: 10,           // Altura de las barras (factor)
                includetext: false,   // No imprimir el texto del XML abajo
                eclevel: 5            // Nivel de corrección de errores (SII pide 5 habitualmente)
            });

            // Convertimos el canvas a una Imagen para el Encoder
            const img = new Image();
            img.src = canvas.toDataURL('image/png');
            
            // Esperamos a que la imagen "cargue" en memoria
            await new Promise(r => img.onload = r);

            // Insertamos la imagen en el ticket
            // .image(elemento, ancho, alto, algoritmo)
            // 'atkinson' es bueno para difuminado monocromático
            encoder.align('center')
                   .image(img, 384, 120, 'atkinson') 
                   .newline()
                   .size('small')
                   .text('Timbre Electronico SII')
                   .newline()
                   .text('Verifique en www.sii.cl')
                   .newline();

        } catch (e) {
            console.error("Error generando PDF417 Web:", e);
            encoder.text('(Error Timbre Web)').newline();
        }
    }

    // 6. CORTAR
    encoder.cut();

    return encoder.encode();
}
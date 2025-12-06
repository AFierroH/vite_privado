import EscPosEncoder from 'esc-pos-encoder';
import bwipjs from 'bwip-js';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

/**
 * Genera una imagen Base64 del PDF417 usando Canvas (Equivalente a tu generatePdf417 de Electron)
 */
async function generatePdf417Web(dataStr) {
    if (!dataStr) return null;
    
    // Crear un canvas invisible
    const canvas = document.createElement('canvas');
    
    try {
        // 1. Dibujar el código de barras en el canvas usando BWIP-JS
        bwipjs.toCanvas(canvas, {
            bcid: 'pdf417',       // Tipo
            text: dataStr.trim(), // Datos (XML del Timbre)
            scale: 2,             // Escala
            height: 10,           // Altura barras
            includetext: false,
            eclevel: 5,           // Nivel de error
            padding: 0
        });

        // 2. Procesamiento de Imagen (Imitando a JIMP de Electron)
        // Convertimos a Imagen para poder manipularla o pasarla al encoder
        const img = new Image();
        img.src = canvas.toDataURL('image/png');
        await new Promise(r => img.onload = r);

        // Opcional: Si necesitaras redimensionar o convertir a B/N estricto, 
        // podrías dibujar esta imagen en otro canvas con filtros. 
        // Por ahora, bwipjs genera B/N puro, así que suele funcionar bien directo.
        
        return img; // Retornamos el objeto Image listo para el Encoder

    } catch (e) {
        console.error("Error generando PDF417 Web:", e);
        return null;
    }
}

/**
 * Genera los bytes ESC/POS finales para QZ Tray
 */
export async function generarTicketEscPos(data, timbreXml) {
    const encoder = new EscPosEncoder();

    // --- ENCABEZADO ---
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

    // --- DATOS VENTA ---
    encoder.align('left')
           .text('--------------------------------')
           .newline()
           .text(`BOLETA N: ${data.venta.id_venta}`)
           .newline()
           .text(`FECHA:    ${data.venta.fecha}`)
           .newline()
           .text('--------------------------------')
           .newline();

    // --- DETALLES ---
    data.detalles.forEach(d => {
        // Simulando tabla simple
        const nombre = (d.nombre || '').substring(0, 20);
        encoder.text(`${d.cantidad} ${nombre}`)
               .align('right')
               .text(formatCLP(d.subtotal))
               .align('left') // Volver a izquierda
               .newline();
    });

    encoder.text('--------------------------------')
           .newline();

    // --- TOTALES ---
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

    // --- TIMBRE ELECTRONICO (WEB) ---
    if (timbreXml) {
        try {
            console.log("Generando imagen PDF417 para Web...");
            const imgObj = await generatePdf417Web(timbreXml);
            
            if (imgObj) {
                encoder.align('center')
                       // .image(elemento, ancho, alto, algoritmo)
                       // 384 es el ancho estándar útil para 58/80mm centrado
                       .image(imgObj, 384, 120, 'atkinson') 
                       .newline()
                       .size('small')
                       .text('Timbre Electronico SII')
                       .newline()
                       .text('Verifique en www.sii.cl')
                       .newline();
            }
        } catch (e) {
            console.error("Fallo al insertar imagen en ticket web:", e);
            encoder.text('(Error Visualizando Timbre)').newline();
        }
    }

    encoder.cut();

    return encoder.encode(); // Retorna Uint8Array
}
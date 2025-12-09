import EscPosEncoder from 'esc-pos-encoder';
import bwipjs from 'bwip-js';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

/**
 * Genera una imagen Base64 del PDF417 usando Canvas (Equivalente a tu generatePdf417 de Electron)
 */
async function generatePdf417Web(dataStr) {
    if (!dataStr) return null;
    
    const canvas = document.createElement('canvas');
    
    try {
        bwipjs.toCanvas(canvas, {
            bcid: 'pdf417',
            text: dataStr.trim(),
            scale: 2,           // Mantenemos escala 2 para legibilidad
            height: 10,         // Altura de las barras
            includetext: false,
            eclevel: 5,
            padding: 0,
            // TRUCO: Forzar columnas fijas si el dato es muy largo ayuda a controlar el ancho
            columns: 6          // Ajustable: entre 6 y 10 suele funcionar bien para tickets
        });

        // Convertir a imagen
        const img = new Image();
        img.src = canvas.toDataURL('image/png');
        await new Promise(r => img.onload = r);
        
        return img;

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
    
    // ANCHO DE LINEA (Ajusta esto según tu papel: 48 para 80mm, 32 para 58mm)
    const SEPARATOR = '-'.repeat(48); 

    // --- ENCABEZADO ---
    encoder.initialize()
           .codepage('cp858') // Importante para tildes y ñ
           .align('center')
           .bold(true)
           .size('normal')    // Forzar tamaño normal (evita gigantes accidentales)
           .text(data.empresa.razonSocial || 'EMPRESA')
           .newline()
           .bold(false)
           .size('small')     // RUT y Dirección en pequeño queda elegante
           .text(`RUT: ${data.empresa.rut || '-'}`)
           .newline()
           .text(data.empresa.direccion || 'Temuco')
           .newline()
           .newline();

    // --- DATOS VENTA ---
    encoder.align('left')
           .size('normal')    // Volvemos a normal para el cuerpo
           .text(SEPARATOR)
           .newline()
           .bold(true)
           .text(`BOLETA N: ${data.venta.id_venta}`)
           .newline()
           .bold(false)
           .text(`FECHA:    ${data.venta.fecha}`)
           .newline()
           .text(SEPARATOR)
           .newline();

    // --- DETALLES (Ajustado para ocupar ancho completo) ---
    // Usaremos columnas manuales para alinear PRECIO a la derecha
    data.detalles.forEach(d => {
        const nombre = (d.nombre || '').substring(0, 25); // Limitar nombre
        const precio = formatCLP(d.subtotal);
        
        // Cálculo de espacios para alinear a la derecha (simple)
        // Total 48 chars - largo nombre - largo precio - 1 espacio
        const espacios = Math.max(1, 48 - nombre.length - precio.length);
        
        encoder.text(`${d.cantidad} ${nombre}${' '.repeat(espacios)}${precio}`)
               .newline();
    });

    encoder.text(SEPARATOR)
           .newline();

    // --- TOTALES ---
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    // Alineación derecha para totales
    encoder.align('right');
    
    encoder.text(`Neto: ${formatCLP(neto)}`).newline();
    encoder.text(`IVA: ${formatCLP(iva)}`).newline();
    
    encoder.size('normal') // Asegurar tamaño antes del total
           .bold(true)
           .width(2)       // Doble ancho SOLO para el total (destacar)
           .text(`TOTAL: ${formatCLP(total)}`)
           .width(1)       // Volver a ancho normal
           .bold(false)
           .newline()
           .newline();

    // --- TIMBRE ELECTRONICO (WEB) ---
    if (timbreXml) {
        try {
            const imgObj = await generatePdf417Web(timbreXml);
            if (imgObj) {
                encoder.align('center')
                       // Reducir ancho imagen si se corta (ej: 300 o 350 para seguridad)
                       .image(imgObj, 350, 120, 'atkinson') 
                       .newline()
                       .size('small')
                       .text('Timbre Electronico SII')
                       .newline()
                       .text('Verifique en www.sii.cl')
                       .newline();
            }
        } catch (e) {
            console.error("Fallo imagen ticket:", e);
        }
    }

    encoder.cut();
    return encoder.encode();
}
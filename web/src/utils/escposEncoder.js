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
    
    // ANCHO DE LINEA: 48 caracteres es el estándar seguro para 80mm
    const SEPARATOR = '-'.repeat(48); 

    // --- 1. INICIALIZACIÓN ROBUSTA ---
    encoder.initialize()
           .codepage('cp858')
           // TRUCO: Comandos RAW para forzar modo normal
           .raw([0x1B, 0x32])       // ESC 2: Espaciado de línea estándar (corrige líneas pegadas)
           .raw([0x1B, 0x4D, 0x00]) // ESC M 0: Forzar Fuente A (Grande/Normal)
           .align('center')
           .bold(true)
           .size('normal')          // Asegurar tamaño normal por librería
           .text(data.empresa.razonSocial || 'EMPRESA')
           .newline()
           .bold(false)
           .size('small')           // El RUT está bien en pequeño, pero si sale ilegible, cámbialo a 'normal'
           .text(`RUT: ${data.empresa.rut || '-'}`)
           .newline()
           .text(data.empresa.direccion || 'Temuco')
           .newline()
           .newline();

    // --- 2. CUERPO DE LA BOLETA ---
    encoder.align('left')
           .size('normal')          // Volver a normal OBLIGATORIAMENTE
           .raw([0x1B, 0x4D, 0x00]) // Re-forzar Fuente A por si acaso
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

    // --- 3. DETALLES ---
    data.detalles.forEach(d => {
        // Recortamos nombre a 20 chars para que quepa precio
        const nombre = (d.nombre || '').substring(0, 20); 
        const precio = formatCLP(d.subtotal);
        
        // Cálculo manual de espacios para alinear precio a la derecha
        // 48 (ancho total) - largo nombre - largo precio - espacio extra
        let espacios = 48 - (d.cantidad.toString().length + 1 + nombre.length + precio.length);
        if (espacios < 1) espacios = 1;

        encoder.text(`${d.cantidad} ${nombre}${' '.repeat(espacios)}${precio}`)
               .newline();
    });

    encoder.text(SEPARATOR).newline();

    // --- 4. TOTALES ---
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    encoder.align('right')
           .text(`Neto: ${formatCLP(neto)}`).newline()
           .text(`IVA: ${formatCLP(iva)}`).newline()
           .size('normal')
           .bold(true)
           .width(2) // Doble ancho solo para el total
           .text(`TOTAL: ${formatCLP(total)}`)
           .width(1) // Volver a ancho normal INMEDIATAMENTE
           .bold(false)
           .newline()
           .newline();

    // --- 5. TIMBRE (EL ARREGLO CLAVE) ---
    if (timbreXml) {
        try {
            // Usamos tu función generatePdf417Web
            const imgObj = await generatePdf417Web(timbreXml);
            
            if (imgObj) {
                encoder.align('center')
                       // CAMBIO IMPORTANTE:
                       // 1. Ancho 300 (Más pequeño para no saturar buffer)
                       // 2. Alto 100 (Suficiente para leerse)
                       // 3. Algoritmo 'threshold' (Blanco/Negro puro, pesa MENOS que 'atkinson')
                       .image(imgObj, 300, 100, 'threshold') 
                       .newline()
                       .size('small') // Texto chico bajo el timbre
                       .text('Timbre Electronico SII')
                       .newline()
                       .text('Verifique en www.sii.cl')
                       .newline();
            }
        } catch (e) {
            console.error("Error timbre:", e);
            encoder.text('[Error Timbre]').newline();
        }
    }

    // --- 6. FINALIZAR ---
    encoder.newline();
    encoder.newline(); // Espacio extra antes de cortar para no romper el texto
    encoder.cut();

    return encoder.encode();
}
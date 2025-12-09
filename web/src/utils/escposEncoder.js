import EscPosEncoder from 'esc-pos-encoder';
import bwipjs from 'bwip-js';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

/**
 * Genera el PDF417 optimizado para evitar cortes en la impresora.
 * Usamos un canvas más pequeño y binarización simple.
 */
async function generatePdf417Web(dataStr) {
    if (!dataStr) return null;
    
    // Crear canvas off-screen
    const canvas = document.createElement('canvas');
    
    try {
        // 1. Generar código de barras
        bwipjs.toCanvas(canvas, {
            bcid: 'pdf417',
            text: dataStr.trim(),
            scale: 2,           // Escala suficiente para lectura
            height: 10,         // Altura de barras
            includetext: false,
            eclevel: 5,
            padding: 0
        });

        // 2. Convertir a Imagen y esperar carga
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
 * Genera los bytes ESC/POS exactos
 */
export async function generarTicketEscPos(data, timbreXml) {
    // Instanciar Encoder
    const encoder = new EscPosEncoder();

    // CONFIGURACIÓN DE ANCHO (Crucial para que no se vea "comprimido")
    // 48 caracteres es el ancho estándar para papel de 80mm en Fuente A
    const LINE_WIDTH = 48;
    const SEPARATOR = '-'.repeat(LINE_WIDTH);

    // --- 1. INICIALIZACIÓN ---
    encoder.initialize()
           .codepage('cp858') // Soporte Ñ y tildes
           
           // COMANDOS RAW PARA RESETEAR FUENTES (Esto arregla el texto comprimido)
           .raw([0x1B, 0x21, 0x00]) // ESC ! 0 (Fuente A normal)
           .raw([0x1B, 0x33, 30])   // ESC 3 n (Interlineado un poco más aireado)

           .align('center')
           .bold(true)
           .text(data.empresa.razonSocial || 'EMPRESA')
           .newline()
           .bold(false)
           .size('small') // RUT pequeño
           .text(`RUT: ${data.empresa.rut || '-'}`)
           .newline()
           .text(data.empresa.direccion || 'Temuco')
           .newline()
           .newline();

    // --- 2. DATOS VENTA ---
    encoder.align('left')
           .size('normal') // Asegurar normal para el cuerpo
           .text(SEPARATOR).newline()
           .bold(true).text(`BOLETA N: ${data.venta.id_venta}`).bold(false).newline()
           .text(`FECHA:    ${data.venta.fecha}`).newline()
           .text(SEPARATOR).newline();

    // --- 3. DETALLES (Simulando tabla alineada) ---
    data.detalles.forEach(d => {
        let nombre = (d.nombre || '').substring(0, 20); // Recortar nombre
        let precio = formatCLP(d.subtotal);
        let cantidad = String(d.cantidad);

        // Construir línea: "1  NombreProducto ....... $1.000"
        // Calculamos espacios necesarios para empujar el precio a la derecha
        let textoIzq = `${cantidad} ${nombre}`;
        let espacios = LINE_WIDTH - (textoIzq.length + precio.length);
        
        if (espacios < 1) espacios = 1; // Mínimo un espacio

        encoder.text(`${textoIzq}${' '.repeat(espacios)}${precio}`)
               .newline();
    });

    encoder.text(SEPARATOR).newline();

    // --- 4. TOTALES ---
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    // Alineación derecha manual para evitar bugs de .align('right')
    // Simplemente rellenamos con espacios a la izquierda
    const lineaNeto = `Neto: ${formatCLP(neto)}`;
    const lineaIva = `IVA: ${formatCLP(iva)}`;
    
    encoder.text(' '.repeat(Math.max(0, LINE_WIDTH - lineaNeto.length)) + lineaNeto).newline()
           .text(' '.repeat(Math.max(0, LINE_WIDTH - lineaIva.length)) + lineaIva).newline();

    encoder.newline();

    // TOTAL EN GRANDE
    encoder.align('right') // Aquí sí usamos align porque cambiamos tamaño
           .bold(true)
           .width(2) // Doble Ancho
           .height(1)
           .text(`TOTAL: ${formatCLP(total)}`)
           .width(1) // Reset Ancho
           .height(1)
           .bold(false)
           .newline()
           .newline();

    // --- 5. TIMBRE (SOLUCIÓN AL CORTE Y SALTO DE PÁGINA) ---
    if (timbreXml) {
        try {
            const imgObj = await generatePdf417Web(timbreXml);
            if (imgObj) {
                encoder.align('center')
                       // .image(img, width, height, algorithm)
                       // Ancho 300 es seguro. 'threshold' crea una imagen binaria ligera.
                       .image(imgObj, 300, 100, 'threshold') 
                       .newline()
                       .size('small')
                       .text('Timbre Electronico SII').newline()
                       .text('Verifique en www.sii.cl').newline();
            }
        } catch (e) {
            console.error("Fallo timbre:", e);
            encoder.text('[Error Timbre]').newline();
        }
    }

    // --- 6. CORTE ---
    encoder.newline().newline().newline(); // Feed 3 líneas
    encoder.cut();

    return encoder.encode();
}
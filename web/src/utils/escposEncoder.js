import EscPosEncoder from 'esc-pos-encoder';
import bwipjs from 'bwip-js';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

// --- COMANDOS ESC/POS ---
const CMD_RESET = [0x1B, 0x40]; // Inicializar
const CMD_FONT_A = [0x1B, 0x4D, 0x00]; // Fuente Normal (12x24)
const CMD_FONT_B = [0x1B, 0x4D, 0x01]; // Fuente Pequeña (9x17)

/**
 * Generador de PDF417 (Timbre)
 */
async function generatePdf417Web(dataStr) {
    if (!dataStr) return null;
    const canvas = document.createElement('canvas');
    try {
        bwipjs.toCanvas(canvas, {
            bcid: 'pdf417',
            text: dataStr.trim(),
            scale: 2,
            height: 10,
            includetext: false,
            eclevel: 5,
            padding: 0
        });
        const img = new Image();
        img.src = canvas.toDataURL('image/png');
        await new Promise(r => img.onload = r);
        return img;
    } catch (e) {
        console.error("Error PDF417:", e);
        return null;
    }
}

/**
 * Generador de Ticket ESC/POS
 */
export async function generarTicketEscPos(data, timbreXml) {
    const encoder = new EscPosEncoder();
    
    // Ancho para Fuente A (Normal) en 80mm = 48 caracteres aprox
    const LINE_WIDTH = 48;
    const SEPARATOR = '-'.repeat(LINE_WIDTH);

    // 1. INICIALIZACIÓN Y ENCABEZADO
    encoder.initialize()
           .codepage('cp858')
           .raw(CMD_RESET) 
           .align('center')
           
           // Nombre Empresa (Negrita y Grande)
           .bold(true)
           .width(2) // Doble ancho para destacar nombre
           .text((data.empresa.razonSocial || 'EMPRESA').substring(0, 24)) // Limitamos largo para que no rompa
           .width(1) // Volver ancho normal
           .bold(false)
           .newline()
           
           // RUT y Dirección (Normal)
           .text(`RUT: ${data.empresa.rut || '-'}`)
           .newline()
           .text((data.empresa.direccion || 'Temuco').substring(0, 48))
           .newline()
           .newline();

    // 2. DATOS DE LA VENTA
    // Aquí es donde arreglamos el FOLIO
    // Usamos data.venta.folio si existe (lo correcto), si no el id interno
    const folioText = data.venta.folio && data.venta.folio !== '---' 
                      ? data.venta.folio 
                      : data.venta.id_venta;

    encoder.align('left')
           .text(SEPARATOR)
           .newline()
           .bold(true)
           .text(`BOLETA N: ${folioText}`) // <--- CORREGIDO AQUÍ
           .newline()
           .bold(false)
           .text(`FECHA:    ${data.venta.fecha}`)
           .newline()
           .text(SEPARATOR)
           .newline();

    // 3. DETALLES
    data.detalles.forEach(d => {
        const nombre = (d.nombre || '').substring(0, 22); // Cortamos nombre
        const precio = formatCLP(d.subtotal);
        const cantidad = String(d.cantidad);

        // Formato: "2  Coca Cola ... $ 2.000"
        let textoIzq = `${cantidad}  ${nombre}`;
        
        // Calcular espacios para alinear precio a la derecha
        let espacios = LINE_WIDTH - (textoIzq.length + precio.length);
        if (espacios < 1) espacios = 1;

        encoder.text(`${textoIzq}${' '.repeat(espacios)}${precio}`)
               .newline();
    });

    encoder.text(SEPARATOR).newline();

    // 4. TOTALES (Neto e IVA a la izquierda como pediste)
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    // Alineación Izquierda Pura (Full Left)
    encoder.align('left');
    encoder.text(`Neto: ${formatCLP(neto)}`).newline();
    encoder.text(`IVA:  ${formatCLP(iva)}`).newline();
    
    encoder.newline();

    // 5. TOTAL FINAL (Arreglado para que no se corte)
    // Usamos align right y negrita, pero SIN width(2) si el número es muy grande
    // O probamos con width(2) pero asegurando espacio.
    
    encoder.align('right')
           .bold(true)
           .width(2)      // Doble Ancho
           .height(2);    // Doble Alto
    
    // Si el total es muy largo (ej: $ 10.000.000), el width(2) lo romperá.
    // Hack: Si es muy largo, bajamos a width(1)
    const textoTotal = `TOTAL: ${formatCLP(total)}`;
    
    if (textoTotal.length > 12) { // 12 chars * 2 ancho = 24 chars (mitad de linea)
        encoder.width(1); // Achicamos si es millonario
    }

    encoder.text(textoTotal)
           .width(1)  // Reset Ancho
           .height(1) // Reset Alto
           .bold(false)
           .newline()
           .newline();

    // 6. TIMBRE PDF417
    if (timbreXml) {
        try {
            const imgObj = await generatePdf417Web(timbreXml);
            if (imgObj) {
                encoder.align('center')
                       .image(imgObj, 300, 100, 'threshold')
                       .newline()
                       // Texto legal SIEMPRE va en fuente pequeña (Font B)
                       .raw(CMD_FONT_B) 
                       .text('Timbre Electronico SII')
                       .newline()
                       .text('Verifique en www.sii.cl')
                       .newline()
                       .raw(CMD_FONT_A); // Volver a normal por si acaso
            }
        } catch (e) { console.error(e); }
    } else {
        // Mensaje si no hay timbre (para pruebas)
        encoder.align('center')
               .text('(Sin Timbre - Modo Prueba)')
               .newline();
    }

    // 7. CORTE
    encoder.newline().newline().newline();
    encoder.cut();

    return encoder.encode();
}
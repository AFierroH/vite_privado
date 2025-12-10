import EscPosEncoder from 'esc-pos-encoder';
import bwipjs from 'bwip-js';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

// --- SECUENCIA DE RESETEO NUCLEAR ---
// Inyectamos esto antes de cada bloque de texto importante
const CMD_RESET_TOTAL = [
    0x1B, 0x40,       // ESC @    -> Inicializar impresora (Borra configuraciones raras)
    0x12,             // DC2      -> Cancelar modo CONDENSADO (Importante si se ve "apretado")
    0x1B, 0x4D, 0x00, // ESC M 0  -> Forzar FUENTE A (La grande/normal de 12x24)
    0x1B, 0x21, 0x00, // ESC ! 0  -> Resetear modos de impresión (Quita negrita, doble alto/ancho)
    0x1B, 0x32        // ESC 2    -> Espaciado de línea por defecto (1/6 pulgada)
];

/**
 * Generador de PDF417 optimizado (Binarizado para no cortar el papel)
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
    
    // Ancho para Fuente A en 80mm = 48 caracteres
    const LINE_WIDTH = 48;
    const SEPARATOR = '-'.repeat(LINE_WIDTH);

    // --- 1. INICIO (RESET TOTAL) ---
    encoder.initialize()
           .codepage('cp858') // Ñ y Tildes
           .raw(CMD_RESET_TOTAL) // <--- AQUÍ ESTÁ LA MAGIA
           .align('center')
           .bold(true)
           .text(data.empresa.razonSocial || 'EMPRESA')
           .newline()
           .bold(false)
           .size('small') // Solo el RUT en pequeño
           .text(`RUT: ${data.empresa.rut || '-'}`)
           .newline()
           .raw(CMD_RESET_TOTAL) // VOLVER A GRANDE INMEDIATAMENTE
           .text(data.empresa.direccion || 'Temuco')
           .newline()
           .newline();

    // --- 2. DATOS VENTA ---
    encoder.align('left')
           .raw(CMD_RESET_TOTAL) // ASEGURAR GRANDE OTRA VEZ
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

    // --- 3. DETALLES (Alineación manual) ---
    data.detalles.forEach(d => {
        const nombre = (d.nombre || '').substring(0, 20); 
        const precio = formatCLP(d.subtotal);
        const cantidad = String(d.cantidad);

        // Forzamos reseteo en cada línea por seguridad si tu impresora es rebelde
        // (Puedes quitar este .raw() si ya se arregló, pero déjalo para probar)
        encoder.raw([0x1B, 0x4D, 0x00]); 

        // Cálculo de espacios para que llegue al borde derecho (48 chars)
        let textoIzq = `${cantidad} ${nombre}`;
        let espacios = LINE_WIDTH - (textoIzq.length + precio.length);
        if (espacios < 1) espacios = 1;

        encoder.text(`${textoIzq}${' '.repeat(espacios)}${precio}`)
               .newline();
    });

    encoder.text(SEPARATOR).newline();

    // --- 4. TOTALES ---
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    const lineaNeto = `Neto: ${formatCLP(neto)}`;
    const lineaIva = `IVA: ${formatCLP(iva)}`;
    
    // Alineación derecha manual
    encoder.text(' '.repeat(Math.max(0, LINE_WIDTH - lineaNeto.length)) + lineaNeto).newline();
    encoder.text(' '.repeat(Math.max(0, LINE_WIDTH - lineaIva.length)) + lineaIva).newline();
    
    encoder.newline();

    // TOTAL GIGANTE
    encoder.align('right')
           .bold(true)
           .width(2) // Ancho x2
           .height(2) // Alto x2 (Para que se vea bien grande)
           .text(`TOTAL: ${formatCLP(total)}`)
           .width(1) // Reset Ancho
           .height(1) // Reset Alto
           .bold(false)
           .newline()
           .newline();

    // --- 5. TIMBRE ---
    if (timbreXml) {
        try {
            const imgObj = await generatePdf417Web(timbreXml);
            if (imgObj) {
                encoder.align('center')
                       .image(imgObj, 300, 100, 'threshold') // Binarizado para velocidad
                       .newline()
                       .size('small') // Texto pequeño legal
                       .text('Timbre Electronico SII')
                       .newline()
                       .text('Verifique en www.sii.cl')
                       .newline();
            }
        } catch (e) { console.error(e); }
    }

    // --- 6. CORTE ---
    encoder.newline().newline().newline();
    encoder.cut();

    return encoder.encode();
}
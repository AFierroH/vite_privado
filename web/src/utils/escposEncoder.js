import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();

    // 48 es el ancho real si usamos los comandos RAW de abajo.
    const WIDTH = 48; 
    const SEPARATOR = '-'.repeat(WIDTH);

    // Helpers
    const centerText = (txt) => {
        const str = String(txt || '').substring(0, WIDTH);
        const padding = Math.max(0, Math.floor((WIDTH - str.length) / 2));
        return ' '.repeat(padding) + str;
    };

    // ==========================================
    // 1. INIT & HACK DE MÁRGENES (OBLIGATORIO)
    // ==========================================
    encoder
        .initialize()
        .codepage('cp858');

    // --- ¡NO BORRES ESTO! ES LO QUE ARREGLA EL MARGEN ---
    // 1. Margen Izquierdo = 0
    encoder.raw([0x1d, 0x4c, 0x00, 0x00]); 
    // 2. Ancho de impresión = 576 puntos (80mm COMPLETO)
    encoder.raw([0x1d, 0x57, 0x40, 0x02]);
    // -----------------------------------------------------

    encoder
        .align('left');

    // =====================
    // 2. ENCABEZADO
    // =====================
    encoder
        .align('center')
        .bold(true).text(data.empresa.razonSocial || 'EMPRESA').bold(false).newline()
        .text(`RUT: ${data.empresa.rut || '-'}`).newline()
        .text((data.empresa.direccion || 'Temuco').substring(0, WIDTH)).newline(2)
        .align('left');

    // =====================
    // 3. INFO VENTA
    // =====================
    const folioText = data.venta.folio || data.venta.id_venta || '---';

    encoder
        .text(centerText(SEPARATOR)).newline()
        .align('center')
        .bold(true).text(`BOLETA N: ${folioText}`).bold(false).newline()
        .align('left')
        .text(centerText(`FECHA: ${data.venta.fecha}`)).newline()
        .text(centerText(SEPARATOR)).newline(2);

    // =====================
    // 4. PRODUCTOS
    // =====================
    encoder.text('CANT DESCRIPCION'.padEnd(WIDTH - 12) + '       TOTAL').newline()
           .text(SEPARATOR).newline();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);
        const colCantW = 4;
        const colPrecioW = precio.length;
        const colNombreW = WIDTH - colCantW - colPrecioW - 1;

        let nombre = (d.nombre || '').substring(0, colNombreW);
        const c = cant.padEnd(colCantW, ' ');
        const n = nombre.padEnd(colNombreW, ' ');

        encoder.text(`${c}${n}${precio}`).newline();
    });

    encoder.text(SEPARATOR).newline();

    // =====================
    // 5. TOTALES (Con alineación nativa)
    // =====================
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    // Aquí usamos .align('right'). Gracias a los comandos RAW del inicio,
    // ahora "right" significa "el borde del papel", no "el borde imaginario".
    encoder
        .align('right') 
        .text(`Neto: ${formatCLP(neto)}`).newline()
        .text(`IVA:  ${formatCLP(iva)}`).newline();

    encoder
        .size('2x')
        .bold(true)
        .text(`TOTAL: ${formatCLP(total)}`)
        .newline()
        .bold(false)
        .size('normal')
        .newline(1);
    
    // =====================
    // 6. PDF417 (Timbre)
    // =====================
    try {
        let imgSource = null;
        if (timbreXml) {
            const tedContent = extraerTedDelXml(timbreXml);
            if (tedContent) imgSource = await generarPdf417Base64(tedContent);
        }

        if (imgSource) {
            const img = new Image();
            img.src = imgSource;
            await new Promise(r => { img.onload = r; img.onerror = r; });

            // 576px es el ancho físico que configuramos arriba
            const printerWidthPx = 576;
            const alignedHeight = Math.ceil(img.height / 8) * 8;

            const canvas = document.createElement('canvas');
            canvas.width = printerWidthPx;
            canvas.height = alignedHeight;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, printerWidthPx, alignedHeight);
            
            const xPos = (printerWidthPx - img.width) / 2;
            ctx.drawImage(img, xPos, 0);

            encoder
                .align('center')
                .image(canvas, printerWidthPx, alignedHeight, 'atkinson')
                .newline()
                .size('small')
                .text('Timbre Electronico SII').newline()
                .text('Verifique en www.sii.cl').newline()
                .size('normal');
        } else {
            encoder.align('center').text('(Sin Timbre)').newline();
        }

    } catch (e) {
        encoder.align('center').text('(Error Timbre)').newline();
    }

    encoder.newline(4).cut();
    return encoder.encode();
}
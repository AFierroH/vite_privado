import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();

    // ANCHO ESTÁNDAR 80MM (48 caracteres en Fuente A)
    const WIDTH = 48;
    const SEPARATOR = '-'.repeat(WIDTH);

    // Helpers
    const centerText = (txt) => {
        const str = String(txt || '').substring(0, WIDTH);
        const padding = Math.max(0, Math.floor((WIDTH - str.length) / 2));
        return ' '.repeat(padding) + str;
    };

    // ==========================================
    // 1. INIT & HACK DE MÁRGENES (RAW)
    // ==========================================
    encoder
        .initialize()
        .codepage('cp858');

    // --- MAGIA RAW PARA XPRINTER ---
    // 1. Resetear margen izquierdo a 0 (Hex: 1D 4C 00 00)
    encoder.raw([0x1d, 0x4c, 0x00, 0x00]);

    // 2. Forzar ancho de área de impresión a 80mm (576 puntos) (Hex: 1D 57 40 02)
    encoder.raw([0x1d, 0x57, 0x40, 0x02]);

    encoder
        .font('a')
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
    // Ajustamos la cabecera manualmente
    encoder.text('CANT DESCRIPCION'.padEnd(WIDTH - 12) + '       TOTAL').newline()
           .text(SEPARATOR).newline();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);

        // Cálculo dinámico para 48 columnas
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
    // 5. TOTALES (Alineación Nativa Derecha)
    // =====================
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    encoder
        .align('right') // Forzar derecha real
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

            // Usamos 576px (Ancho total físico que configuramos con RAW)
            const printerWidthPx = 576;
            const alignedHeight = Math.ceil(img.height / 8) * 8;

            const canvas = document.createElement('canvas');
            canvas.width = printerWidthPx;
            canvas.height = alignedHeight;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, printerWidthPx, alignedHeight);
            
            // Centrar
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
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();
    
    // XPrinter 80mm = 576 puntos = 48 caracteres (Font A)
    const WIDTH = 48; 
    const SEPARATOR = '-'.repeat(WIDTH);

    // Helpers
    const centerText = (txt) => {
        const str = String(txt || '').substring(0, WIDTH);
        const padding = Math.max(0, Math.floor((WIDTH - str.length) / 2));
        return ' '.repeat(padding) + str;
    };

    // =================================================================
    // 1. INICIALIZACIÓN Y CONFIGURACIÓN (ORDEN CRÍTICO)
    // =================================================================
    
    encoder
        .initialize()           // 1. PRIMERO reseteamos la impresora (ESC @)
        .codepage('cp858');     // 2. Definimos codificación

    // 3. AHORA SÍ enviamos los comandos de hardware (Ya no se borrarán)
    
    // GS L 0 0 (Margen izquierdo = 0 absoluto)
    encoder.raw([0x1d, 0x4c, 0x00, 0x00]); 

    // GS W 64 2 (Ancho de área = 576 puntos / 80mm reales)
    encoder.raw([0x1d, 0x57, 0x40, 0x02]);

    // =================================================================

    // Continuamos normal...
    encoder
        .align('center')
        .bold(true).text(data.empresa.razonSocial || 'EMPRESA').bold(false).newline()
        .text(`RUT: ${data.empresa.rut || '-'}`).newline()
        .text((data.empresa.direccion || 'Temuco').substring(0, WIDTH)).newline(2);

    // INFO VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';

    encoder
        .align('left')
        .text(centerText(SEPARATOR)).newline()
        .align('center')
        .bold(true).text(`BOLETA N: ${folioText}`).bold(false).newline()
        .align('left')
        .text(centerText(`FECHA: ${data.venta.fecha}`)).newline()
        .text(centerText(SEPARATOR)).newline(2);

    // PRODUCTOS
    // Cabecera ajustada manualmente para 48 chars
    encoder.text('CANT DESCRIPCION'.padEnd(WIDTH - 12) + '       TOTAL').newline()
           .text(SEPARATOR).newline();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad).padEnd(4);
        const precio = formatCLP(d.subtotal);
        
        // Cálculo dinámico
        const colNombreW = WIDTH - 4 - precio.length - 1; 
        const nombre = (d.nombre || '').substring(0, colNombreW).padEnd(colNombreW);
        
        encoder.text(`${cant}${nombre} ${precio}`).newline();
    });

    encoder.text(SEPARATOR).newline();

    // TOTALES (Alineación Nativa)
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    // AHORA SÍ funcionará porque el área de impresión es 576px
    encoder.align('right')
           .text(`Neto: ${formatCLP(neto)}`).newline()
           .text(`IVA:  ${formatCLP(iva)}`).newline();

    encoder.size('2x')
           .bold(true)
           .text(`TOTAL: ${formatCLP(total)}`)
           .newline()
           .bold(false)
           .size('normal')
           .newline(1);

    // TIMBRE
    encoder.align('center');
    /*
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

            encoder.image(canvas, printerWidthPx, alignedHeight, 'atkinson').newline();
            encoder.size('small')
                   .text('Timbre Electronico SII').newline()
                   .text('Verifique en www.sii.cl').newline()
                   .size('normal');
        } else {
            encoder.text('(Sin Timbre)').newline();
        }
    } catch (e) {
        encoder.text('(Error Timbre)').newline();
    }
*/
    encoder.text('--- PRUEBA DE ANCHO DE TEXTO ---').newline();
    encoder.text('IZQUIERDA                                DERECHA').newline();
    encoder.newline(4).cut();
    return encoder.encode();
}
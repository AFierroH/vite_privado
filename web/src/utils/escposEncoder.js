import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();
    
    const PRINTER_WIDTH_PX = 576;
    const CHAR_WIDTH_PX = 12; 
    const MAX_CHARS = 48;
    const SEPARATOR = '-'.repeat(MAX_CHARS);

    const printRightAligned = (text) => {
        const textLen = text.length * CHAR_WIDTH_PX;
        const position = PRINTER_WIDTH_PX - textLen;
        
        const nL = position % 256;
        const nH = Math.floor(position / 256);

        encoder
            .raw([0x1B, 0x61, 0x00]) 
            .raw([0x1B, 0x24, nL, nH]) 
            .text(text)
            .newline();
    };

    // =================================================================
    // 1. INICIALIZACIÓN (Reset primero, luego configuración)
    // =================================================================
    encoder
        .initialize()           // Reset
        .codepage('cp858');     

    encoder.raw([0x1d, 0x4c, 0x00, 0x00]); // GS L 0 (Margen Izq 0)
    encoder.raw([0x1d, 0x57, 0x40, 0x02]); // GS W 576 (Ancho 72mm)

    // =================================================================

    // ENCABEZADO
    encoder
        .align('center')
        .bold(true).text(data.empresa.razonSocial || 'EMPRESA').bold(false).newline()
        .text(`RUT: ${data.empresa.rut || '-'}`).newline()
        .text((data.empresa.direccion || 'Temuco').substring(0, MAX_CHARS)).newline(2);

    // INFO VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    encoder.align('left').text(SEPARATOR).newline();
    
    encoder.align('center')
        .bold(true).text(`BOLETA N: ${folioText}`).bold(false).newline();
        
    encoder.align('left')
        .text(`FECHA: ${data.venta.fecha}`).newline()
        .text(SEPARATOR).newline(2);

    encoder.align('left');
    encoder.text('CANT DESCRIPCION');
    
    const posTotal = PRINTER_WIDTH_PX - (5 * CHAR_WIDTH_PX);
    encoder.raw([0x1B, 0x24, posTotal % 256, Math.floor(posTotal / 256)])
           .text('TOTAL').newline();
           
    encoder.text(SEPARATOR).newline();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad).padEnd(4);
        const precio = formatCLP(d.subtotal);
        const nombreW = MAX_CHARS - 4 - precio.length - 1; 
        const nombre = (d.nombre || '').substring(0, nombreW);
        
        encoder.text(`${cant}${nombre}`);
        
        printRightAligned(precio);
    });

    encoder.text(SEPARATOR).newline();

    // TOTALES (Usando la nueva función printRightAligned)
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    printRightAligned(`Neto: ${formatCLP(neto)}`);
    printRightAligned(`IVA:  ${formatCLP(iva)}`);
    
    encoder.newline();
    
    // TOTAL FINAL
    // Para el total grande, calculamos la posición manualmente considerando doble ancho
    const txtTotal = `TOTAL: ${formatCLP(total)}`;
    const txtTotalLen = txtTotal.length * (CHAR_WIDTH_PX * 2); // *2 por size('2x')
    const posFinal = PRINTER_WIDTH_PX - txtTotalLen;
    
    encoder
        .align('left') // Importante: ESC $ funciona relativo al margen izquierdo
        .size('2x')
        .bold(true)
        .raw([0x1B, 0x24, posFinal % 256, Math.floor(posFinal / 256)]) // Mover cursor
        .text(txtTotal)
        .newline()
        .bold(false)
        .size('normal')
        .newline(1);

    // TIMBRE PDF417
    encoder.align('center');
    try {
        let imgSource = null;
        if (preGeneratedImg) {
             imgSource = preGeneratedImg.startsWith('data:') 
                ? preGeneratedImg 
                : `data:image/png;base64,${preGeneratedImg}`;
        } 
        else if (timbreXml) {
            const tedContent = extraerTedDelXml(timbreXml);
            if (tedContent) imgSource = await generarPdf417Base64(tedContent);
        }

        if (imgSource) {
            const img = new Image();
            img.src = imgSource;
            await new Promise(r => { img.onload = r; img.onerror = r; });

            // Ancho físico para imagen (576px)
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

    encoder.newline(4).cut();
    return encoder.encode();
}
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();

    // =========================================================
    // CONFIGURACIÓN FÍSICA
    // =========================================================
    const PRINTER_WIDTH_PX = 576;
    const CHAR_WIDTH_PX = 12;

    // Margen seguro GLOBAL
    const SAFE_LEFT_PX  = CHAR_WIDTH_PX;                  // +1 char
    const SAFE_RIGHT_PX = PRINTER_WIDTH_PX - CHAR_WIDTH_PX; // -1 char
    const SAFE_WIDTH_PX = SAFE_RIGHT_PX - SAFE_LEFT_PX;

    // =========================================================
    // HELPERS
    // =========================================================
    const moveCursor = (pos) => {
        const nL = pos % 256;
        const nH = Math.floor(pos / 256);
        return [0x1B, 0x24, nL, nH];
    };

    // =========================================================
    // SEPARADOR — UNA FILA, DOS TRAMOS HORIZONTALES (SAFE)
    // =========================================================
    const printSeparatorSplitHorizontal = () => {
        const totalChars = Math.floor(SAFE_WIDTH_PX / CHAR_WIDTH_PX);

        const leftChars  = Math.floor(totalChars / 2);
        const rightChars = totalChars - leftChars;

        const leftPart  = '-'.repeat(leftChars);
        const rightPart = '-'.repeat(rightChars);

        const startPx = SAFE_LEFT_PX;
        const midPx   = SAFE_LEFT_PX + (leftChars * CHAR_WIDTH_PX);

        // MISMA FILA, DOS ESCRITURAS
        encoder.raw(moveCursor(startPx)).text(leftPart);
        encoder.raw(moveCursor(midPx)).text(rightPart).newline();
    };

    // =========================================================
    // DERECHA EXACTA (SAFE)
    // =========================================================
    const printRightPrecision = (text, isBold = false) => {
        const str = String(text);
        const textLen = str.length * CHAR_WIDTH_PX;
        const pos = SAFE_RIGHT_PX - textLen;

        if (isBold) encoder.bold(true);
        encoder.raw(moveCursor(pos)).text(str).newline();
        if (isBold) encoder.bold(false);
    };

    // =========================================================
    // CENTRADO (NO TOCAR)
    // =========================================================
    const printCenteredPrecision = (text, isBold = false) => {
        const str = String(text).trim();
        const textLen = str.length * CHAR_WIDTH_PX;
        const pos = Math.floor((PRINTER_WIDTH_PX - textLen) / 2);

        if (isBold) encoder.bold(true);
        encoder.raw(moveCursor(pos)).text(str).newline();
        if (isBold) encoder.bold(false);
    };

    // =========================================================
    // DOS COLUMNAS (SAFE)
    // =========================================================
    const printSplitPrecision = (left, right) => {
        encoder.raw(moveCursor(SAFE_LEFT_PX)).text(left);

        const strRight = String(right);
        const posRight = SAFE_RIGHT_PX - (strRight.length * CHAR_WIDTH_PX);
        encoder.raw(moveCursor(posRight)).text(strRight).newline();
    };

    // =========================================================
    // INIT
    // =========================================================
    encoder
        .initialize()
        .codepage('cp858')
        .align('left');

    encoder.raw([0x1D, 0x4C, 0x00, 0x00]); // GS L
    encoder.raw([0x1D, 0x57, 0x40, 0x02]); // GS W 576

    // =========================================================
    // ENCABEZADO
    // =========================================================
    printCenteredPrecision(data.empresa.razonSocial || 'EMPRESA', true);
    printCenteredPrecision(`RUT: ${data.empresa.rut || '-'}`);
    printCenteredPrecision((data.empresa.direccion || 'Temuco').substring(0, 48));
    encoder.newline();

    // =========================================================
    // INFO VENTA
    // =========================================================
    const folioText = data.venta.folio || data.venta.id_venta || '---';

    printSeparatorSplitHorizontal();
    printCenteredPrecision(`BOLETA N° ${folioText}`, true);
    encoder.raw(moveCursor(SAFE_LEFT_PX)).text(`FECHA: ${data.venta.fecha}`).newline();
    printSeparatorSplitHorizontal();

    // =========================================================
    // PRODUCTOS
    // =========================================================
    printSplitPrecision('CANT DESCRIPCION', 'TOTAL');
    printSeparatorSplitHorizontal();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);
        const nombre = (d.nombre || '').substring(0, 25);
        const left = `${cant.padEnd(4)} ${nombre}`;

        printSplitPrecision(left, precio);
    });

    printSeparatorSplitHorizontal();

    // =========================================================
    // TOTALES
    // =========================================================
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    printRightPrecision(`Neto: ${formatCLP(neto)}`);
    printRightPrecision(`IVA:  ${formatCLP(iva)}`);
    encoder.newline();
    printRightPrecision(`TOTAL: ${formatCLP(total)}`, true);

    // =========================================================
    // TIMBRE
    // =========================================================
    encoder.newline();
    try {
        let imgSource = null;

        if (preGeneratedImg) {
            imgSource = preGeneratedImg.startsWith('data:')
                ? preGeneratedImg
                : `data:image/png;base64,${preGeneratedImg}`;
        } else if (timbreXml) {
            const ted = extraerTedDelXml(timbreXml);
            if (ted) imgSource = await generarPdf417Base64(ted);
        }

        if (imgSource) {
            const img = new Image();
            img.src = imgSource;
            await new Promise(r => img.onload = r);

            const canvas = document.createElement('canvas');
            canvas.width = 576;
            canvas.height = Math.ceil(img.height / 8) * 8;

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, (576 - img.width) / 2, 0);

            encoder.align('center')
                   .image(canvas, 576, canvas.height, 'atkinson')
                   .newline()
                   .align('left');

            printCenteredPrecision('Timbre Electronico SII');
            printCenteredPrecision('Verifique en www.sii.cl');
        } else {
            printCenteredPrecision('(Sin Timbre)');
        }
    } catch {
        printCenteredPrecision('(Error Timbre)');
    }

    encoder.newline(4).cut();
    return encoder.encode();
}

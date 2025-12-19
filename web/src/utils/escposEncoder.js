import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();

    // ==============================
    // CONSTANTES (80mm)
    // ==============================
    const PAPER_WIDTH_PX = 576;     // 80mm driver / hardware
    const TEXT_SAFE_PX   = 552;     // 72mm lógico para texto
    const LEFT_MARGIN_PX = 12;      // 1 char
    const CHAR_PX        = 12;

    const moveCursor = (px) => {
        const nL = px % 256;
        const nH = Math.floor(px / 256);
        return [0x1B, 0x24, nL, nH];
    };

    const printSeparator = () => {
        const chars = Math.floor(TEXT_SAFE_PX / CHAR_PX);
        encoder.text('-'.repeat(chars)).newline();
    };

    const printRight = (text, bold = false) => {
        const str = String(text);
        const px = LEFT_MARGIN_PX + TEXT_SAFE_PX - (str.length * CHAR_PX);
        if (bold) encoder.bold(true);
        encoder.raw(moveCursor(px)).text(str).newline();
        if (bold) encoder.bold(false);
    };

    const printCenter = (text, bold = false) => {
        const str = String(text).trim();
        const px = Math.floor((PAPER_WIDTH_PX - (str.length * CHAR_PX)) / 2);
        if (bold) encoder.bold(true);
        encoder.raw(moveCursor(px)).text(str).newline();
        if (bold) encoder.bold(false);
    };

    const printSplit = (left, right) => {
        encoder.raw(moveCursor(LEFT_MARGIN_PX)).text(left);
        const px = LEFT_MARGIN_PX + TEXT_SAFE_PX - (String(right).length * CHAR_PX);
        encoder.raw(moveCursor(px)).text(right).newline();
    };

    // ==============================
    // INIT SEGÚN MANUAL 80XX
    // ==============================
    encoder.initialize().codepage('cp858').align('left');

    // GS W -> ancho físico 80mm (576px)
    encoder.raw([0x1D, 0x57, 0x40, 0x02]);

    // ESC W -> área lógica de TEXTO (72mm)
    encoder.raw([
        0x1B, 0x57,
        LEFT_MARGIN_PX, 0x00,
        0x00, 0x00,
        TEXT_SAFE_PX & 0xFF, (TEXT_SAFE_PX >> 8) & 0xFF,
        0x00, 0x00
    ]);

    // ==============================
    // HEADER
    // ==============================
    printCenter(data.empresa.razonSocial || 'EMPRESA', true);
    printCenter(`RUT: ${data.empresa.rut || '-'}`);
    printCenter((data.empresa.direccion || 'Temuco').substring(0, 48));
    encoder.newline();

    // ==============================
    // INFO VENTA
    // ==============================
    const folio = data.venta.folio || data.venta.id_venta || '---';
    printSeparator();
    printCenter(`BOLETA N° ${folio}`, true);
    encoder.raw(moveCursor(LEFT_MARGIN_PX)).text(`FECHA: ${data.venta.fecha}`).newline();
    printSeparator();

    // ==============================
    // PRODUCTOS
    // ==============================
    printSplit('CANT DESCRIPCION', 'TOTAL');
    printSeparator();

    data.detalles.forEach(d => {
        const left = `${String(d.cantidad).padEnd(4)} ${(d.nombre || '').substring(0, 25)}`;
        printSplit(left, formatCLP(d.subtotal));
    });

    printSeparator();

    // ==============================
    // TOTALES
    // ==============================
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    printRight(`Neto: ${formatCLP(neto)}`);
    printRight(`IVA:  ${formatCLP(iva)}`);
    encoder.newline();
    printRight(`TOTAL: ${formatCLP(total)}`, true);

    // ==============================
    // TIMBRE
    // ==============================
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
            canvas.width = PAPER_WIDTH_PX;
            canvas.height = Math.ceil(img.height / 8) * 8;

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, (PAPER_WIDTH_PX - img.width) / 2, 0);

            encoder.align('center')
                   .image(canvas, PAPER_WIDTH_PX, canvas.height, 'atkinson')
                   .newline()
                   .align('left');

            printCenter('Timbre Electronico SII');
            printCenter('Verifique en www.sii.cl');
        } else {
            printCenter('(Sin Timbre)');
        }
    } catch {
        printCenter('(Error Timbre)');
    }

    encoder.newline(4).cut();
    return encoder.encode();
}

import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {

    // ==============================
    // INIT — 80mm / 48 columnas
    // ==============================
    const encoder = new ReceiptPrinterEncoder({
        language: 'esc-pos',
        columns: 48,
        feedBeforeCut: 4,
        newline: '\n'
    });

    encoder.initialize().codepage('cp858');

    // ==============================
    // HELPERS
    // ==============================
    const separator = () => {
        encoder.text('-'.repeat(48)).newline();
    };

    const right = (text, bold = false) => {
        // Espera texto tipo: "NETO: $12.345"
        const match = String(text).match(/^(.*?)(\$?\s*)([\d.,]+)/);
        if (!match) {
            encoder.align('left').text(text).newline();
            return;
        }

        const label = match[1];     // "NETO: "
        const value = match[3];     // "12.345"

        const VALUE_COL = 48;       // borde derecho
        const PESO_COL  = 48 - 12;  // $ 12 caracteres a la izquierda

        const valuePad = VALUE_COL - value.length;
        const pesoPad  = PESO_COL - 1;

        const line =
            ' '.repeat(pesoPad) + '$' +
            ' '.repeat(valuePad - pesoPad - 1) +
            value;

        encoder.align('left');
        if (bold) encoder.bold(true);
        encoder.text(line).newline();
        if (bold) encoder.bold(false);
    };

    const split = (left, rightText) => {
        const r = String(rightText);
        const l = left.substring(0, 48 - r.length - 1);
        const line = l.padEnd(48 - r.length - 1, ' ') + ' ' + r;
        encoder.text(line).newline();
    };

    const center = (text, bold = false) => {
        if (bold) encoder.bold(true);
        encoder.align('center').text(text).align('left').newline();
        if (bold) encoder.bold(false);
    };

    // =====================================================
    // ENCABEZADO LEGAL (CENTRADO)
    // =====================================================
    center(data.empresa?.razonSocial || 'EMPRESA', true);
    center(`R.U.T: ${data.empresa?.rut || '-'}`);
    center('BOLETA ELECTRÓNICA', true);
    center(`N° ${data.venta?.folio || data.venta?.id_venta || '---'}`);
    encoder.newline();

    center('SII - TEMUCO');
    separator();

    // =====================================================
    // DATOS EMPRESA (IZQUIERDA)
    // =====================================================
    encoder.text(`NOMBRE: ${data.empresa?.razonSocial || '-'}`).newline();

    if (data.empresa?.direccion)
        encoder.text(`DIRECCIÓN: ${data.empresa.direccion}`).newline();

    if (data.empresa?.telefono)
        encoder.text(`TELÉFONO: ${data.empresa.telefono}`).newline();

    encoder.text(`FECHA EMISIÓN: ${data.venta?.fecha || '-'}`).newline();

    // =====================================================
    // PRODUCTOS
    // =====================================================
    separator();
    split('CANT   DESCRIPCIÓN', 'VALOR');
    separator();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad).padEnd(6);
        const nombre = (d.nombre || '').substring(0, 30);
        const precio = new Intl.NumberFormat('es-CL').format(d.subtotal);
        split(`${cant} ${nombre}`, precio);
    });

    separator();

    // =====================================================
    // TOTALES (DERECHA)
    // =====================================================
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    right(`NETO: ${formatCLP(neto)}`);
    right(`IVA:  ${formatCLP(iva)}`);
    right(`TOTAL: ${formatCLP(total)}`, true);

    separator();

    // =====================================================
    // TIMBRE ELECTRÓNICO
    // =====================================================
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

            center('Timbre electrónico SII');
            center('Verifique documento en');
            center('www.sii.cl');
        } else {
            center('(Sin Timbre)');
        }
    } catch {
        center('(Error Timbre)');
    }

    encoder.cut();
    return encoder.encode();
}

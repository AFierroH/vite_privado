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

    encoder.initialize().codepage('cp858').align('left');

    // ==============================
    // HELPERS
    // ==============================
    const separator = () => {
        encoder.text('-'.repeat(48)).newline();
    };

    const right = (text, bold = false) => {
        const str = String(text);
        const line = ' '.repeat(48 - str.length) + str;
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
    encoder.newline();

    center('BOLETA ELECTRÓNICA', true);
    center(`N° ${data.venta?.folio || data.venta?.id_venta || '---'}`);
    encoder.newline();

    center('SII - TEMUCO');
    encoder.newline();

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
        const cant = String(d.cantidad).padEnd(4);
        const nombre = (d.nombre || '').substring(0, 30);
        const precio = formatCLP(d.subtotal);
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

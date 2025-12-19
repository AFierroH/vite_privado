import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {

    // ==============================
    // INIT — 80mm / 48 columnas
    // ==============================
    const encoder = new ReceiptPrinterEncoder({
        language: 'esc-pos',
        columns: 48,        // <<< CLAVE ABSOLUTA
        feedBeforeCut: 4,
        newline: '\n'
    });

    encoder.initialize().codepage('cp858').align('left');

    // ==============================
    // HELPERS (48 FIJO)
    // ==============================
    const printSeparator = () => {
        encoder.text('-'.repeat(48)).newline();
    };

    const printRight = (text, bold = false) => {
        const str = String(text);
        const line = ' '.repeat(48 - str.length) + str;
        if (bold) encoder.bold(true);
        encoder.text(line).newline();
        if (bold) encoder.bold(false);
    };

    const printSplit = (left, right) => {
        const r = String(right);
        const l = left.substring(0, 48 - r.length - 1);
        const line = l.padEnd(48 - r.length - 1, ' ') + ' ' + r;
        encoder.text(line).newline();
    };

    const printCenter = (text, bold = false) => {
        if (bold) encoder.bold(true);
        encoder.align('center').text(text).align('left').newline();
        if (bold) encoder.bold(false);
    };

    // ==============================
    // ENCABEZADO
    // ==============================
    printCenter(data.empresa.razonSocial || 'EMPRESA', true);
    printCenter(`RUT: ${data.empresa.rut || '-'}`);
    printCenter((data.empresa.direccion || 'Temuco').substring(0, 48));
    encoder.newline();

    // ==============================
    // INFO VENTA
    // ==============================
    const folioText = data.venta.folio || data.venta.id_venta || '---';

    printSeparator();
    printCenter(`BOLETA N° ${folioText}`, true);
    encoder.text(`FECHA: ${data.venta.fecha}`).newline();
    printSeparator();

    // ==============================
    // PRODUCTOS
    // ==============================
    printSplit('CANT DESCRIPCION', 'TOTAL');
    printSeparator();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const nombre = (d.nombre || '').substring(0, 25);
        const precio = new Intl.NumberFormat('es-CL').format(d.subtotal);
        printSplit(`${cant.padEnd(4)} ${nombre}`, precio);
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
    // TIMBRE (igual que antes)
    // ==============================
    encoder.newline();
    // (tu código de imagen va aquí sin cambios)

    encoder.cut();
    return encoder.encode();
}

import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();

    // --- CONSTANTES FÍSICAS (NO TOCAR) ---
    const PRINTER_WIDTH_PX = 576; // 72mm reales
    const CHAR_WIDTH_PX = 12;     // Ancho de 1 caracter Font A standard
    
    // Usamos 46 chars para la línea de seguridad (evita wraps accidentales)
    const SAFE_WIDTH = 46; 
    const SEPARATOR = '-'.repeat(SAFE_WIDTH);

    // --- HELPERS DE POSICIONAMIENTO ABSOLUTO (MAGIA PURA) ---
    
    // Mover cursor a una posición X absoluta
    const moveCursor = (pos) => {
        const nL = pos % 256;
        const nH = Math.floor(pos / 256);
        return [0x1B, 0x24, nL, nH]; // ESC $ nL nH
    };

    // Imprimir CENTRADO matemáticamente
    const printCentered = (text, isBold = false) => {
        const txtStr = String(text);
        // Calculamos ancho en píxeles del texto
        const textLenPx = txtStr.length * CHAR_WIDTH_PX * (isBold ? 1 : 1); // Asumimos mismo ancho bold/normal en Font A
        const pos = Math.max(0, Math.floor((PRINTER_WIDTH_PX - textLenPx) / 2));
        
        encoder.raw(moveCursor(pos));
        if(isBold) encoder.bold(true);
        encoder.text(txtStr);
        if(isBold) encoder.bold(false);
        encoder.newline();
    };

    // Imprimir DERECHA matemáticamente
    const printRight = (text, isBold = false) => {
        const txtStr = String(text);
        const textLenPx = txtStr.length * CHAR_WIDTH_PX;
        const pos = PRINTER_WIDTH_PX - textLenPx;
        
        encoder.raw(moveCursor(pos));
        if(isBold) encoder.bold(true);
        encoder.text(txtStr);
        if(isBold) encoder.bold(false);
        encoder.newline();
    };

    // Imprimir COLUMNAS (Izq......Der)
    const printSplit = (left, right) => {
        // Imprimir Izquierda (normal)
        encoder.raw(moveCursor(0)).text(left);
        
        // Imprimir Derecha (calculado)
        const rightLenPx = String(right).length * CHAR_WIDTH_PX;
        const pos = PRINTER_WIDTH_PX - rightLenPx;
        
        encoder.raw(moveCursor(pos)).text(right).newline();
    };


    // =================================================================
    // 1. INICIALIZACIÓN
    // =================================================================
    encoder
        .initialize()           
        .codepage('cp858');

    // Configuración Hardware
    encoder.raw([0x1d, 0x4c, 0x00, 0x00]); // GS L 0
    encoder.raw([0x1d, 0x57, 0x40, 0x02]); // GS W 576

    // =================================================================

    // 2. ENCABEZADO (Full Manual Centering)
    printCentered(data.empresa.razonSocial || 'EMPRESA', true);
    printCentered(`RUT: ${data.empresa.rut || '-'}`);
    printCentered((data.empresa.direccion || 'Temuco').substring(0, 48));
    encoder.newline();

    // 3. INFO VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    
    printCentered(SEPARATOR); // Línea centrada perfecta
    printCentered(`BOLETA N: ${folioText}`, true);
    encoder.raw(moveCursor(0)).text(`FECHA: ${data.venta.fecha}`).newline(); // Fecha a la izquierda
    printCentered(SEPARATOR);
    encoder.newline();

    // 4. PRODUCTOS (Cabecera manual)
    // "CANT DESCRIPCION" a la izq, "TOTAL" a la der
    printSplit('CANT DESCRIPCION', 'TOTAL');
    printCentered(SEPARATOR);

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);
        const nombre = (d.nombre || '').substring(0, 25); // Cortamos nombre por seguridad

        // Formato: "1   Coca Cola"
        const leftPart = `${cant.padEnd(4)} ${nombre}`;
        
        printSplit(leftPart, precio);
    });

    printCentered(SEPARATOR);

    // 5. TOTALES (Usando printSplit para alinear extremos)
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    printRight(`Neto: ${formatCLP(neto)}`);
    printRight(`IVA:  ${formatCLP(iva)}`);
    
    encoder.newline();

    // TOTAL FINAL GRANDE
    // Truco: Para size 2x, el ancho del caracter es 24px (12*2)
    const txtTotal = `TOTAL: ${formatCLP(total)}`;
    const totalLenPx = txtTotal.length * (CHAR_WIDTH_PX * 2); 
    const posTotal = PRINTER_WIDTH_PX - totalLenPx;

    encoder.raw(moveCursor(posTotal))
           .size('2x').bold(true).text(txtTotal).bold(false).size('normal')
           .newline(2);

    // 6. TIMBRE
    try {
        let imgSource = null;
        if (preGeneratedImg) {
             imgSource = preGeneratedImg.startsWith('data:') ? preGeneratedImg : `data:image/png;base64,${preGeneratedImg}`;
        } else if (timbreXml) {
            const tedContent = extraerTedDelXml(timbreXml);
            if (tedContent) imgSource = await generarPdf417Base64(tedContent);
        }

        if (imgSource) {
            const img = new Image();
            img.src = imgSource;
            await new Promise(r => { img.onload = r; img.onerror = r; });

            // Imagen centrada a 576px
            const canvas = document.createElement('canvas');
            canvas.width = 576;
            canvas.height = Math.ceil(img.height / 8) * 8;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 576, canvas.height);
            // Centrar horizontalmente
            ctx.drawImage(img, (576 - img.width) / 2, 0);

            encoder.image(canvas, 576, canvas.height, 'atkinson').newline();
            
            printCentered('Timbre Electronico SII');
            printCentered('Verifique en www.sii.cl');
        } else {
            printCentered('(Sin Timbre)');
        }
    } catch (e) {
        printCentered('(Error Timbre)');
    }

    encoder.newline(4).cut();
    return encoder.encode();
}
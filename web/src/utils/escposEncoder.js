import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();

    // --- FÍSICA: 576px (72mm) ---
    const PRINTER_WIDTH_PX = 576; 
    const CHAR_WIDTH_PX = 12;     

    // --- HELPERS DE PRECISIÓN (ESC $) ---

    const moveCursor = (pos) => {
        const nL = pos % 256;
        const nH = Math.floor(pos / 256);
        return [0x1B, 0x24, nL, nH]; 
    };

    // 1. SEPARADOR "FULL DERECHA" (Estrategia Dividida)
    // Imprimimos 47 guiones alineados a la derecha (Pixel 576).
    // Dejamos 1 caracter vacío a la izquierda (12px) como margen visual.
    const printSeparatorRight = () => {
        // Total: 47 guiones (ancho 564px). Inicio: Pixel 12. Fin: Pixel 576.
        // Lo partimos en 2 tandas para evitar el "Auto-Wrap" de la impresora.
        
        const part1 = '-'.repeat(24); // 24 chars
        const part2 = '-'.repeat(23); // 23 chars
        
        // Tanda 1: Empieza en el pixel 12 (576 - 564)
        encoder.raw(moveCursor(12)).text(part1);
        
        // Tanda 2: Empieza justo donde termina la anterior (12 + 24*12 = 300)
        encoder.raw(moveCursor(300)).text(part2).newline();
    };

    // 2. DERECHA EXACTA (Neto, IVA, Total)
    const printRightPrecision = (text, isBold = false) => {
        const str = String(text);
        const textLen = str.length * CHAR_WIDTH_PX;
        const pos = PRINTER_WIDTH_PX - textLen;
        
        if(isBold) encoder.bold(true);
        encoder.raw(moveCursor(pos)).text(str).newline();
        if(isBold) encoder.bold(false);
    };

    // 3. CENTRADO (Calculado al píxel)
    const printCenteredPrecision = (text, isBold = false) => {
        const str = String(text).trim();
        const textLen = str.length * CHAR_WIDTH_PX;
        const pos = Math.floor((PRINTER_WIDTH_PX - textLen) / 2);
        
        if(isBold) encoder.bold(true);
        encoder.raw(moveCursor(pos)).text(str).newline();
        if(isBold) encoder.bold(false);
    };

    // 4. DOS COLUMNAS (Estilo Productos)
    const printSplitPrecision = (left, right) => {
        // Izquierda: Empezamos un poquito adentro (Pixel 4) para estética
        encoder.raw(moveCursor(4)).text(left);
        
        // Derecha: Pegado al final (Pixel 576)
        const strRight = String(right);
        const posRight = PRINTER_WIDTH_PX - (strRight.length * CHAR_WIDTH_PX);
        
        encoder.raw(moveCursor(posRight)).text(strRight).newline();
    };

    // =================================================================
    // 1. INICIALIZACIÓN
    // =================================================================
    encoder
        .initialize()
        .codepage('cp858')
        .align('left'); 

    // Hardware Init (Habilitar ancho completo)
    encoder.raw([0x1d, 0x4c, 0x00, 0x00]); // GS L 0
    encoder.raw([0x1d, 0x57, 0x40, 0x02]); // GS W 576

    // =================================================================

    // 2. ENCABEZADO
    printCenteredPrecision(data.empresa.razonSocial || 'EMPRESA', true);
    printCenteredPrecision(`RUT: ${data.empresa.rut || '-'}`);
    printCenteredPrecision((data.empresa.direccion || 'Temuco').substring(0, 48));
    encoder.newline();

    // 3. INFO VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    
    printSeparatorRight(); // <--- SEPARADOR ALINEADO A LA DERECHA
    printCenteredPrecision(`BOLETA N: ${folioText}`, true);
    // Fecha alineada visualmente con el inicio del separador (Pixel 12)
    encoder.raw(moveCursor(12)).text(`FECHA: ${data.venta.fecha}`).newline();
    printSeparatorRight();
    encoder.newline();

    // 4. PRODUCTOS
    printSplitPrecision('CANT DESCRIPCION', 'TOTAL');
    printSeparatorRight();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);
        const nombre = (d.nombre || '').substring(0, 25);
        
        const leftPart = `${cant.padEnd(4)} ${nombre}`;
        printSplitPrecision(leftPart, precio);
    });

    printSeparatorRight();

    // 5. TOTALES
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    printRightPrecision(`Neto: ${formatCLP(neto)}`);
    printRightPrecision(`IVA:  ${formatCLP(iva)}`);
    encoder.newline();

    // 6. TOTAL FINAL
    printRightPrecision(`TOTAL: ${formatCLP(total)}`, true);

    // 7. TIMBRE
    encoder.newline();
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

            const canvas = document.createElement('canvas');
            canvas.width = 576;
            canvas.height = Math.ceil(img.height / 8) * 8;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 576, canvas.height);
            ctx.drawImage(img, (576 - img.width) / 2, 0);

            encoder.align('center') 
                   .image(canvas, 576, canvas.height, 'atkinson')
                   .newline();
            
            encoder.align('left'); 
            printCenteredPrecision('Timbre Electronico SII');
            printCenteredPrecision('Verifique en www.sii.cl');
        } else {
            printCenteredPrecision('(Sin Timbre)');
        }
    } catch (e) {
        printCenteredPrecision('(Error Timbre)');
    }

    encoder.newline(4).cut();
    return encoder.encode();
}
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();

    // --- FÍSICA: 576px / 12px = 48 Caracteres Exactos ---
    const PRINTER_WIDTH_PX = 576; 
    const CHAR_WIDTH_PX = 12;     

    // --- HELPERS DE PUNTERO ABSOLUTO (ESC $) ---
    // Esta es la herramienta que usaremos para TODO.

    const moveCursor = (pos) => {
        const nL = pos % 256;
        const nH = Math.floor(pos / 256);
        return [0x1B, 0x24, nL, nH]; 
    };

    // 1. SEPARADOR HACKEADO (Dividir y Vencerás)
    // Imprime 24 guiones, mueve el cursor, e imprime los otros 24.
    // Esto engaña al firmware para que no haga wrap automático.
    const printFullSeparator = () => {
        const halfLine = '-'.repeat(24);
        
        // Parte 1: Inicio (Pixel 0)
        encoder.raw(moveCursor(0)).text(halfLine);
        
        // Parte 2: Mitad (Pixel 288)
        encoder.raw(moveCursor(288)).text(halfLine).newline();
    };

    // 2. CENTRADO EXACTO (Calculado en Píxeles)
    const printCenteredPrecision = (text, isBold = false) => {
        const str = String(text).trim();
        const textLen = str.length * CHAR_WIDTH_PX;
        const pos = Math.floor((PRINTER_WIDTH_PX - textLen) / 2);
        
        if(isBold) encoder.bold(true);
        encoder.raw(moveCursor(pos)).text(str).newline();
        if(isBold) encoder.bold(false);
    };

    // 3. DERECHA EXACTA (Igual que los precios)
    const printRightPrecision = (text, isBold = false) => {
        const str = String(text);
        const textLen = str.length * CHAR_WIDTH_PX;
        const pos = PRINTER_WIDTH_PX - textLen;
        
        if(isBold) encoder.bold(true);
        encoder.raw(moveCursor(pos)).text(str).newline();
        if(isBold) encoder.bold(false);
    };

    // 4. DOS COLUMNAS EXACTAS
    const printSplitPrecision = (left, right) => {
        // Izquierda: Pixel 0
        encoder.raw(moveCursor(0)).text(left);
        
        // Derecha: Pixel calculado
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
        .align('left'); // <--- IMPORTANTE: Base izquierda para que ESC $ funcione

    // Habilitar ancho completo 80mm
    encoder.raw([0x1d, 0x4c, 0x00, 0x00]); // GS L 0
    encoder.raw([0x1d, 0x57, 0x40, 0x02]); // GS W 576

    // =================================================================

    // 2. ENCABEZADO
    printCenteredPrecision(data.empresa.razonSocial || 'EMPRESA', true);
    printCenteredPrecision(`RUT: ${data.empresa.rut || '-'}`);
    // Recorte seguro para centrado
    printCenteredPrecision((data.empresa.direccion || 'Temuco').substring(0, 48));
    encoder.newline();

    // 3. INFO VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    
    printFullSeparator(); // <--- EL SEPARADOR HACKEADO
    printCenteredPrecision(`BOLETA N: ${folioText}`, true);
    encoder.raw(moveCursor(0)).text(`FECHA: ${data.venta.fecha}`).newline();
    printFullSeparator();
    encoder.newline();

    // 4. PRODUCTOS
    printSplitPrecision('CANT DESCRIPCION', 'TOTAL');
    printFullSeparator();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);
        const nombre = (d.nombre || '').substring(0, 25);
        
        const leftPart = `${cant.padEnd(4)} ${nombre}`;
        printSplitPrecision(leftPart, precio);
    });

    printFullSeparator();

    // 5. TOTALES (Neto/IVA a la derecha)
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    printRightPrecision(`Neto: ${formatCLP(neto)}`);
    printRightPrecision(`IVA:  ${formatCLP(iva)}`);
    
    encoder.newline();

    // 6. TOTAL FINAL (Normal, Bold, Derecha Precisa)
    // Aquí usamos el mismo método que los precios para que quede alineado IGUAL.
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

            // Imagen
            const canvas = document.createElement('canvas');
            canvas.width = 576;
            canvas.height = Math.ceil(img.height / 8) * 8;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 576, canvas.height);
            ctx.drawImage(img, (576 - img.width) / 2, 0);

            encoder.align('center') // Para imágenes usamos align nativo, es más seguro
                   .image(canvas, 576, canvas.height, 'atkinson')
                   .newline();
            
            encoder.align('left'); // Volvemos a left para el texto
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
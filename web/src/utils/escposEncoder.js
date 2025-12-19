import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();

    // --- CONSTANTES FÍSICAS ---
    const PRINTER_WIDTH_PX = 576; // 72mm reales
    const CHAR_WIDTH_PX = 12;     // Ancho Font A
    
    // Bajamos a 44 guiones para que se vea bien centrado y con margen seguro
    const SAFE_WIDTH = 48; 
    const SEPARATOR = '-'.repeat(SAFE_WIDTH);

    // --- HELPERS DE POSICIONAMIENTO (CORREGIDOS) ---
    
    const moveCursor = (pos) => {
        const nL = pos % 256;
        const nH = Math.floor(pos / 256);
        return [0x1B, 0x24, nL, nH]; // ESC $
    };

    // Imprimir CENTRADO (Estilo -> Movimiento -> Texto)
    const printCentered = (text, isBold = false) => {
        const txtStr = String(text);
        const textLenPx = txtStr.length * CHAR_WIDTH_PX;
        const pos = Math.max(0, Math.floor((PRINTER_WIDTH_PX - textLenPx) / 2));
        
        // 1. Estilo
        if(isBold) encoder.bold(true);
        
        // 2. Movimiento (ESC $)
        encoder.raw(moveCursor(pos));
        
        // 3. Texto
        encoder.text(txtStr);
        
        // 4. Salto de línea
        encoder.newline();
        
        // 5. Reset Estilo (Después del salto para evitar errores)
        if(isBold) encoder.bold(false);
    };

    // Imprimir DERECHA (Estilo -> Movimiento -> Texto)
    const printRight = (text, isBold = false) => {
        const txtStr = String(text);
        const textLenPx = txtStr.length * CHAR_WIDTH_PX;
        const pos = PRINTER_WIDTH_PX - textLenPx;
        
        if(isBold) encoder.bold(true);
        encoder.raw(moveCursor(pos));
        encoder.text(txtStr);
        encoder.newline();
        if(isBold) encoder.bold(false);
    };

    // Imprimir DOS COLUMNAS (Izq...Der)
    const printSplit = (left, right) => {
        // Izquierda (Posición 0)
        encoder.raw(moveCursor(0)).text(left);
        
        // Derecha (Calculado)
        const rightLenPx = String(right).length * CHAR_WIDTH_PX;
        const pos = PRINTER_WIDTH_PX - rightLenPx;
        
        encoder.raw(moveCursor(pos)).text(right).newline();
    };

    // =================================================================
    // 1. INICIALIZACIÓN
    // =================================================================
    encoder
        .initialize()           
        .codepage('cp858')
        .align('left'); // <--- CRÍTICO: Obligatorio para que ESC $ funcione bien

    // Configuración Hardware
    encoder.raw([0x1d, 0x4c, 0x00, 0x00]); // GS L 0
    encoder.raw([0x1d, 0x57, 0x40, 0x02]); // GS W 576

    // =================================================================

    // 2. ENCABEZADO
    printCentered(data.empresa.razonSocial || 'EMPRESA', true);
    printCentered(`RUT: ${data.empresa.rut || '-'}`);
    // Cortamos dirección a 40 chars para asegurar centrado
    printCentered((data.empresa.direccion || 'Temuco').substring(0, 40));
    encoder.newline();

    // 3. INFO VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    
    printCentered(SEPARATOR);
    printCentered(`BOLETA N: ${folioText}`, true);
    encoder.raw(moveCursor(0)).text(`FECHA: ${data.venta.fecha}`).newline();
    printCentered(SEPARATOR);
    encoder.newline();

    // 4. PRODUCTOS
    printSplit('CANT DESCRIPCION', 'TOTAL');
    printCentered(SEPARATOR);

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);
        const nombre = (d.nombre || '').substring(0, 22); // Nombre más corto para seguridad

        const leftPart = `${cant.padEnd(4)} ${nombre}`;
        printSplit(leftPart, precio);
    });

    printCentered(SEPARATOR);

    // 5. TOTALES
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    printRight(`Neto: ${formatCLP(neto)}`);
    printRight(`IVA:  ${formatCLP(iva)}`);
    
    encoder.newline();

    const txtTotal = `TOTAL: ${formatCLP(total)}`;
    
    // Cálculo especial: 24px por letra (12px * 2 de escala)
    const totalLenPx = txtTotal.length * 24; 
    const posTotal = PRINTER_WIDTH_PX - totalLenPx;

    encoder
        .size('2x')       // 1. Activar Tamaño Gigante
        .bold(true)       // 2. Activar Negrita
        .raw(moveCursor(posTotal)) // 3. Mover cursor al punto exacto
        .text(txtTotal)   // 4. Escribir
        .newline()        // 5. Saltar línea
        .bold(false)      // 6. Resetear Negrita
        .size('normal')   // 7. Resetear Tamaño
        .newline(1);
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

            // Centrar imagen manualmente
            const canvas = document.createElement('canvas');
            canvas.width = 576;
            canvas.height = Math.ceil(img.height / 8) * 8;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 576, canvas.height);
            ctx.drawImage(img, (576 - img.width) / 2, 0);

            // Centramos la imagen usando el método de la librería (aquí es seguro)
            encoder.align('center')
                   .image(canvas, 576, canvas.height, 'atkinson')
                   .newline();
            
            // Texto del timbre centrado manualmente para ser consistentes
            encoder.align('left'); // Volvemos a left para usar printCentered
            printCentered('Timbre Electronico SII');
            printCentered('Verifique en www.sii.cl');
        } else {
            encoder.align('left');
            printCentered('(Sin Timbre)');
        }
    } catch (e) {
        encoder.align('left');
        printCentered('(Error Timbre)');
    }

    encoder.newline(4).cut();
    return encoder.encode();
}
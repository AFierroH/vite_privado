import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();

    // --- FÍSICA PURA (576px / 12px = 48 Caracteres) ---
    const PRINTER_WIDTH_PX = 576; 
    const CHAR_WIDTH_PX = 12;     
    
    // --- HELPERS DE PUNTERO (ESC $) ---

    const moveCursor = (pos) => {
        const nL = pos % 256;
        const nH = Math.floor(pos / 256);
        return [0x1B, 0x24, nL, nH]; // El comando mágico
    };

    // 1. SEPARADOR A LA FUERZA (Pointer 0 -> 48 Guiones)
    const printFullSeparator = () => {
        const line = '-'.repeat(48); // 48 * 12 = 576px (Full Ancho)
        // Forzamos el inicio en el pixel 0 absoluto
        encoder.raw(moveCursor(0)).text(line).newline();
    };

    // 2. DERECHA MATEMÁTICA (Pointer -> Texto)
    // Sirve para Neto, IVA y TOTAL
    const printRightPrecision = (text, isBold = false) => {
        const str = String(text);
        // Calculamos dónde debe empezar para terminar exacto en 576
        const pos = PRINTER_WIDTH_PX - (str.length * CHAR_WIDTH_PX);
        
        if(isBold) encoder.bold(true);
        encoder.raw(moveCursor(pos)).text(str).newline();
        if(isBold) encoder.bold(false);
    };

    // 3. CENTRADO MATEMÁTICO (Pointer -> Texto)
    const printCenteredPrecision = (text, isBold = false) => {
        const str = String(text).trim();
        const textLen = str.length * CHAR_WIDTH_PX;
        const pos = Math.floor((PRINTER_WIDTH_PX - textLen) / 2);
        
        if(isBold) encoder.bold(true);
        encoder.raw(moveCursor(pos)).text(str).newline();
        if(isBold) encoder.bold(false);
    };

    // 4. DOS COLUMNAS MATEMÁTICAS
    const printSplitPrecision = (left, right) => {
        // Izquierda: Pointer 0
        encoder.raw(moveCursor(0)).text(left);
        
        // Derecha: Pointer calculado
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
        .align('left'); // Base izquierda obligatoria

    // Hacks de Hardware (Habilitar 576px)
    encoder.raw([0x1d, 0x4c, 0x00, 0x00]); // GS L 0
    encoder.raw([0x1d, 0x57, 0x40, 0x02]); // GS W 576

    // =================================================================

    // 2. ENCABEZADO
    printCenteredPrecision(data.empresa.razonSocial || 'EMPRESA', true);
    printCenteredPrecision(`RUT: ${data.empresa.rut || '-'}`);
    // Recortamos a 48 chars para que no rompa el cálculo
    printCenteredPrecision((data.empresa.direccion || 'Temuco').substring(0, 48));
    encoder.newline();

    // 3. INFO VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    
    printFullSeparator(); // <--- AQUI USAMOS EL NUEVO SEPARADOR
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
        const nombre = (d.nombre || '').substring(0, 25); // Ajuste seguro
        
        const leftPart = `${cant.padEnd(4)} ${nombre}`;
        printSplitPrecision(leftPart, precio);
    });

    printFullSeparator();

    // 5. TOTALES (Todos usan la misma lógica del Neto que funcionaba)
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    printRightPrecision(`Neto: ${formatCLP(neto)}`);
    printRightPrecision(`IVA:  ${formatCLP(iva)}`);
    
    encoder.newline();

    // 6. TOTAL FINAL (Normal, Bold, Derecha Precisa)
    printRightPrecision(`TOTAL: ${formatCLP(total)}`, true);

    // 7. PIE DE PAGINA
    encoder.newline();
    printCenteredPrecision('Timbre Electronico SII');
    printCenteredPrecision('Verifique en www.sii.cl');
    
    if (!timbreXml) {
        printCenteredPrecision('(Sin Timbre)');
    }

    encoder.newline(4).cut();
    return encoder.encode();
}
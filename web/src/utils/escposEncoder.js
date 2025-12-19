import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();

    // --- CONSTANTES ---
    const PRINTER_WIDTH_PX = 576; // 72mm reales (Ancho físico XPrinter)
    const CHAR_WIDTH_PX = 12;     // Ancho de 1 caracter Normal (Font A)
    const BIG_CHAR_WIDTH_PX = 24; // Ancho de 1 caracter Gigante (Font A x2)
    
    // Separador: Usamos 48 si confías en tu impresora, o 46 para margen de seguridad.
    // Con 576px configurados, 48 deberían caber exactos.
    const SEPARATOR = '-'.repeat(48); 

    // --- HELPERS DE POSICIONAMIENTO ABSOLUTO (ESC $) ---

    const moveCursor = (pos) => {
        const nL = pos % 256;
        const nH = Math.floor(pos / 256);
        return [0x1B, 0x24, nL, nH]; // Comando: Mover cursor a píxel X
    };

    // 1. Derecha Precisa (Para texto Normal)
    const printRightPrecision = (text) => {
        const str = String(text);
        const textLen = str.length * CHAR_WIDTH_PX;
        const pos = PRINTER_WIDTH_PX - textLen;
        
        encoder.raw(moveCursor(pos)).text(str).newline();
    };

    // 2. Derecha Precisa GIGANTE (Para el TOTAL)
    const printRightBig = (text) => {
        const str = String(text);
        const textLen = str.length * BIG_CHAR_WIDTH_PX; // Calculamos con ancho doble
        const pos = PRINTER_WIDTH_PX - textLen;

        // IMPORTANTE: El orden evita el error "Changing fonts in middle of line"
        encoder.size('2x')        // 1. Cambiar tamaño
               .bold(true)        // 2. Poner negrita
               .raw(moveCursor(pos)) // 3. Mover cursor (ESC $)
               .text(str)         // 4. Escribir
               .newline()         // 5. Terminar línea
               .size('normal')    // 6. Resetear
               .bold(false);
    };

    // 3. Centrado Seguro (Espacios)
    const printCenteredSafe = (text, isBold = false) => {
        const str = String(text).trim();
        // 48 columnas disponibles
        const padLeft = Math.max(0, Math.floor((48 - str.length) / 2));
        if(isBold) encoder.bold(true);
        encoder.text(' '.repeat(padLeft) + str).newline();
        if(isBold) encoder.bold(false);
    };

    // 4. Dos Columnas (Espacios)
    const printSplitSafe = (left, right) => {
        const strLeft = String(left).substring(0, 24);
        const strRight = String(right);
        // Rellenar el medio con espacios
        const spaces = 48 - strLeft.length - strRight.length;
        encoder.text(strLeft + ' '.repeat(Math.max(1, spaces)) + strRight).newline();
    };

    // =================================================================
    // 1. INICIALIZACIÓN
    // =================================================================
    encoder
        .initialize()
        .codepage('cp858')
        .align('left'); // Base izquierda obligatoria para ESC $

    // Configuración Hardware (Esto habilita los 80mm reales)
    encoder.raw([0x1d, 0x4c, 0x00, 0x00]); // GS L 0 (Margen Izq 0)
    encoder.raw([0x1d, 0x57, 0x40, 0x02]); // GS W 576 (Ancho 72mm/576px)

    // =================================================================

    // 2. ENCABEZADO
    printCenteredSafe(data.empresa.razonSocial || 'EMPRESA', true);
    printCenteredSafe(`RUT: ${data.empresa.rut || '-'}`);
    printCenteredSafe((data.empresa.direccion || 'Temuco').substring(0, 48));
    encoder.newline();

    // 3. INFO VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    
    printCenteredSafe(SEPARATOR);
    printCenteredSafe(`BOLETA N: ${folioText}`, true);
    encoder.text(`FECHA: ${data.venta.fecha}`).newline();
    printCenteredSafe(SEPARATOR);
    encoder.newline();

    // 4. PRODUCTOS
    printSplitSafe('CANT DESCRIPCION', 'TOTAL');
    printCenteredSafe(SEPARATOR);

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);
        const nombre = (d.nombre || '').substring(0, 22);
        
        const leftPart = `${cant.padEnd(4)} ${nombre}`;
        printSplitSafe(leftPart, precio);
    });

    printCenteredSafe(SEPARATOR);

    // 5. TOTALES (Neto/IVA a la derecha con ESC $)
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    printRightPrecision(`Neto: ${formatCLP(neto)}`);
    printRightPrecision(`IVA:  ${formatCLP(iva)}`);
    
    encoder.newline();

    // 6. TOTAL GIGANTE (A la derecha con ESC $)
    const txtTotal = `TOTAL: ${formatCLP(total)}`;
    printRightBig(txtTotal);

    encoder.newline();

    // 7. PIE DE PAGINA (Solo Texto)
    printCenteredSafe('Timbre Electronico SII');
    printCenteredSafe('Verifique en www.sii.cl');
    
    if (!timbreXml) {
        printCenteredSafe('(Sin Timbre)');
    }

    encoder.newline(4).cut();
    return encoder.encode();
}
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new ReceiptPrinterEncoder();

    // --- CONSTANTES ---
    const WIDTH_NORMAL = 48; // 48 caracteres (Font A)
    const WIDTH_BIG = 24;    // 24 caracteres (Font A x2)
    
    // Separador seguro (44 chars para evitar saltos de línea accidentales)
    const SEPARATOR = '-'.repeat(44);

    // --- HELPERS SEGUROS ---

    // 1. Centrar con espacios (Más seguro que ESC $ para encabezados)
    const printCenteredSafe = (text, isBold = false) => {
        const str = String(text).trim();
        const padLeft = Math.max(0, Math.floor((WIDTH_NORMAL - str.length) / 2));
        
        if(isBold) encoder.bold(true);
        encoder.text(' '.repeat(padLeft) + str).newline();
        if(isBold) encoder.bold(false);
    };

    // 2. Derecha con espacios (Para el Total Gigante)
    const printRightSafeBig = (text) => {
        const str = String(text).trim();
        // Rellenamos hasta 24 caracteres (ancho en modo gigante)
        const padded = str.padStart(WIDTH_BIG, ' '); 
        
        encoder.size('2x')
               .bold(true)
               .text(padded)
               .newline()
               .bold(false)
               .size('normal')
               .newline(1);
    };

    // 3. Derecha con ESC $ (Para Neto/IVA, ya que confirmaste que funciona)
    const PRINTER_WIDTH_PX = 576;
    const CHAR_WIDTH_PX = 12;
    const moveCursor = (pos) => {
        const nL = pos % 256;
        const nH = Math.floor(pos / 256);
        return [0x1B, 0x24, nL, nH];
    };
    
    const printRightPrecision = (text) => {
        const str = String(text);
        const pos = PRINTER_WIDTH_PX - (str.length * CHAR_WIDTH_PX);
        encoder.raw(moveCursor(pos)).text(str).newline();
    };

    // 4. Dos Columnas (Espacios)
    const printSplitSafe = (left, right) => {
        const strLeft = String(left).substring(0, 24);
        const strRight = String(right);
        const spaces = WIDTH_NORMAL - strLeft.length - strRight.length;
        encoder.text(strLeft + ' '.repeat(Math.max(1, spaces)) + strRight).newline();
    };

    // =================================================================
    // 1. INICIALIZACIÓN
    // =================================================================
    encoder
        .initialize()
        .codepage('cp858')
        .align('left'); // Base izquierda para que funcionen los espacios

    // Hacks de Hardware
    encoder.raw([0x1d, 0x4c, 0x00, 0x00]); // Margen Izq 0
    encoder.raw([0x1d, 0x57, 0x40, 0x02]); // Ancho 576

    // =================================================================

    // 2. ENCABEZADO (Usando espacios)
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
        
        // Armamos la parte izquierda "1   CocaCola"
        const leftPart = `${cant.padEnd(4)} ${nombre}`;
        printSplitSafe(leftPart, precio);
    });

    printCenteredSafe(SEPARATOR);

    // 5. TOTALES (Neto/IVA con tu método que funcionaba)
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    printRightPrecision(`Neto: ${formatCLP(neto)}`);
    printRightPrecision(`IVA:  ${formatCLP(iva)}`);
    
    encoder.newline();

    // 6. TOTAL GIGANTE (Con Padding de espacios, infalible)
    const txtTotal = `TOTAL: ${formatCLP(total)}`;
    printRightSafeBig(txtTotal);

    // 7. PIE DE PAGINA (Solo Texto, sin PDF417)
    printCenteredSafe('Timbre Electronico SII');
    printCenteredSafe('Verifique en www.sii.cl');
    
    if (!timbreXml) {
        printCenteredSafe('(Sin Timbre)');
    }

    encoder.newline(4).cut();
    return encoder.encode();
}
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

/**
 * Genera comandos ESC/POS para ticket térmico
 * @param {Object} printData - Datos de la venta
 * @param {string} timbreXml - XML del TED (Timbre Electrónico SII)
 * @returns {Uint8Array} - Bytes RAW para imprimir
 */
export function generarTicketEscPos(printData, timbreXml) {
    const encoder = new ReceiptPrinterEncoder({
        language: 'esc-pos'
    });
    
    const folio = String(printData.venta.id_venta || '---').padStart(10, '0');
    
    try {
        encoder
            .initialize()
            .align('center')
            .bold(true).width(2).height(2)
            .line(printData.empresa.razonSocial || 'EMPRESA')
            .width(1).height(1).bold(false)
            .line(`RUT: ${printData.empresa.rut || '---'}`)
            .line(printData.empresa.direccion || 'Dirección')
            .newline()
            .line('BOLETA ELECTRONICA')
            .newline();
        
        // Código de barras del folio (opcional, puede fallar en algunas impresoras)
        try {
            encoder.barcode(folio, 'code128', 50);
        } catch {
            encoder.bold(true).line(`Folio: ${folio}`).bold(false);
        }
        
        encoder
            .newline()
            .align('left')
            .line(`Fecha: ${printData.venta.fecha || new Date().toLocaleString()}`)
            .line('='.repeat(48));
        
        // Encabezado tabla
        encoder.line('CANT  ITEM                          TOTAL');
        encoder.line('-'.repeat(48));
        
        // Detalles de productos
        printData.detalles.forEach(det => {
            const nombre = (det.nombre || 'Producto').substring(0, 25).padEnd(25);
            const qty = String(det.cantidad).padStart(4);
            const subtotal = formatPrice(det.subtotal).padStart(12);
            
            encoder.line(`${qty}  ${nombre} ${subtotal}`);
            
            // Línea adicional con precio unitario (opcional)
            const precioUnit = formatPrice(det.precio_unitario).padStart(12);
            encoder.line(`      ${precioUnit} c/u`);
        });
        
        encoder.line('='.repeat(48));
        
        // Totales
        const total = printData.total || 0;
        const neto = Math.round(total / 1.19);
        const iva = total - neto;
        
        encoder
            .align('right')
            .line(`Neto:  ${formatPrice(neto)}`)
            .line(`IVA:   ${formatPrice(iva)}`)
            .bold(true).width(2).height(2)
            .line(`TOTAL: ${formatPrice(total)}`)
            .width(1).height(1).bold(false)
            .newline();
        
        // NOTA: El PDF417 NO va aquí, se enviará como imagen separada en QZ Tray
        encoder
            .align('center')
            .line('Timbre Electronico SII')
            .line('(Ver codigo de barras abajo)')
            .newline()
            .line('Verifique en www.sii.cl')
            .newline()
            .newline()
            .newline()
            .cut('partial');
        
        return encoder.encode();
        
    } catch (err) {
        console.error('Error generando ticket ESC/POS:', err);
        throw err;
    }
}

function formatPrice(val) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0
    }).format(val || 0);
}
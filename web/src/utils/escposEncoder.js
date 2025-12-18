import EscPosEncoder from 'esc-pos-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new EscPosEncoder();
    
    // CAMBIO 1: Usamos 42 para que el "bloque" de texto se vea centrado visualmente.
    // Aunque la impresora soporte 48, 42 deja márgenes iguales a izquierda y derecha.
    const WIDTH = 56; 
    const SEPARATOR = '-'.repeat(WIDTH);

    // Helpers manuales solo para el cuerpo de la boleta
    const centerText = (txt) => {
        const str = String(txt || '').substring(0, WIDTH);
        const padding = Math.max(0, Math.floor((WIDTH - str.length) / 2));
        return ' '.repeat(padding) + str;
    };

    // 1. INICIALIZACIÓN
    encoder.initialize().codepage('cp858').align('left');

    // 2. ENCABEZADO (Centrado nativo funciona mejor para titulos)
    encoder.align('center')
           .bold(true).text(data.empresa.razonSocial || 'EMPRESA').bold(false).newline()
           .text(`RUT: ${data.empresa.rut || '-'}`).newline()
           .text((data.empresa.direccion || 'Temuco').substring(0, WIDTH)).newline(2)
           .align('left'); // Volvemos a izquierda

    // 3. INFO VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    
    // Aquí usamos nuestros helpers para centrar el bloque de texto de 42 chars
    encoder.text(centerText(SEPARATOR)).newline()
           .align('center') // Centramos título de boleta
           .bold(true).text(`BOLETA N: ${folioText}`).bold(false).newline()
           .align('left')   // Volvemos
           .text(centerText(`FECHA: ${data.venta.fecha}`)).newline()
           .text(centerText(SEPARATOR)).newline(2);

    // 4. PRODUCTOS (Calculados a mano sobre 42 chars para consistencia)
    encoder.text('CANT DESCRIPCION'.padEnd(WIDTH - 10) + 'TOTAL').newline()
           .text(SEPARATOR).newline();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);
        
        const colCantW = 4;
        const colPrecioW = precio.length; 
        const colNombreW = WIDTH - colCantW - colPrecioW - 1; 

        let nombre = (d.nombre || '').substring(0, colNombreW);
        const c = cant.padEnd(colCantW, ' ');
        const n = nombre.padEnd(colNombreW, ' ');
        
        encoder.text(`${c}${n}${precio}`).newline();
    });

    encoder.text(SEPARATOR).newline();

    // 5. TOTALES (AQUÍ ESTÁ LA MAGIA: ALINEACIÓN NATIVA)
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;
    
    // CAMBIO 2: Usamos .align('right') REAL.
    // Esto obliga a la impresora a pegar el texto al borde físico derecho.
    encoder.align('right'); 
    
    encoder.text(`Neto: ${formatCLP(neto)}`).newline()
           .text(`IVA:  ${formatCLP(iva)}`).newline();

    // 6. TOTAL FINAL
    encoder.size('2x') 
           .bold(true)
           .text(`TOTAL: ${formatCLP(total)}`)
           .newline()
           .bold(false)
           .size('normal')
           .newline(1);
    
    encoder.align('left'); // Restaurar para lo que sigue

    // 7. TIMBRE PDF417
    try {
        let imgSource = null;
        if (timbreXml) {
            console.log("Generando PDF417 denso...");
            const tedContent = extraerTedDelXml(timbreXml);
            if (tedContent) imgSource = await generarPdf417Base64(tedContent);
        }

        if (imgSource) {
            const img = new Image();
            img.src = imgSource;
            await new Promise((r) => { img.onload = r; img.onerror = r; });

            // Ancho físico para XPrinter 80mm
            const printerWidthPx = 560; 
            const alignedHeight = Math.ceil(img.height / 8) * 8; 

            const canvas = document.createElement('canvas');
            canvas.width = printerWidthPx; 
            canvas.height = alignedHeight;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, printerWidthPx, alignedHeight);
            
            const xPos = (printerWidthPx - img.width) / 2;
            ctx.drawImage(img, xPos, 0);

            encoder.align('center')
                   .image(canvas, printerWidthPx, alignedHeight, 'atkinson')
                   .newline();

            encoder.size('small')
                   .text('Timbre Electronico SII').newline()
                   .text('Verifique en www.sii.cl').newline();
            
            encoder.size('normal');
        } else {
            encoder.align('center').text('(Sin Timbre)').newline();
        }

    } catch (e) {
        encoder.text('(Error Timbre)').newline();
    }

    encoder.newline(4).cut();
    return encoder.encode();
}
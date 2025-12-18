import EscPosEncoder from 'esc-pos-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new EscPosEncoder();
    
    const MAX_CHARS = 42; 
    const SEPARATOR = '-'.repeat(MAX_CHARS);

    // 1. INICIALIZACIÓN
    encoder.initialize().codepage('cp858');

    // 2. ENCABEZADO
    encoder.align('center')
           .bold(true)
           .size('normal')
           .text(data.empresa.razonSocial || 'EMPRESA')
           .bold(false)
           .newline()
           .text(`RUT: ${data.empresa.rut || '-'}`)
           .newline()
           .text(data.empresa.direccion || 'Temuco')
           .newline(2);

    // 3. INFO VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    encoder.align('left')
           .text(SEPARATOR).newline()
           .bold(true).text(`BOLETA N: ${folioText}`).bold(false).newline()
           .text(`FECHA: ${data.venta.fecha}`).newline()
           .text(SEPARATOR).newline(2);

    // 4. PRODUCTOS
    encoder.text('CANT DESCRIPCION               TOTAL').newline()
           .text(SEPARATOR).newline();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);
        const espaciosFijos = 2;
        const anchoNombre = MAX_CHARS - cant.length - precio.length - espaciosFijos;
        
        let nombre = (d.nombre || '').substring(0, anchoNombre);
        nombre = nombre.padEnd(anchoNombre, ' ');
        
        encoder.text(`${cant} ${nombre} ${precio}`).newline();
    });

    encoder.text(SEPARATOR).newline();

    // 5. TOTALES
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;
    
    encoder.align('left')
           .text(`Neto: ${formatCLP(neto)}`.padStart(MAX_CHARS)).newline()
           .text(`IVA:  ${formatCLP(iva)}`.padStart(MAX_CHARS)).newline(2);

    // 6. TOTAL
    encoder.align('right')
           .newline()
           .bold(true)
           .text(`TOTAL: ${formatCLP(total)}`)
           .bold(false)
           .newline(2);

    // 7. TIMBRE PDF417 - SOLUCIÓN CORRECTA
    encoder.align('center');

    try {
        let imgSource = null;

        // Prioridad 1: Imagen del servidor
        if (preGeneratedImg) {
            console.log("Usando imagen del servidor");
            imgSource = preGeneratedImg.startsWith('data:') 
                ? preGeneratedImg 
                : `data:image/png;base64,${preGeneratedImg}`;
        } 
        // Prioridad 2: Generar desde XML
        else if (timbreXml) {
            console.log("Generando imagen desde XML");
            const tedContent = extraerTedDelXml(timbreXml);
            if (tedContent) {
                imgSource = await generarPdf417Base64(tedContent);
            }
        }

        if (imgSource) {
            const img = new Image();
            img.src = imgSource;
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            console.log(`Imagen PDF417 original: ${img.width}x${img.height}px`);

            // CRITICAL: Usar ancho múltiplo de 8 PARA IMPRESIÓN, no para modificar imagen
            // Calculamos el ancho más cercano que sea múltiplo de 8
            const targetWidth = Math.ceil(img.width / 8) * 8;
            
            // Si el ancho original no es múltiplo de 8, usamos el siguiente múltiplo
            // La librería esc-pos-encoder internamente ajustará la imagen
            const printWidth = targetWidth;
            
            console.log(`Imprimiendo con ancho: ${printWidth}px (múltiplo de 8)`);

            // La librería manejará internamente el ajuste sin modificar el código de barras
            encoder.image(img, printWidth, img.height, 'atkinson')
                   .newline();

            encoder.size('small')
                   .text('Timbre Electronico SII').newline()
                   .text('Verifique en www.sii.cl').newline();
            
            encoder.size('normal');
        } else {
            console.warn('Sin timbre disponible');
            encoder.text('(Sin Timbre)').newline();
        }

    } catch (e) {
        console.error('Error procesando timbre:', e);
        encoder.text('(Error Timbre: ' + e.message + ')').newline();
    }

    // 8. CORTE
    encoder.newline(3).cut('partial');

    return encoder.encode();
}
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

        // Si el backend manda imagen, la usamos (pero ahora mandará null)
        if (preGeneratedImg) {
            console.log("Usando imagen del servidor");
            imgSource = preGeneratedImg.startsWith('data:') 
                ? preGeneratedImg 
                : `data:image/png;base64,${preGeneratedImg}`;
        } 
        // Generar desde XML (ESTO ES LO QUE SE EJECUTARÁ AHORA)
        else if (timbreXml) {
            console.log("Generando imagen desde XML en Frontend");
            const tedContent = extraerTedDelXml(timbreXml);
            if (tedContent) {
                // Generamos la imagen base (posiblemente de 63px de alto)
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

            // --- AQUÍ ESTÁ LA MAGIA QUE FALTA EN TU FRONTEND ---
            // Calculamos múltiplos de 8 para ANCHO y ALTO
            const alignedWidth = Math.ceil(img.width / 8) * 8;
            const alignedHeight = Math.ceil(img.height / 8) * 8; // Convierte 63 -> 64

            console.log(`Redimensionando Timbre: ${img.width}x${img.height} -> ${alignedWidth}x${alignedHeight}`);

            // Crear canvas con dimensiones correctas
            const canvas = document.createElement('canvas');
            canvas.width = alignedWidth;
            canvas.height = alignedHeight;
            const ctx = canvas.getContext('2d');

            // Rellenar de blanco (importante)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, alignedWidth, alignedHeight);

            // Dibujar imagen original
            ctx.drawImage(img, 0, 0);

            // Pasar el CANVAS al encoder (no la img original)
            encoder.image(canvas, alignedWidth, alignedHeight, 'atkinson')
                   .newline();
            // ---------------------------------------------------

            encoder.size('small')
                   .text('Timbre Electronico SII').newline()
                   .text('Verifique en www.sii.cl').newline();
            
            encoder.size('normal');
        } else {
            encoder.text('(Sin Timbre)').newline();
        }

    } catch (e) {
        console.error('Error procesando timbre:', e);
        encoder.text('(Error Timbre)').newline();
    }

    // 8. CORTE
    encoder.newline(3).cut('partial');

    return encoder.encode();
}
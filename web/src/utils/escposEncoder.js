import EscPosEncoder from 'esc-pos-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new EscPosEncoder();
    
    // AJUSTE PARA 80MM (48 caracteres)
    const MAX_CHARS = 48; 
    const SEPARATOR = '-'.repeat(MAX_CHARS);

    // 1. INICIALIZACIÓN
    encoder.initialize()
           .codepage('cp858')
           .align('center');

    // 2. ENCABEZADO (Corrección: Newline antes de quitar bold)
    encoder.bold(true)
           .size('normal')
           .text(data.empresa.razonSocial || 'EMPRESA')
           .newline() // <--- PRIMER FIX: Salto de línea antes de quitar bold
           .bold(false);

    encoder.text(`RUT: ${data.empresa.rut || '-'}`)
           .newline()
           .text((data.empresa.direccion || 'Temuco').substring(0, MAX_CHARS))
           .newline(2);

    // 3. INFO VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    
    encoder.align('left') 
           .text(SEPARATOR).newline()
           .bold(true).text(`BOLETA N: ${folioText}`).newline().bold(false) // Fix bold
           .text(`FECHA: ${data.venta.fecha}`).newline()
           .text(SEPARATOR).newline(2);

    // 4. PRODUCTOS
    encoder.text('CANT DESCRIPCION'.padEnd(MAX_CHARS - 10) + 'TOTAL').newline()
           .text(SEPARATOR).newline();

    data.detalles.forEach(d => {
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);

        const espacioCant = 4; 
        const espacioPrecio = precio.length;
        const espacioNombre = MAX_CHARS - espacioCant - espacioPrecio - 1; 
        
        let nombreStr = (d.nombre || '').substring(0, espacioNombre);
        
        const colCant = cant.padEnd(espacioCant, ' ');
        const colNombre = nombreStr.padEnd(espacioNombre, ' ');

        encoder.text(`${colCant}${colNombre}${precio}`).newline();
    });

    encoder.text(SEPARATOR).newline();

    // 5. TOTALES
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;
    
    encoder.align('left'); 
    
    const txtNeto = `Neto: ${formatCLP(neto)}`;
    const txtIva = `IVA:  ${formatCLP(iva)}`;
    
    encoder.text(txtNeto.padStart(MAX_CHARS)).newline()
           .text(txtIva.padStart(MAX_CHARS)).newline(2);

    // 6. TOTAL FINAL (CRÍTICO: AQUÍ ESTABA EL ERROR PRINCIPAL)
    encoder.align('right')
           .size('2x') 
           .bold(true)
           .text(`TOTAL: ${formatCLP(total)}`)
           .newline()      // <--- FIX CRÍTICO: Primero salto de línea...
           .bold(false)    // ...luego quitamos negrita...
           .size('normal') // ...luego tamaño normal.
           .newline(1);    // Espacio extra

    // 7. TIMBRE PDF417
    encoder.align('center'); 

    try {
        let imgSource = null;

        if (preGeneratedImg) {
             // Lógica legacy si la usaras
             imgSource = preGeneratedImg.startsWith('data:') 
                ? preGeneratedImg 
                : `data:image/png;base64,${preGeneratedImg}`;
        } 
        else if (timbreXml) {
            console.log("Generando imagen desde XML en Frontend");
            const tedContent = extraerTedDelXml(timbreXml);
            if (tedContent) {
                imgSource = await generarPdf417Base64(tedContent);
            }
        }

        if (imgSource) {
            const img = new Image();
            img.src = imgSource;
            
            await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });

            // Fix Múltiplo de 8
            const alignedWidth = Math.ceil(img.width / 8) * 8;
            const alignedHeight = Math.ceil(img.height / 8) * 8; 

            const canvas = document.createElement('canvas');
            canvas.width = alignedWidth;
            canvas.height = alignedHeight;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, alignedWidth, alignedHeight);
            ctx.drawImage(img, 0, 0);

            encoder.image(canvas, alignedWidth, alignedHeight, 'atkinson')
                   .newline(); // El newline después de image es seguro

            encoder.size('small')
                   .text('Timbre Electronico SII').newline()
                   .text('Verifique en www.sii.cl').newline();
            
            encoder.size('normal'); // Restaurar tamaño para el corte
        } else {
            encoder.text('(Sin Timbre)').newline();
        }

    } catch (e) {
        console.error(e);
        encoder.text('(Error Timbre)').newline();
    }

    // 8. CORTE
    encoder.newline(4).cut();

    return encoder.encode();
}
import EscPosEncoder from 'esc-pos-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

export async function generarTicketEscPos(data, timbreXml) {
    const encoder = new EscPosEncoder();
    
    // AJUSTE CLAVE: 48 suele ser mucho para algunas fuentes. 
    // 42 o 44 es el "sweet spot" para que no se rompa la línea en impresoras genéricas.
    const MAX_CHARS = 42; 
    const SEPARATOR = '-'.repeat(MAX_CHARS);

    // 1. INICIALIZACIÓN
    encoder.initialize().codepage('cp858');

    // 2. ENCABEZADO EMPRESA
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

    // 3. INFORMACIÓN DE LA VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    
    encoder.align('left')
           .text(SEPARATOR)
           .newline()
           .bold(true)
           .text(`BOLETA N: ${folioText}`) // Quité el ° por si causa problemas de encoding
           .newline()
           .bold(false)
           .text(`FECHA: ${data.venta.fecha}`)
           .newline()
           .text(SEPARATOR)
           .newline(2);

    // 4. ENCABEZADO DE PRODUCTOS (Ajustado a visual)
    encoder.text('CANT  DESCRIPCION                 TOTAL')
           .newline()
           .text(SEPARATOR)
           .newline();

    // 5. DETALLE DE PRODUCTOS (LÓGICA CORREGIDA)
    data.detalles.forEach(d => {
        // A. Preparamos los textos
        const cant = String(d.cantidad);
        const precio = formatCLP(d.subtotal);
        
        // B. Calculamos espacio disponible para el nombre
        // Estructura: "1 " + "NOMBRE..." + " " + "$ 1.800"
        // Espacios fijos: espacio tras cantidad (1) + espacio antes precio (1) = 2
        const espaciosFijos = 2;
        const anchoNombre = MAX_CHARS - cant.length - precio.length - espaciosFijos;
        
        // C. Recortamos o rellenamos el nombre
        let nombre = (d.nombre || '').substring(0, anchoNombre);
        // Si quieres que el precio siempre quede pegado a la derecha, rellenamos el nombre con espacios
        nombre = nombre.padEnd(anchoNombre, ' ');

        // D. Imprimimos la línea exacta
        // Ejemplo: "1 SALSA BBQ 250g                $ 1.800"
        encoder.text(`${cant} ${nombre} ${precio}`)
               .newline();
    });

    encoder.text(SEPARATOR).newline();

    // 6. SUBTOTALES
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    // Alineamos manualmente a la derecha usando padStart
    const txtNeto = `Neto: ${formatCLP(neto)}`;
    const txtIva  = `IVA:  ${formatCLP(iva)}`;
    
    encoder.text(txtNeto.padStart(MAX_CHARS)) // Empuja todo a la derecha
           .newline()
           .text(txtIva.padStart(MAX_CHARS))
           .newline(2);

    // 7. TOTAL
    // Usamos align right nativo para el total grande
    encoder.align('right')
           .bold(true)
           .size('normal') // Mantén normal si 'big' te da problemas, o usa width(2).height(2)
           .text(`TOTAL: ${formatCLP(total)}`)
           .bold(false)
           .newline(2);

    // 8. TIMBRE PDF417
    if (timbreXml) {
        try {
            const tedContent = extraerTedDelXml(timbreXml);
            if (tedContent) {
                const imgBase64 = await generarPdf417Base64(tedContent);
                if (imgBase64) {
                    const img = new Image();
                    img.src = imgBase64;
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });

                    encoder.align('center')
                           .image(img, 384, 150, 'atkinson') 
                           .newline()
                           .size('small')
                           .text('Timbre Electronico SII')
                           .newline()
                           .text('Verifique en www.sii.cl')
                           .size('normal')
                           .newline();
                }
            }
        } catch (e) {
            console.error('Error timbre:', e);
        }
    } else {
        encoder.align('center')
               .text('(Sin Timbre)')
               .newline();
    }

    // 9. CIERRE
    encoder.newline(3)
           .cut('partial');

    return encoder.encode();
}
import EscPosEncoder from 'esc-pos-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

/**
 * Generador de Ticket ESC/POS con formato consistente
 */
export async function generarTicketEscPos(data, timbreXml) {
    const encoder = new EscPosEncoder();
    
    // Constantes de formato
    const LINE_WIDTH = 48; // Ancho para impresoras de 80mm
    const SEPARATOR = '-'.repeat(LINE_WIDTH);

    // 1. INICIALIZACIÓN
    encoder.initialize().codepage('cp858');

    // 2. ENCABEZADO EMPRESA
    encoder.align('center')
           .bold(true)
           .size('normal') // Aseguramos tamaño normal
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
           .text(`BOLETA N°: ${folioText}`)
           .newline()
           .bold(false)
           .text(`FECHA: ${data.venta.fecha}`)
           .newline()
           .text(SEPARATOR)
           .newline(2);

    // 4. ENCABEZADO DE PRODUCTOS
    encoder.text('CANT  DESCRIPCION           SUBTOTAL')
           .newline()
           .text(SEPARATOR)
           .newline();

    // 5. DETALLE DE PRODUCTOS
    data.detalles.forEach(d => {
        const cant = String(d.cantidad).padEnd(6);
        const nombre = (d.nombre || '').substring(0, 20).padEnd(20);
        const subtotal = formatCLP(d.subtotal).padStart(10);
        
        encoder.text(`${cant}${nombre}${subtotal}`)
               .newline();
    });

    encoder.text(SEPARATOR).newline();

    // 6. SUBTOTALES (alineados a la izquierda)
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    encoder.align('left')
           .text(`Neto:  ${formatCLP(neto)}`)
           .newline()
           .text(`IVA:   ${formatCLP(iva)}`)
           .newline(2);

    // 7. TOTAL (grande pero controlado)
    encoder.align('right')
           .bold(true)
           .size('big') // Usa el método size() en vez de width/height manual
           .text(`TOTAL: ${formatCLP(total)}`)
           .size('normal') // Reset inmediato
           .bold(false)
           .newline(2);

    // 8. TIMBRE PDF417
    if (timbreXml) {
        try {
            // Extraer el TED del XML completo
            const tedContent = extraerTedDelXml(timbreXml);
            
            if (tedContent) {
                // Generar imagen base64
                const imgBase64 = await generarPdf417Base64(tedContent);
                
                if (imgBase64) {
                    // Convertir base64 a Image object
                    const img = new Image();
                    img.src = imgBase64;
                    
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });

                    // Imprimir imagen centrada
                    encoder.align('center')
                           .image(img, 384, 150, 'atkinson') // 384px = ancho óptimo para 80mm
                           .newline()
                           .size('small')
                           .text('Timbre Electrónico SII')
                           .newline()
                           .text('Verifique en www.sii.cl')
                           .size('normal')
                           .newline();
                } else {
                    console.warn('No se pudo generar imagen PDF417');
                }
            } else {
                console.warn('No se pudo extraer TED del XML');
            }
        } catch (e) {
            console.error('Error generando timbre:', e);
        }
    } else {
        encoder.align('center')
               .text('(Sin Timbre - Modo Prueba)')
               .newline();
    }

    // 9. CIERRE Y CORTE
    encoder.newline(3)
           .cut('partial'); // Corte parcial (menos desperdicio)

    return encoder.encode();
}
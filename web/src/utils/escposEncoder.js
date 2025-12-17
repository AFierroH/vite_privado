import EscPosEncoder from 'esc-pos-encoder';
import { generarPdf417Base64, extraerTedDelXml } from './pdf417Generator';

const formatCLP = (num) => '$ ' + new Intl.NumberFormat('es-CL').format(num);

// AHORA RECIBE 3 ARGUMENTOS: data, timbreXml, preGeneratedImg
export async function generarTicketEscPos(data, timbreXml, preGeneratedImg) {
    const encoder = new EscPosEncoder();
    
    // Configuración para 80mm
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

    // 3. DATOS VENTA
    const folioText = data.venta.folio || data.venta.id_venta || '---';
    encoder.align('left')
           .text(SEPARATOR).newline()
           .bold(true).text(`BOLETA N: ${folioText}`).bold(false).newline()
           .text(`FECHA: ${data.venta.fecha}`).newline()
           .text(SEPARATOR).newline(2);

    // 4. DETALLES
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

    // 6. TOTALES
    const total = data.total;
    const neto = Math.round(total / 1.19);
    const iva = total - neto;
    const txtNeto = `Neto: ${formatCLP(neto)}`;
    const txtIva  = `IVA:  ${formatCLP(iva)}`;
    
    encoder.text(txtNeto.padStart(MAX_CHARS)).newline()
           .text(txtIva.padStart(MAX_CHARS)).newline(2);

    // 7. TOTAL FINAL (Con fix de fuentes)
    encoder.align('right');
    encoder.newline(); // <--- FIX IMPORTANTE
    encoder.bold(true)
           .size('normal')
           .text(`TOTAL: ${formatCLP(total)}`)
           .bold(false)
           .newline(2);

    // ==========================================
    // 8. LOGICA DEL TIMBRE (LA PARTE QUE FALLABA)
    // ==========================================
    encoder.align('center');

    try {
        let imgSource = null;

        // PRIORIDAD 1: ¿El backend nos mandó la imagen lista?
        if (preGeneratedImg) {
            console.log("Usando imagen enviada por el servidor");
            // Si viene sin cabecera data:image, se la ponemos
            imgSource = preGeneratedImg.startsWith('data:') 
                ? preGeneratedImg 
                : `data:image/png;base64,${preGeneratedImg}`;
        } 
        // PRIORIDAD 2: ¿Tenemos XML para generarla nosotros?
        else if (timbreXml) {
            console.log("Generando imagen localmente desde XML");
            const tedContent = extraerTedDelXml(timbreXml);
            if (tedContent) {
                imgSource = await generarPdf417Base64(tedContent);
            }
        }

        // SI TENEMOS ALGUNA IMAGEN (Del server o generada), IMPRIMIRLA
        if (imgSource) {
            const img = new Image();
            img.src = imgSource;

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            // Imprimir la imagen (300px ancho seguro)
            encoder.image(img, 300, 120, 'atkinson').newline();

            // Texto legal bajo el timbre
            encoder.size('small')
                   .text('Timbre Electronico SII').newline()
                   .text('Verifique en www.sii.cl').newline();
            
            encoder.size('normal'); // Reset
        } else {
            // Si fallaron ambas opciones
            encoder.text('(Sin Timbre)').newline();
        }

    } catch (e) {
        console.error("Error al procesar imagen timbre:", e);
        encoder.text('(Error Timbre)').newline();
    }

    // 9. CORTE
    encoder.newline(3).cut('partial');

    return encoder.encode();
}
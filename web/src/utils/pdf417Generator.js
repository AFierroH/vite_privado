import bwipjs from 'bwip-js';

/**
 * Genera imagen PNG Base64 del PDF417 para el timbre SII
 * @param {string} tedXml - XML del TED extraído del documento SII
 * @returns {Promise<string>} - Data URL (base64) de la imagen PNG
 */
export async function generarPdf417Base64(tedXml) {
    if (!tedXml || typeof tedXml !== 'string') {
        console.warn('TED XML vacío o inválido');
        return null;
    }
    
    try {
        // Limpiar el XML (quitar saltos de línea y espacios extra)
        const cleanData = tedXml.trim().replace(/\s+/g, ' ');
        
        // Crear canvas temporal
        const canvas = document.createElement('canvas');
        
        // Configuración optimizada para impresoras térmicas SII
        const options = {
            bcid: 'pdf417',           // Tipo de código
            text: cleanData,          // Contenido del TED
            eclevel: 5,               // Nivel de corrección SII (5 = ~25%)
            rowheight: 8,             // Altura de cada fila (más alto = más legible)
            scale: 3,                 // Escala de renderizado
            includetext: false,       // No mostrar texto
            paddingwidth: 10,         // Margen horizontal (quiet zone)
            paddingheight: 10         // Margen vertical
        };
        
        // Generar el código de barras en el canvas
        bwipjs.toCanvas(canvas, options);
        
        // Convertir canvas a base64
        const base64Image = canvas.toDataURL('image/png');
        
        console.log('✅ PDF417 generado exitosamente');
        return base64Image;
        
    } catch (error) {
        console.error('❌ Error generando PDF417:', error);
        return null;
    }
}

/**
 * Extrae el TED (Timbre Electrónico) del XML del SII
 * @param {string} xmlCompleto - XML completo del documento SII
 * @returns {string|null} - Contenido del TED o null
 */
export function extraerTedDelXml(xmlCompleto) {
    if (!xmlCompleto) return null;
    
    try {
        // Buscar entre las etiquetas <TED> y </TED>
        const match = xmlCompleto.match(/<TED[^>]*>([\s\S]*?)<\/TED>/i);
        
        if (match && match[1]) {
            // Incluir las etiquetas TED en el contenido
            return `<TED>${match[1]}</TED>`;
        }
        
        console.warn('No se encontró etiqueta <TED> en el XML');
        return null;
        
    } catch (error) {
        console.error('Error extrayendo TED:', error);
        return null;
    }
}
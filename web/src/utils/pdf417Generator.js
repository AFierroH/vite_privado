import bwipjs from 'bwip-js';

export async function generarPdf417Base64(tedXml) {
    if (!tedXml || typeof tedXml !== 'string') {
        console.warn('TED XML vacío o inválido');
        return null;
    }
    
    try {
        const cleanData = tedXml.trim().replace(/\s+/g, ' ');
        const canvas = document.createElement('canvas');
        
        const options = {
            bcid: 'pdf417',
            text: cleanData,
            eclevel: 5,        // Nivel de corrección de errores del SII
            rowheight: 8,      // Altura de cada fila
            scale: 3,          // Escala
            includetext: false,
            paddingwidth: 8,   // Padding múltiplo de 8
            paddingheight: 8
        };
        
        bwipjs.toCanvas(canvas, options);
        const base64Image = canvas.toDataURL('image/png');
        
        console.log(`PDF417 generado: ${canvas.width}x${canvas.height}px (ORIGINAL sin modificar)`);
        
        return base64Image;
        
    } catch (error) {
        console.error('Error generando PDF417:', error);
        return null;
    }
}

/**
 * Extrae el TED del XML completo
 */
export function extraerTedDelXml(xmlCompleto) {
    if (!xmlCompleto) return null;
    
    try {
        const match = xmlCompleto.match(/<TED[^>]*>([\s\S]*?)<\/TED>/i);
        
        if (match && match[1]) {
            return `<TED>${match[1]}</TED>`;
        }
        
        console.warn('No se encontró etiqueta <TED> en el XML');
        return null;
        
    } catch (error) {
        console.error('Error extrayendo TED:', error);
        return null;
    }
}
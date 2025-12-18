import bwipjs from 'bwip-js';

export async function generarPdf417Base64(tedXml) {
    if (!tedXml) return null;
    
    try {
        const cleanData = tedXml.trim();
        
        const canvas = document.createElement('canvas');
        
        const options = {
            bcid: 'pdf417',
            text: cleanData,
            
            eclevel: 5,   

            scale: 2, 
            
            rowheight: 3, 
    
            columns: 12,   
            
            includetext: false,
            paddingwidth: 5,
            paddingheight: 5
        };
        
        // Renderizar en el canvas
        bwipjs.toCanvas(canvas, options);
        
        console.log(`PDF417 Denso Generado: ${canvas.width}x${canvas.height}px`);
        
        return canvas.toDataURL('image/png');
        
    } catch (error) {
        console.error('Error generando PDF417:', error);
        return null;
    }
}

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
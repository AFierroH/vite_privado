// Configuración para diferenciar humano vs pistola
const SCAN_TIMEOUT = 50; // ms máximos entre teclas (las pistolas son muy rápidas)
const MIN_LENGTH = 3;    // Longitud mínima de un código válido

let buffer = '';       
let lastKeyTime = 0;   
let callbacks = [];    

const globalKeyHandler = (e) => {
    // Ignoramos teclas especiales (Shift, Ctrl, etc.) si no imprimen nada
    if (e.key.length > 1 && e.key !== 'Enter') return;

    const now = Date.now();
    const isEnter = e.key === 'Enter';

    // 1. Si pasó mucho tiempo, reiniciamos (es un humano escribiendo lento)
    if (now - lastKeyTime > SCAN_TIMEOUT) {
        if (!isEnter && buffer.length > 0) {
            buffer = ''; 
        }
    }
    lastKeyTime = now;

    // 2. Acumular caracteres
    if (e.key.length === 1) {
        buffer += e.key;
    }

    // 3. Al dar Enter, enviamos el código
    if (isEnter) {
        if (buffer.length >= MIN_LENGTH) {
            // Notificar a quien esté escuchando (Ventas o Productos)
            const activeTag = document.activeElement.tagName;
            const isInputFocused = (activeTag === 'INPUT' || activeTag === 'TEXTAREA');

            callbacks.forEach(cb => cb(buffer, isInputFocused));
            buffer = ''; 
        } else {
            buffer = ''; 
        }
    }
};

// Iniciar escucha global
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', globalKeyHandler);
}

export const ScannerListener = {
    onScan(callback) {
        callbacks.push(callback);
    },
    offScan(callback) {
        callbacks = callbacks.filter(cb => cb !== callback);
    }
};
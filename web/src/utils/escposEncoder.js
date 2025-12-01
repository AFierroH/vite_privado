// src/utils/escposEncoder.js

const ESC = 0x1B;
const GS = 0x1D;

// Helpers de codificación
function encode(text) {
    // Usamos TextEncoder para convertir string a bytes
    // Las impresoras térmicas suelen usar CP858 o similar, pero UTF-8 básico funciona para números/letras
    // Si necesitas tildes exactas, se requiere un mapeo manual a CP850/858
    const encoder = new TextEncoder(); 
    return Array.from(encoder.encode(text)); 
}

function padRight(str, len) {
    return (str + ' '.repeat(len)).slice(0, len);
}

function padLeft(str, len) {
    return (' '.repeat(len) + str).slice(-len);
}

function formatCLP(num) {
    return '$ ' + new Intl.NumberFormat('es-CL').format(num);
}

export function generarTicketEscPos(data, timbreXml) {
    let bytes = [];

    // 1. Inicializar
    bytes.push(ESC, 0x40);

    // 2. Encabezado
    bytes.push(ESC, 0x61, 1); // Centrar
    bytes.push(ESC, 0x21, 0x10); // Doble altura (aprox)
    bytes.push(...encode(data.empresa.razonSocial || 'EMPRESA'));
    bytes.push(0x0A); // Salto de línea

    bytes.push(ESC, 0x21, 0x00); // Normal
    bytes.push(...encode(`RUT: ${data.empresa.rut || '-'}`));
    bytes.push(0x0A);
    bytes.push(...encode(data.empresa.direccion || 'Temuco'));
    bytes.push(0x0A, 0x0A);

    // 3. Info Venta
    bytes.push(ESC, 0x61, 0); // Alineación Izquierda
    bytes.push(...encode('--------------------------------')); // 32 caracteres (para 58mm) o 42/48 para 80mm
    bytes.push(0x0A);
    bytes.push(...encode(`Folio: ${data.venta.id_venta}`));
    bytes.push(0x0A);
    bytes.push(...encode(`Fecha: ${data.venta.fecha}`));
    bytes.push(0x0A);
    bytes.push(...encode('--------------------------------'));
    bytes.push(0x0A);

    // 4. Detalles (Simulación de tabla manual para 80mm aprox 48 chars)
    // Ajusta los anchos según tu papel. Ejemplo: Cant(4) Desc(30) Total(12)
    bytes.push(...encode("CANT DESCRIPCION                    TOTAL"));
    bytes.push(0x0A);

    data.detalles.forEach(d => {
        const cant = d.cantidad.toString();
        const nom = (d.nombre || '').substring(0, 30); // Cortar nombre
        const total = formatCLP(d.subtotal);

        // Construir línea manual
        let line = padRight(cant, 4) + padRight(nom, 31) + padLeft(total, 12);
        bytes.push(...encode(line));
        bytes.push(0x0A);
    });

    bytes.push(0x0A);
    
    // 5. Totales
    bytes.push(ESC, 0x61, 2); // Derecha
    bytes.push(ESC, 0x45, 1); // Bold On
    bytes.push(...encode(`TOTAL: ${formatCLP(data.total)}`));
    bytes.push(ESC, 0x45, 0); // Bold Off
    bytes.push(0x0A, 0x0A);

    // 6. Timbre (Placeholder)
    // Generar PDF417 en binario crudo es muy complejo sin librerías pesadas en frontend.
    // Usualmente en Web se imprime el texto del timbre o se usa QZ Tray para renderizar HTML/Imagen.
    bytes.push(ESC, 0x61, 1); // Centrar
    if (timbreXml) {
        bytes.push(...encode("(Timbre Electronico SII)"));
        bytes.push(0x0A);
        bytes.push(...encode("Verifique en www.sii.cl"));
    }
    
    // 7. Cortar papel
    bytes.push(0x0A, 0x0A, 0x0A);
    bytes.push(GS, 0x56, 66, 0); // Cortar parcial

    return new Uint8Array(bytes);
}
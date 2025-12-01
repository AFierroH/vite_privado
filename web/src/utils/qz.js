// ------------------------------------------
// qz.js – Módulo universal para impresión ESC/POS vía QZ Tray
// ------------------------------------------

import qz from "qz-tray";

export async function connectQZ() {
    if (!qz.websocket.isActive()) {
        try {
            await qz.websocket.connect();
            console.log("[QZ] Conectado");
        } catch (err) {
            console.error("[QZ] Error connect", err);
            throw err;
        }
    }
}

export async function getPrinterList() {
    await connectQZ();
    return await qz.printers.find();
}

export async function printTicketWeb(sale, options = {}) {
    await connectQZ();

    const printerName = options.printer || "POS-80"; // opcional

    const config = qz.configs.create(printerName, {
        copies: 1,
        colorType: "blackwhite",
        density: "full",
        interpolation: "nearest-neighbor"
    });

    const cmds = [];

    // -------- HEADER --------
    cmds.push('\x1B\x40'); // inicializar

    cmds.push('\x1B\x61\x01'); // center
    cmds.push('\x1B\x45\x01'); // bold
    cmds.push(sale.empresa.razonSocial + "\n");
    cmds.push('\x1B\x45\x00');
    cmds.push(`RUT: ${sale.empresa.rut}\n`);
    cmds.push(`${sale.empresa.direccion}\n\n`);

    // -------- Datos Ticket --------
    cmds.push('\x1B\x61\x00'); // left
    cmds.push("------------------------------------------\n");
    cmds.push(`BOLETA ELECTRONICA N: ${sale.venta.id_venta}\n`);
    cmds.push(`FECHA: ${sale.venta.fecha}\n`);
    cmds.push("------------------------------------------\n");

    cmds.push("CANT     ITEM                    TOTAL\n");

    sale.detalles.forEach(d => {
        const nombre = (d.nombre || "").substring(0, 20);
        const cantidad = String(d.cantidad).padEnd(4, " ");
        const total = formatCLP(d.subtotal).padStart(10, " ");
        cmds.push(`${cantidad}  ${nombre.padEnd(20)} ${total}\n`);
    });

    cmds.push("------------------------------------------\n");

    const neto = Math.round(sale.total / 1.19);
    const iva = sale.total - neto;

    cmds.push(`NETO:  ${formatCLP(neto)}\n`);
    cmds.push(`IVA:   ${formatCLP(iva)}\n`);
    cmds.push("\x1B\x45\x01"); // bold
    cmds.push(`TOTAL: ${formatCLP(sale.total)}\n`);
    cmds.push("\x1B\x45\x00");

    // -------- PDF417 (Imagen raster vía Base64) --------
    if (options.pdf417base64) {
        // QZ necesita imagen en Base64 completa
        cmds.push({
            type: "image",
            format: "base64",
            data: options.pdf417base64,
            align: "center"
        });
        cmds.push("Timbre Electrónico SII\n");
        cmds.push("Verifique en www.sii.cl\n");
    } else {
        cmds.push("(Sin Timbre PDF417)\n");
    }

    cmds.push("\n\n\n");
    cmds.push("\x1D\x56\x41"); // cortar

    // Emitir
    try {
        await qz.print(config, cmds);
        return { ok: true };
    } catch (e) {
        console.error("[QZ PRINT ERROR]", e);
        return { ok: false, error: e.message };
    }
}

function formatCLP(num) {
    return '$ ' + new Intl.NumberFormat('es-CL').format(num);
}

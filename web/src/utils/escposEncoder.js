// src/utils/escposEncoder.js
import EscPosEncoder from "esc-pos-encoder";

export function generarTicketEscPos(data, pdf417) {
    const encoder = new EscPosEncoder();

    return encoder
        .initialize()
        .align('center')
        .line(data.empresa.razonSocial)
        .line(`RUT: ${data.empresa.rut}`)
        .line(data.empresa.direccion)
        .newline()
        .line(`Venta #${data.venta.id_venta}`)
        .line(`Fecha: ${data.venta.fecha}`)
        .newline()
        .align('left')
        .line('-------------------------------')
        .line(
            data.detalles
                .map(d => `${d.nombre}  x${d.cantidad}   $${d.subtotal}`)
                .join("\n")
        )
        .line('-------------------------------')
        .line(`TOTAL: $${data.total}`)
        .newline()
        .align('center')
        .barcode(pdf417, 'pdf417')   // ← TIMBRE SII
        .newline()
        .cut()
        .encode();
}

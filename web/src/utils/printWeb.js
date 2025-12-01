// src/utils/printWeb.js

export async function printFromWebRaw(bytes) {
    if (!window.qz) {
        alert("QZ Tray no está instalado o no se cargó.");
        return;
    }

    try {
        await qz.websocket.connect();

        const config = qz.configs.create("POS-Printer", {
            encoding: "binary",
            rasterize: false
        });

        await qz.print(config, [
            {
                type: "raw",
                format: "binary",
                data: bytes
            }
        ]);

        await qz.websocket.disconnect();
    } catch (err) {
        console.error("Error imprimiendo con QZ:", err);
        alert("Error al imprimir con QZ Tray");
    }
}

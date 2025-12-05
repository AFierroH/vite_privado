import qz from 'qz-tray';

const isElectron = !!window.electronAPI;

// TUS IDS FIJOS (Por si la búsqueda automática falla en web)
const MY_VID = 0x1FC9; 
const MY_PID = 0x2016;

export const PrinterService = {
    
    // --- 1. LISTAR ---
    async listarUSB() {
        if (isElectron) {
            // MODO ELECTRON: Usa lo que ya tienes en electron.js
            try {
                const devices = await window.electronAPI.listUsbDevices();
                return devices.map(d => ({ 
                    name: d.name, 
                    val: { vid: d.vid, pid: d.pid }, // Guardamos VID/PID para electron
                    type: 'ELECTRON' 
                }));
            } catch (e) { console.error(e); return []; }
        } else {
            // MODO WEB (QZ RAW HID)
            // No podemos listar fácilmente dispositivos raw hid en QZ gratis sin certificados.
            // Así que devolvemos tu impresora "Hardcodeada" lista para usarse.
            return [{
                name: "XPrinter (Modo Web Zadig)",
                val: { vid: MY_VID, pid: MY_PID }, // Guardamos VID/PID para QZ
                type: 'QZ_RAW'
            }];
        }
    },

    // --- 2. IMPRIMIR ---
    async imprimir(params) {
        // params: { printerType, printerVal (obj vid/pid), ip, port, dataObj, rawBytes }

        if (isElectron) {
            // =========================
            // MODO ELECTRON (Nativo)
            // =========================
            const opts = {
                type: params.printerType,
                ip: params.ip,
                port: params.port,
                vid: params.printerVal?.vid,
                pid: params.printerVal?.pid,
                content417: params.content417
            };
            return await window.electronAPI.printFromData(params.dataObj, opts);

        } else {
            // =========================
            // MODO WEB (QZ Tray)
            // =========================
            if (!qz.websocket.isActive()) await qz.websocket.connect();

            // A. RED (LAN)
            if (params.printerType === 'lan') {
                const config = qz.configs.create({ host: params.ip, port: params.port });
                // Envolver los bytes
                const data = [{ type: 'raw', format: 'command', flavor: 'plain', data: params.rawBytes }];
                return await qz.print(config, data);
            } 
            
            // B. USB (RAW HID - ZADIG)
            else {
                // Configuración RAW de QZ (Apunta directo al hardware)
                // ¡IMPORTANTE! Endpoint 0x03 es el que descubrimos ayer en Pascal
                const config = qz.configs.create({
                    vendor: params.printerVal?.vid || MY_VID,
                    product: params.printerVal?.pid || MY_PID,
                    index: 0,
                    endpoint: 0x03  // <--- LA CLAVE PARA QUE FUNCIONE
                });

                // Convertir array normal a Uint8Array
                const uint8Data = new Uint8Array(params.rawBytes);

                try {
                    // 1. Reclamar interfaz (QZ pedirá permiso en popup)
                    await qz.usb.claim(config);
                    // 2. Enviar datos
                    await qz.usb.sendData(config, uint8Data);
                    // 3. Soltar
                    await qz.usb.release(config);
                    return true;
                } catch (err) {
                    console.error("QZ USB Raw Error:", err);
                    throw new Error("Error USB Web. ¿Zadig instalado? " + err);
                }
            }
        }
    }
};
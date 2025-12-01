import qz from 'qz-tray';
import { sha256 } from 'js-sha256'; // Asegúrate de tener esto instalado: npm install js-sha256

const isElectron = !!window.electronAPI;

export const PrinterService = {
    
    // --- 1. LISTAR IMPRESORAS (Híbrido) ---
    async listarUSB() {
        if (isElectron) {
            // MODO ELECTRON: Usamos tu API existente
            try {
                const devices = await window.electronAPI.listUsbDevices();
                // Normalizamos para que el Select de Vue lo entienda igual
                return devices.map(d => ({
                    name: d.name,
                    val: d, // Guardamos el objeto original (vid/pid)
                    type: 'ELECTRON'
                }));
            } catch (e) {
                console.error("Error Electron USB:", e);
                return [];
            }
        } else {
            // MODO WEB: Usamos QZ Tray
            try {
                if (!qz.websocket.isActive()) {
                    await qz.websocket.connect();
                }
                const printers = await qz.printers.find();
                // Normalizamos
                return printers.map(pName => ({
                    name: pName,
                    val: pName, // En QZ el valor es el nombre string
                    type: 'QZ'
                }));
            } catch (e) {
                console.error("Error QZ Tray:", e);
                // Si falla, retornamos vacío para que no rompa la UI
                return []; 
            }
        }
    },

    // --- 2. IMPRIMIR (Híbrido) ---
    async imprimir(params) {
        // params: { printerType, printerVal, ip, port, dataObj, rawBytes }
        
        if (isElectron) {
            // Lógica Electron (Manda objeto JSON y Electron formatea)
            const opts = {
                type: params.printerType, // 'usb' o 'lan'
                ip: params.ip,
                port: params.port,
                vid: params.printerVal?.vid,
                pid: params.printerVal?.pid,
                content417: params.content417
            };
            return await window.electronAPI.printFromData(params.dataObj, opts);

        } else {
            // Lógica Web (QZ Tray - Manda Bytes crudos ESC/POS)
            if (!qz.websocket.isActive()) await qz.websocket.connect();

            let config;
            if (params.printerType === 'lan') {
                config = qz.configs.create({ host: params.ip, port: params.port });
            } else {
                // USB: params.printerVal es el nombre string "XP-80C"
                if (!params.printerVal) throw new Error("Selecciona una impresora USB");
                config = qz.configs.create(params.printerVal);
            }

            // Enviar bytes crudos generados por escposEncoder
            return await qz.print(config, params.rawBytes);
        }
    }
};
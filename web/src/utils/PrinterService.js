// src/utils/PrinterService.js
import qz from 'qz-tray';

const isElectron = !!window.electronAPI;

export const PrinterService = {
    
    // --- 1. LISTAR IMPRESORAS ---
    async listarUSB() {
        if (isElectron) {
            try {
                const devices = await window.electronAPI.listUsbDevices();
                return devices.map(d => ({ name: d.name, val: d, type: 'ELECTRON' }));
            } catch (e) {
                console.error(e);
                return [];
            }
        } else {
            // WEB (QZ)
            try {
                if (!qz.websocket.isActive()) await qz.websocket.connect();
                const printers = await qz.printers.find();
                return printers.map(pName => ({ name: pName, val: pName, type: 'QZ' }));
            } catch (e) {
                console.error("QZ Error:", e);
                return []; 
            }
        }
    },

    // --- 2. IMPRIMIR (CORREGIDO) ---
    async imprimir(params) {
        // params: { printerType, printerVal, ip, port, dataObj, rawBytes, content417 }
        
        if (isElectron) {
            // Lógica Electron
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
            // LÓGICA WEB (QZ TRAY) - AQUÍ ESTABA EL ERROR
            if (!qz.websocket.isActive()) await qz.websocket.connect();

            let config;
            if (params.printerType === 'lan') {
                config = qz.configs.create({ host: params.ip, port: params.port });
            } else {
                if (!params.printerVal) throw new Error("Selecciona una impresora USB");
                // params.printerVal es el STRING del nombre en QZ
                config = qz.configs.create(params.printerVal);
            }

            // --- FIX: ENVOLVER LOS BYTES EN UN ARRAY DE OBJETOS ---
            const data = [
                { 
                    type: 'raw', 
                    format: 'command', 
                    data: params.rawBytes 
                }
            ];

            return await qz.print(config, data);
        }
    }
};
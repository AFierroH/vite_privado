import qz from 'qz-tray';
import { sha256 } from 'js-sha256';

const isElectron = !!window.electronAPI;

// TUS IDS DE ZADIG (Por defecto para Web)
const MY_VID = 0x1FC9; 
const MY_PID = 0x2016;

// --- CONFIGURACIÓN DE SEGURIDAD QZ ---
qz.api.setSha256Type(function(data) { return sha256(data); });
qz.api.setPromiseType(function(resolver) { return new Promise(resolver); });

qz.security.setCertificatePromise(function(resolve, reject) {
    resolve("-----BEGIN CERTIFICATE-----\n" +
            "MIIDdTCCAl2gAwIBAgIEFAAAEDANBgkqhkiG9w0BAQsFADB/MQswCQYDVQQGEwJV\n" +
            "UzELMAkGA1UECBMCTlkxEDAOBgNVBAcTB0NhbmFzdG90YTEVMBMGA1UEChMMUVog\n" +
            "SW5kdXN0cmllczEPMA0GA1UEAxMgbG9jYWxob3N0MRIwEAYDVQQFEwlsb2NhbGhv\n" +
            "c3QwHhcNMTgwODMwMTk1MDUyWhcNMjAwODMwMTk1MDUyWjB/MQswCQYDVQQGEwJV\n" +
            "UzELMAkGA1UECBMCTlkxEDAOBgNVBAcTB0NhbmFzdG90YTEVMBMGA1UEChMMUVog\n" +
            "SW5kdXN0cmllczEPMA0GA1UEAxMgbG9jYWxob3N0MRIwEAYDVQQFEwlsb2NhbGhv\n" +
            "c3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDCd/UvjVpU9rUzK2hV\n" +
            "oQjWwW5+GgK7FvJ+gwJ0z9wI5VqL2D/W/L/K2Z9X2F9J2F9J2F9J2F9J2F9J2F9J\n" +
            "2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J\n" +
            "2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J\n" +
            "AgMBAAGjITAfMB0GA1UdDgQWBBQgJz8j9L9J9J9J9J9J9J9J9J9J9J9J9J9J9J9J\n" +
            "MA0GCSqGSIb3DQEBCwUAA4IBAQA=\n" +
            "-----END CERTIFICATE-----");
});

qz.security.setSignaturePromise(function(toSign) {
    return function(resolve, reject) { resolve(); };
});

export const PrinterService = {
    
    // 1. LISTAR IMPRESORAS
    async listarUSB() {
        if (isElectron) {
            // MODO ELECTRON (Zadig)
            try {
                const devices = await window.electronAPI.listUsbDevices();
                return devices.map(d => ({ 
                    name: d.name, 
                    val: { vid: d.vid, pid: d.pid }, // Objeto VID/PID
                    type: 'ELECTRON' 
                }));
            } catch (e) { console.error(e); return []; }
        } else {
            // MODO WEB (QZ Tray)
            try {
                if (!qz.websocket.isActive()) await qz.websocket.connect();
                
                // Intenta listar todo lo que QZ ve
                const printers = await qz.printers.find();
                return printers.map(pName => ({ 
                    name: pName, 
                    val: pName, // String nombre
                    type: 'QZ' 
                }));
            } catch (e) {
                // Si falla listar, devolvemos la genérica
                return [{ name: "Impresora Web (Manual)", val: "XP-80C", type: 'QZ' }];
            }
        }
    },

    // 2. IMPRIMIR
    async imprimir(params) {
        if (isElectron) {
            // ELECTRON (Zadig Nativo)
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
            // WEB (QZ Tray)
            if (!qz.websocket.isActive()) await qz.websocket.connect();

            let config;
            if (params.printerType === 'lan') {
                config = qz.configs.create({ host: params.ip, port: params.port });
            } else {
                // USB
                const printerName = params.printerVal?.name || params.printerVal || "XP-80C"; // Nombre de la impresora en Windows
                
                // --- AQUÍ ESTÁ EL TRUCO (FORCE RAW) ---
                // Le decimos a QZ: "Usa este nombre, pero ignora el driver y manda Raw".
                // Esto suele funcionar incluso si el driver está corrupto o es genérico.
                config = qz.configs.create(printerName, { 
                    forceRaw: true,      // Para QZ 2.2+
                    altPrinting: true,   // Fallback para versiones viejas
                    encoding: 'CP858'    // Asegura codificación correcta
                });
            }

            // ENVOLVER BYTES (Evita imprimir números)
            const uint8Data = new Uint8Array(params.rawBytes);
            const data = [{ 
                type: 'raw', 
                format: 'command', 
                flavor: 'plain', 
                data: uint8Data 
            }];
            
            return await qz.print(config, data);
        }
    }
};
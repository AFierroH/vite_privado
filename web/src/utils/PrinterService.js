import qz from 'qz-tray';
import { sha256 } from 'js-sha256';

const isElectron = !!window.electronAPI;

// TUS IDS DE ZADIG (Por defecto para Web)
const MY_VID = 0x1FC9; 
const MY_PID = 0x2016;

// --- SEGURIDAD QZ (Evita errores de certificado) ---
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
            // MODO ELECTRON (Zadig Nativo)
            try {
                const devices = await window.electronAPI.listUsbDevices();
                return devices.map(d => ({ 
                    name: d.name, 
                    val: { vid: d.vid, pid: d.pid }, 
                    type: 'ELECTRON' 
                }));
            } catch (e) { console.error(e); return []; }
        } else {
            // MODO WEB (QZ RAW)
            // Retornamos la impresora hardcodeada para Zadig Web
            return [{
                name: "XPrinter (Web Zadig)",
                val: { vid: MY_VID, pid: MY_PID }, 
                type: 'QZ_RAW'
            }];
        }
    },

    // 2. IMPRIMIR (FUNCIÓN UNIFICADA)
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

            // A. LAN
            if (params.printerType === 'lan') {
                const config = qz.configs.create({ host: params.ip, port: params.port });
                // Envolver bytes
                const uint8Data = new Uint8Array(params.rawBytes);
                const data = [{ type: 'raw', format: 'command', flavor: 'plain', data: uint8Data }];
                return await qz.print(config, data);
            } 
            
            // B. USB RAW (ZADIG)
            else {
                const config = qz.configs.create({
                    vendor: params.printerVal?.vid || MY_VID,
                    product: params.printerVal?.pid || MY_PID,
                    index: 0,
                    endpoint: 0x03 // Endpoint OUT
                });

                const uint8Data = new Uint8Array(params.rawBytes);

                try {
                    await qz.usb.claim(config); 
                    await qz.usb.sendData(config, uint8Data);
                    await qz.usb.release(config);
                    return true;
                } catch (err) {
                    console.error("QZ USB Error:", err);
                    throw new Error("Fallo USB Web: " + err.message);
                }
            }
        }
    }
};
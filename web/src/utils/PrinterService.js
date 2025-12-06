import qz from 'qz-tray';
import { sha256 } from 'js-sha256';

const isElectron = !!window.electronAPI;

// TUS IDS DE ZADIG
const MY_VID = 0x1FC9; 
const MY_PID = 0x2016;

// --- SEGURIDAD QZ ---
qz.api.setSha256Type(data => sha256(data));
qz.api.setPromiseType(resolver => new Promise(resolver));

qz.security.setCertificatePromise((resolve) => {
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

qz.security.setSignaturePromise(() => (resolve) => resolve());

export const PrinterService = {
    
    // 1. LISTAR IMPRESORAS
    async listarUSB() {
        if (isElectron) {
            try {
                const list = await window.electronAPI.listUsbDevices();
                return list.map(d => ({ name: d.name, val: { vid: d.vid, pid: d.pid }, type: 'ELECTRON' }));
            } catch (e) { return []; }
        } else {
            // WEB: Retornamos la impresora hardcodeada para Zadig
            return [{
                name: "XPrinter (Web Zadig)",
                val: { vid: MY_VID, pid: MY_PID }, 
                type: 'QZ_RAW'
            }];
        }
    },

    // 2. IMPRIMIR
    async imprimir(params) {
        if (isElectron) {
            // MODO ELECTRON
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
            // MODO WEB (QZ Tray)
            if (!qz.websocket.isActive()) await qz.websocket.connect();

            // --- CORRECCIÓN CRÍTICA: CONVERTIR A BASE64 ---
            // QZ Tray maneja Base64 mucho mejor que Uint8Array crudo en WebSockets
            let binary = '';
            const bytes = new Uint8Array(params.rawBytes);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Data = window.btoa(binary);
            // ----------------------------------------------

            // A. LAN
            if (params.printerType === 'lan') {
                const config = qz.configs.create({ host: params.ip, port: params.port });
                const data = [{ 
                    type: 'raw', 
                    format: 'command', 
                    flavor: 'base64', // Cambiado a base64
                    data: base64Data 
                }];
                return await qz.print(config, data);
            } 
            
            // B. USB RAW (ZADIG)
            else {
                const config = qz.configs.create({
                    vendor: params.printerVal?.vid || MY_VID,
                    product: params.printerVal?.pid || MY_PID,
                    index: 0,
                    endpoint: 0x03 
                });

                const uint8Data = new Uint8Array(params.rawBytes);

                try {
                    await qz.usb.claim(config); 
                    await qz.usb.sendData(config, uint8Data); 
                    await qz.usb.release(config);
                    return true;
                } catch (err) {

                    console.warn("Fallo USB Raw Directo, intentando modo Driver...", err);
                    
                    throw new Error("Fallo USB Web: " + err.message);
                }
            }
        }
    }
};
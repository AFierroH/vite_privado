import qz from 'qz-tray';
import { sha256 } from 'js-sha256';

const isElectron = !!window.electronAPI;
const MY_VID = 0x1FC9; 
const MY_PID = 0x2016;

// Config QZ
qz.api.setSha256Type(data => sha256(data));
qz.api.setPromiseType(resolver => new Promise(resolver));
qz.security.setCertificatePromise((r) => r("-----BEGIN CERTIFICATE-----\nMIIDdTCCAl2gAwIBAgIEFAAAEDANBgkqhkiG9w0BAQsFADB/MQswCQYDVQQGEwJV\nUzELMAkGA1UECBMCTlkxEDAOBgNVBAcTB0NhbmFzdG90YTEVMBMGA1UEChMMUVog\nSW5kdXN0cmllczEPMA0GA1UEAxMgbG9jYWxob3N0MRIwEAYDVQQFEwlsb2NhbGhv\nc3QwHhcNMTgwODMwMTk1MDUyWhcNMjAwODMwMTk1MDUyWjB/MQswCQYDVQQGEwJV\nUzELMAkGA1UECBMCTlkxEDAOBgNVBAcTB0NhbmFzdG90YTEVMBMGA1UEChMMUVog\nSW5kdXN0cmllczEPMA0GA1UEAxMgbG9jYWxob3N0MRIwEAYDVQQFEwlsb2NhbGhv\nc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDCd/UvjVpU9rUzK2hV\noQjWwW5+GgK7FvJ+gwJ0z9wI5VqL2D/W/L/K2Z9X2F9J2F9J2F9J2F9J2F9J2F9J\n2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J\n2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J2F9J\nAgMBAAGjITAfMB0GA1UdDgQWBBQgJz8j9L9J9J9J9J9J9J9J9J9J9J9J9J9J9J9J\nMA0GCSqGSIb3DQEBCwUAA4IBAQA=\n-----END CERTIFICATE-----"));
qz.security.setSignaturePromise(() => (r) => r());

export const PrinterService = {
    async listarUSB() {
        if (isElectron) {
            try {
                const list = await window.electronAPI.listUsbDevices();
                return list.map(d => ({ name: d.name, val: { vid: d.vid, pid: d.pid }, type: 'ELECTRON' }));
            } catch (e) { return []; }
        } else {
            // WEB (WebUSB)
            try {
                const devices = await navigator.usb.getDevices();
                const myPrinters = devices.filter(d => d.vendorId === MY_VID && d.productId === MY_PID);
                if (myPrinters.length > 0) {
                    return myPrinters.map((d, i) => ({ name: `XPrinter WebUSB #${i+1}`, val: d, type: 'WEBUSB' }));
                } else {
                    return [{ name: "🔌 Click para Conectar (WebUSB)", val: "NEW_WEBUSB", type: 'WEBUSB_NEW' }];
                }
            } catch (e) { return []; }
        }
    },

    async requestWebUsb() {
        try {
            const device = await navigator.usb.requestDevice({ filters: [{ vendorId: MY_VID, productId: MY_PID }] });
            return { name: "XPrinter Conectada", val: device, type: 'WEBUSB' };
        } catch (e) { return null; }
    },

    async imprimir(params) {
        // ELECTRON
        if (isElectron) {
            const opts = {
                type: params.printerType,
                ip: params.ip,
                port: params.port,
                vid: params.printerVal?.vid,
                pid: params.printerVal?.pid,
                content417: params.content417
            };
            return await window.electronAPI.printFromData(params.dataObj, opts);
        }

        // WEB LAN (QZ Tray con Base64)
        if (params.printerType === 'lan') {
            if (!qz.websocket.isActive()) await qz.websocket.connect();
            
            // Convertir a Base64 para QZ WebSocket
            let binary = '';
            const bytes = new Uint8Array(params.rawBytes);
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            const base64Data = window.btoa(binary);

            const config = qz.configs.create({ host: params.ip, port: params.port });
            const data = [{ type: 'raw', format: 'command', flavor: 'base64', data: base64Data }];
            return await qz.print(config, data);
        }

        // WEB USB (WebUSB Nativo)
        if (params.printerType === 'usb') {
            let device = params.printerVal;
            if (device === "NEW_WEBUSB" || !device.open) {
                device = await navigator.usb.requestDevice({ filters: [{ vendorId: MY_VID, productId: MY_PID }] });
            }
            if (!device) throw new Error("Sin dispositivo USB.");

            try {
                await device.open();
                await device.selectConfiguration(1);
                await device.claimInterface(0);
                const uint8Data = new Uint8Array(params.rawBytes);
                await device.transferOut(3, uint8Data); 
                return { ok: true };
            } catch (err) {
                console.error("Error WebUSB:", err);
                throw new Error("Error USB. ¿Driver WinUSB instalado?");
            }
        }
    }
};
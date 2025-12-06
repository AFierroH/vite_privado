import qz from 'qz-tray';
import { sha256 } from 'js-sha256';

const isElectron = !!window.electronAPI;

// TUS IDS (Para WebUSB)
const MY_VID = 0x1FC9; 
const MY_PID = 0x2016;

// --- CONFIG QZ (SOLO PARA LAN) ---
qz.api.setSha256Type(data => sha256(data));
qz.api.setPromiseType(resolver => new Promise(resolver));
qz.security.setCertificatePromise((resolve) => resolve("-----BEGIN CERTIFICATE-----\n" +
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
            "-----END CERTIFICATE-----"));
qz.security.setSignaturePromise(() => (resolve) => resolve());


export const PrinterService = {
    
    // --- 1. LISTAR IMPRESORAS ---
    async listarUSB() {
        if (isElectron) {
            // MODO ELECTRON (Zadig Nativo)
            try {
                const list = await window.electronAPI.listUsbDevices();
                return list.map(d => ({ name: d.name, val: { vid: d.vid, pid: d.pid }, type: 'ELECTRON' }));
            } catch (e) { return []; }
        } else {
            // MODO WEB (WebUSB)
            // WebUSB requiere que el usuario haga click para dar permiso la primera vez.
            // Aquí solo listamos los que ya tienen permiso.
            try {
                const devices = await navigator.usb.getDevices();
                const myPrinters = devices.filter(d => d.vendorId === MY_VID && d.productId === MY_PID);
                
                if (myPrinters.length > 0) {
                    return myPrinters.map((d, i) => ({ 
                        name: `XPrinter WebUSB #${i+1}`, 
                        val: d, // Guardamos el objeto Device nativo
                        type: 'WEBUSB' 
                    }));
                } else {
                    // Si no hay permisos aún, devolvemos una opción "Conectar Nuevo"
                    return [{ name: "🔌 Click para Conectar XPrinter", val: "NEW_WEBUSB", type: 'WEBUSB_NEW' }];
                }
            } catch (e) {
                console.error("WebUSB no soportado:", e);
                return [];
            }
        }
    },

    // --- 2. SOLICITAR PERMISO WEBUSB (NUEVO) ---
    async requestWebUsb() {
        try {
            // Esto abre un popup nativo de Chrome
            const device = await navigator.usb.requestDevice({ filters: [{ vendorId: MY_VID, productId: MY_PID }] });
            return { name: "XPrinter Conectada", val: device, type: 'WEBUSB' };
        } catch (e) {
            console.error("Usuario canceló:", e);
            return null;
        }
    },

    // --- 3. IMPRIMIR ---
    async imprimir(params) {
        // params: { printerType, printerVal, ip, port, dataObj, rawBytes }

        // A. MODO ELECTRON
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

        // B. MODO WEB LAN (Usa QZ Tray porque WebUSB no hace red)
        if (params.printerType === 'lan') {
            if (!qz.websocket.isActive()) await qz.websocket.connect();
            const config = qz.configs.create({ host: params.ip, port: params.port });
            const uint8Data = new Uint8Array(params.rawBytes);
            const data = [{ type: 'raw', format: 'command', flavor: 'plain', data: uint8Data }];
            return await qz.print(config, data);
        }

        // C. MODO WEB USB (Usa WebUSB Nativo - Sin QZ Tray)
        if (params.printerType === 'usb') {
            let device = params.printerVal;

            // Si es el valor placeholder, pedimos permiso
            if (device === "NEW_WEBUSB" || !device.open) {
                device = await navigator.usb.requestDevice({ filters: [{ vendorId: MY_VID, productId: MY_PID }] });
            }

            if (!device) throw new Error("No se seleccionó dispositivo USB.");

            // PROCESO DE ENVÍO WEBUSB
            try {
                await device.open();
                await device.selectConfiguration(1);
                await device.claimInterface(0);

                const uint8Data = new Uint8Array(params.rawBytes);
                // Endpoint 3 (OUT) es el que descubrimos ayer
                await device.transferOut(3, uint8Data); 

                // Opcional: Cerrar o dejar abierto
                // await device.close(); 
                return { ok: true };
            } catch (err) {
                console.error("Error WebUSB:", err);
                throw new Error("Fallo WebUSB (Asegúrate de tener driver Zadig/WinUSB): " + err.message);
            }
        }
    }
};
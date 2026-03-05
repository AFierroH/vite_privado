import qz from 'qz-tray';
import { sha256 } from 'js-sha256';
import { KJUR, KEYUTIL } from 'jsrsasign';

const isElectron = !!window.electronAPI;
const MY_VID = 0x1FC9; 
const MY_PID = 0x2016;

if (!isElectron) {
    qz.api.setSha256Type(data => sha256(data));
    qz.api.setPromiseType(resolver => new Promise(resolver));
    
    // 1. INYECTAR EL CERTIFICADO DIGITAL
    qz.security.setCertificatePromise((resolve) => {
        resolve("-----BEGIN CERTIFICATE-----\n" +
        "MIIECzCCAvOgAwIBAgIGAZy8UIa6MA0GCSqGSIb3DQEBCwUAMIGiMQswCQYDVQQG\n" +
        "EwJVUzELMAkGA1UECAwCTlkxEjAQBgNVBAcMCUNhbmFzdG90YTEbMBkGA1UECgwS\n" +
        "UVogSW5kdXN0cmllcywgTExDMRswGQYDVQQLDBJRWiBJbmR1c3RyaWVzLCBMTEMx\n" +
        "HDAaBgkqhkiG9w0BCQEWDXN1cHBvcnRAcXouaW8xGjAYBgNVBAMMEVFaIFRyYXkg\n" +
        "RGVtbyBDZXJ0MB4XDTI2MDMwNDA0NDUxOVoXDTQ2MDMwNDA0NDUxOVowgaIxCzAJ\n" +
        "BgNVBAYTAlVTMQswCQYDVQQIDAJOWTESMBAGA1UEBwwJQ2FuYXN0b3RhMRswGQYD\n" +
        "VQQKDBJRWiBJbmR1c3RyaWVzLCBMTEMxGzAZBgNVBAsMElFaIEluZHVzdHJpZXMs\n" +
        "IExMQzEcMBoGCSqGSIb3DQEJARYNc3VwcG9ydEBxei5pbzEaMBgGA1UEAwwRUVog\n" +
        "VHJheSBEZW1vIENlcnQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDh\n" +
        "qIOuTqSoYbSsV56HYs4oPgrQBQ4cG+mWJNGG8MV8bpEfYzGBUAyEZbQLHTHTn1Gv\n" +
        "j/vHhJrRoJ7ovl7R0cscDKruTxjNLVzJN90qy2U76HzHm6RozbCregySeJuzWKwj\n" +
        "Z6Fm92WFG6Ww8V3F1qV3XNVpIEDXhI4RAy44TvOxr9l8BFdwjTTC8UcmxE1+rByL\n" +
        "ZpykjhkzjpjR1EFW6p8mWodIwqQjd+MV0zs4otC6zqadXjqbIIzh8k9xFCbw2TKm\n" +
        "4bLSmLOELXBncVWhKFj/iW+x//5dzuD+p5l5mViqvOVwBYOhsJ1RRO/dLPuQqJhH\n" +
        "KoNfOdhI1PsRh+P6iTDvAgMBAAGjRTBDMBIGA1UdEwEB/wQIMAYBAf8CAQEwDgYD\n" +
        "VR0PAQH/BAQDAgEGMB0GA1UdDgQWBBT/q/TMapQBjmFRUOKzLAdmr1E1YzANBgkq\n" +
        "hkiG9w0BAQsFAAOCAQEAB4aM64PLdiNx4IJa1UNg6B79SFccYJ8hz3ZLAeWojsmv\n" +
        "DVCPpY2GFb2wMYaYUQP7mkDpD4EBwxgLuTZ6jQ4LJFUVKGZMNNT0yIuHEtruWiG6\n" +
        "dWxkY5sGLFL50Z8uGd1Lw4x9gneWWhbXIibUohxn/VLw6WapBC1bYuiiikyqy3qj\n" +
        "gvO4vDLFJrYC4Qi0OSV/a1Y1921cexnheWibbBAKoCP5e/m5LKwoLpONeuosHNp3\n" +
        "hvOeoMnHicZlMDV/KHHZLJDHY2U5BdgkoTe/EiLfuo8A1gXuV0Tg3MccRGzP1kna\n" +
        "Tvhm+yRm8rkZmYyqhtXgntBoA1o4pgiTKJxFU7tPzg==\n" +
        "-----END CERTIFICATE-----");
    });

    // 2. FIRMAR CON LA LLAVE PRIVADA USANDO JSRSASIGN
    qz.security.setSignaturePromise((toSign) => {
        return (resolve, reject) => {
            try {
                const pk = KEYUTIL.getKey("-----BEGIN PRIVATE KEY-----\n" +
                "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDhqIOuTqSoYbSs\n" +
                "V56HYs4oPgrQBQ4cG+mWJNGG8MV8bpEfYzGBUAyEZbQLHTHTn1Gvj/vHhJrRoJ7o\n" +
                "vl7R0cscDKruTxjNLVzJN90qy2U76HzHm6RozbCregySeJuzWKwjZ6Fm92WFG6Ww\n" +
                "8V3F1qV3XNVpIEDXhI4RAy44TvOxr9l8BFdwjTTC8UcmxE1+rByLZpykjhkzjpjR\n" +
                "1EFW6p8mWodIwqQjd+MV0zs4otC6zqadXjqbIIzh8k9xFCbw2TKm4bLSmLOELXBn\n" +
                "cVWhKFj/iW+x//5dzuD+p5l5mViqvOVwBYOhsJ1RRO/dLPuQqJhHKoNfOdhI1PsR\n" +
                "h+P6iTDvAgMBAAECggEAO9UzvScLD76AamX9GcbABPmWYlvExv07rVzr1YzHwFuM\n" +
                "zTa+7JuuBfj1iTDfgk4vGY7i4p8tccHWAL5hY97trO1K8U81s0mA3bWbRfqSSBU3\n" +
                "6LFDIarQWldNOBUUq7QqSGT07dlRKL8Q6t7Ez20/iGusBmjP6JU0Ghyux61fflAz\n" +
                "lMikDGuNDiYZdhIuUGRIELywNnkwz1LLgFOVQySZ4oBM6NJvzgfXr4i8OfZdITuf\n" +
                "tUIeee1J1NOBisN/zxZIs8i4TEFzyYlg3WF9Y4Dh1mxH6pwl/sIxO51oSt/beqTO\n" +
                "ioIG1Ldmq9pWfOELlDhbloijsVINGbgaOkZe9yrimQKBgQD7FGtr7tDKHDELZf1o\n" +
                "SdwuH3oc0jTgbS8Rra1bHO02SYbIYXw2D29lNqcCl00nUcu1i6fXgA1NIJC4jdIc\n" +
                "K/K91zBhRV3VO+yeCsvo5y+VVbK/OqenSKY4MkPw7qSBVIxD0AfuxziPU/sO+8Jd\n" +
                "yDkeE6CsG+uMCAbAnwIYkkLGfQKBgQDmFJBZK/i1SegmAYPfjjKsig38c/f4jM5N\n" +
                "H9WN/DSUu7xu9xPcMaZhRWwS4FIJSvJl/Cly6aM+i7FBWV1gXmwYLLwHEQMuJSxw\n" +
                "+K79P6WgPjB2O1NShF5qv+MT68nVOPyYQ/Nd+uQUXVtJapvb60rme+Y1OZYgHn3S\n" +
                "Og9yqvg02wKBgH8IN8lmDNEVLmM7+Ng49mOHnXrTh9k8pKHnI1yD6CidTso3OGcJ\n" +
                "rCyjWCBheLG6Gr0BqavIp/Ir1czqRDHosmoGY/3y4KSwKulTQRPXVCXUNBm4jXZ/\n" +
                "tUmddO6Db0vYAReWO00+EonBzbYo/pAAa5WiDJrHjYdN0EzIpoDUD2DpAoGAHtsB\n" +
                "JMRN3VolBPvNCK0URKlbCNEwnyea/yLWy+zXzF6E/ciq5CvQaVkbDkkBF3fynBS+\n" +
                "JkgI+XlYczAd4q+nBXLyYGw6pfScSiY/qXzgpGXSr/hyyy0vUFedh21mqu6yiWUL\n" +
                "fT4JWmXOuUDP2CVs7Q4OqHKpnHMaYpggvDsLgGMCgYAZ1VbrP/veMyXIFThafXlc\n" +
                "OhkmfAceiYcdkSkgA5QQcKJ9DkGgz1IhTwvh1KLLjfKMtW6He7fzltIPycogoMTE\n" +
                "ld1jicaBP4YkkwF2FWvmgTTuU6hJdQU6Cqz1Y623jGMC1RnbTGA8hIzW2C/KJRHJ\n" +
                "vWrpAyyEwoPrRz6iApyKVw==\n" +
                "-----END PRIVATE KEY-----");
                
                const sig = new KJUR.crypto.Signature({"alg": "SHA512withRSA"});
                sig.init(pk);
                sig.updateString(toSign);
                const hex = sig.sign();
                resolve(hex);
            } catch (err) {
                reject(err);
            }
        };
    });
}

export const PrinterService = {
    async listarUSB() {
        if (isElectron) {
            try {
                const list = await window.electronAPI.listUsbDevices();
                return list.map(d => ({ name: d.name, val: { vid: d.vid, pid: d.pid }, type: 'ELECTRON' }));
            } catch (e) { return []; }
        } else {
            // QZ Tray como método principal para la Web
            try {
                if (!qz.websocket.isActive()) await qz.websocket.connect();
                const printers = await qz.printers.find();
                return printers.map((p, i) => ({ name: p, val: p, type: 'QZ_TRAY' }));
            } catch (e) {
                console.warn("QZ Tray no conectado. Iniciando app local...");
                return [{ name: "Inicia QZ Tray en tu PC", val: null, type: 'ERROR' }];
            }
        }
    },
    async imprimir(params) {
        if (isElectron) {
            const payload = {
                printerType: params.printerType,
                vid: params.printerVal?.vid,
                pid: params.printerVal?.pid,
                ip: params.ip,
                port: params.port,
                rawBytes: Array.from(params.rawBytes || []) 
            };
            return await window.electronAPI.printRaw(payload);
        }
        
        // MODO WEB con QZ Tray (Redirecciona todo a QZ Tray)
        try {
            if (!qz.websocket.isActive()) await qz.websocket.connect();
            
            const bytes = new Uint8Array(params.rawBytes);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            const base64Data = window.btoa(binary);
            
            // Si eligen USB (val=nombre impresora) o LAN
            const configObj = params.printerType === 'lan' 
                ? { host: params.ip, port: params.port } 
                : params.printerVal; // El nombre de la impresora detectada por QZ Tray
                
            const config = qz.configs.create(configObj);
            const data = [{ type: 'raw', format: 'command', flavor: 'base64', data: base64Data }];
            
            await qz.print(config, data);
            return { ok: true };
        } catch (e) {
            console.error("Fallo QZ Tray:", e);
            throw e;
        }
    }
};
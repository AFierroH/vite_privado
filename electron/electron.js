import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import os from 'os'; 

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escpos = require('escpos');
try { escpos.USB = require('escpos-usb'); } catch (e) {}
escpos.Network = require('escpos-network');

ipcMain.handle('getLocalIp', async () => {
    const nets = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name of Object.keys(nets)) {
        for (const netInterface of nets[name]) {
            if (netInterface.family === 'IPv4' && !netInterface.internal) {
                localIp = netInterface.address;
                break;
            }
        }
        if (localIp !== '127.0.0.1') break;
    }
    return localIp;
});

ipcMain.handle("listUsbDevices", async () => {
    try {
        if (!escpos.USB) return [];
        const devices = escpos.USB.findPrinter();
        return devices.map(d => ({
            name: `USB Printer (VID:${d.deviceDescriptor.idVendor.toString(16).toUpperCase()} PID:${d.deviceDescriptor.idProduct.toString(16).toUpperCase()})`,
            vid: d.deviceDescriptor.idVendor,
            pid: d.deviceDescriptor.idProduct
        }));
    } catch(e) { return []; }
});

ipcMain.handle('cacheLogo', async (event, { empresaId, logoUrl }) => {
  try {
    const logosDir = path.join(app.getPath('userData'), 'logos')
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true })
    }

    const ext = path.extname(logoUrl).split('?')[0] || '.png'
    const localPath = path.join(logosDir, `empresa_${empresaId}${ext}`)

    const res = await fetch(logoUrl)
    const buffer = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(localPath, buffer)

    return {
      ok: true,
      localPath
    }
  } catch (e) {
    console.error('Error cacheando logo:', e)
    return { ok: false, error: String(e) }
  }
});

ipcMain.handle('printRaw', async (event, params) => {
    try {
        console.log("[Electron] Imprimiendo RAW bytes (Size: " + params.rawBytes.length + ")");
        const bytes = Buffer.from(params.rawBytes);

        if (params.printerType === 'usb') {
            if (!escpos.USB) throw new Error("Driver USB no cargado");
            const device = (params.vid && params.pid) 
                ? new escpos.USB(params.vid, params.pid) 
                : new escpos.USB();
                
            return new Promise((resolve, reject) => {
                device.open((err) => {
                    if (err) return reject(err);
                    device.write(bytes, (err) => {
                        if (err) return reject(err);
                        device.close(() => resolve({ ok: true }));
                    });
                });
            });
        }
        
        if (params.printerType === 'lan') {
             const device = new escpos.Network(params.ip, params.port || 9100);
             return new Promise((resolve, reject) => {
                device.open((err) => {
                    if (err) return reject(err);
                    device.write(bytes, (err) => {
                        if (err) return reject(err);
                        device.close(() => resolve({ ok: true }));
                    });
                });
             });
        }
    } catch (err) {
        console.error("Error impresión RAW:", err);
        return { ok: false, error: String(err) };
    }
});

let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200, height: 800,
      icon: path.join(__dirname, 'build/icon.ico'), 
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
    });
    const isDev = !app.isPackaged; 
    if (isDev) mainWindow.loadURL('http://localhost:5173');
    else mainWindow.loadURL('https://miposra.site'); 
}
app.whenReady().then(createWindow);
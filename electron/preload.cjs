const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  listUsbDevices: () => ipcRenderer.invoke('listUsbDevices'),
  listSystemPrinters: () => ipcRenderer.invoke('listSystemPrinters'),
  pingPrinter: (ip, port) => ipcRenderer.invoke('pingPrinter', ip, port),
  printRaw: (payload) => ipcRenderer.invoke('printRaw', payload),
  detectScanners: () => ipcRenderer.invoke('detectScanners'),
  discoverLanPrinters: (opts) => ipcRenderer.invoke('discover-lan-printers', opts),
  getLocalIp: () => ipcRenderer.invoke('getLocalIp'),
  buildTicket: (sale, opts) => ipcRenderer.invoke('buildTicket', sale, opts),
  printFromData: (sale, opts) => ipcRenderer.invoke('printFromData', sale, opts),
  cacheLogo: (empresaId, logoUrl) =>
    ipcRenderer.invoke('cacheLogo', { empresaId, logoUrl }),
});
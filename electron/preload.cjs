const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  listSystemPrinters: () => ipcRenderer.invoke('listSystemPrinters'),
  listUsbDevices: () => ipcRenderer.invoke('listUsbDevices'),
  detectScanners: () => ipcRenderer.invoke('detectScanners'),
  pingPrinter: (ip, port) => ipcRenderer.invoke('pingPrinter', ip, port),
  printRaw: (data, options) => ipcRenderer.invoke('printRaw', data, options),
  discoverLanPrinters: (options) => ipcRenderer.invoke('discover-lan-printers', options),
  
  // construir ticket o imprimir desde datos JS
  buildTicket: (sale, opts) => ipcRenderer.invoke('buildTicket', sale, opts),
  printFromData: (sale, options) => ipcRenderer.invoke('printFromData', sale, options),
  cacheLogo: (url) => ipcRenderer.invoke('cacheLogo', url),
});
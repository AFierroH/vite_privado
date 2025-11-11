const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  listSystemPrinters: () => ipcRenderer.invoke('listSystemPrinters'),
  listUsbDevices: () => ipcRenderer.invoke('listUsbDevices'),
  detectScanners: () => ipcRenderer.invoke('detectScanners'),
  pingPrinter: (ip, port) => ipcRenderer.invoke('pingPrinter', ip, port),
  printRaw: (data, options) => ipcRenderer.invoke('printRaw', data, options),
  discoverLanPrinters: (options) => ipcRenderer.invoke('discover-lan-printers', options),
})
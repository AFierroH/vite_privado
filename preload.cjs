const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  listSystemPrinters: () => ipcRenderer.invoke('list-printers'),
  listUsbDevices: () => ipcRenderer.invoke('list-usb-devices'),
  listSerialPorts: () => ipcRenderer.invoke('list-serial-ports'),
  detectScanners: () => ipcRenderer.invoke('detect-scanners'),
  printRaw: (base64, options) => ipcRenderer.invoke('print-raw', base64, options)
})
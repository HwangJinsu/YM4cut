const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  saveImage: (data) => ipcRenderer.invoke('save-image', data),
  composeImages: (images) => ipcRenderer.invoke('compose-images', images),
  printImage: (args) => ipcRenderer.invoke('print-image', args),
  openFileDialog: (defaultPath) => ipcRenderer.invoke('open-file-dialog', defaultPath),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getDefaultOutputPath: () => ipcRenderer.invoke('get-default-output-path'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getImageAsBase64: (filePath) => ipcRenderer.invoke('get-image-as-base64', filePath),
  quitApp: () => ipcRenderer.invoke('quit-app'),
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onNewTab: (callback) => ipcRenderer.on('shortcut-new-tab', () => callback()),
  onCloseTab: (callback) => ipcRenderer.on('shortcut-close-tab', () => callback())
});

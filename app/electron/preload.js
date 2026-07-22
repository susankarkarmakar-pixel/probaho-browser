const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onNewTab: (callback) => ipcRenderer.on('shortcut-new-tab', () => callback()),
  onCloseTab: (callback) => ipcRenderer.on('shortcut-close-tab', () => callback()),
  onDownloadUpdate: (callback) => ipcRenderer.on('download-update', (event, downloadItem) => callback(downloadItem)),
  onOpenLinkNewTab: (callback) => ipcRenderer.on('open-link-new-tab', (event, url) => callback(url)),
  showContextMenu: (params) => ipcRenderer.send('show-context-menu', params),
  onContextMenuAction: (callback) => ipcRenderer.on('context-menu-action', (event, action, x, y) => callback(action, x, y)),
  onFind: (callback) => ipcRenderer.on('shortcut-find', () => callback()),
  openFile: (path) => ipcRenderer.send('open-file', path),
  showInFolder: (path) => ipcRenderer.send('show-in-folder', path),
  setAdBlocker: (enabled) => ipcRenderer.send('set-adblocker', enabled),
  onAdBlocked: (callback) => ipcRenderer.on('ad-blocked', (event, webContentsId) => callback(webContentsId))
});

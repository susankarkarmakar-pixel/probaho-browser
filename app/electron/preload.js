const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onNewTab: (callback) => ipcRenderer.on('shortcut-new-tab', () => callback()),
  onNewPrivateTab: (callback) => ipcRenderer.on('shortcut-new-private-tab', () => callback()),
  onCloseTab: (callback) => ipcRenderer.on('shortcut-close-tab', () => callback()),
  onDownloadUpdate: (callback) => ipcRenderer.on('download-update', (event, downloadItem) => callback(downloadItem)),
  onOpenLinkNewTab: (callback) => ipcRenderer.on('open-link-new-tab', (event, url) => callback(url)),
  showContextMenu: (params) => ipcRenderer.send('show-context-menu', params),
  onContextMenuAction: (callback) => ipcRenderer.on('context-menu-action', (event, action, x, y) => callback(action, x, y)),
  onFind: (callback) => ipcRenderer.on('shortcut-find', () => callback()),
  onCycleTabPrev: (callback) => ipcRenderer.on('shortcut-cycle-tab-prev', () => callback()),
  onCycleTabNext: (callback) => ipcRenderer.on('shortcut-cycle-tab-next', () => callback()),
  onJumpTab: (callback) => ipcRenderer.on('shortcut-jump-tab', (event, index) => callback(index)),
  onFocusAddress: (callback) => ipcRenderer.on('shortcut-focus-address', () => callback()),
  onTabCrashed: (callback) => ipcRenderer.on('tab-crashed', (event, webContentsId, reason) => callback(webContentsId, reason)),
  openFile: (path) => ipcRenderer.send('open-file', path),
  showInFolder: (path) => ipcRenderer.send('show-in-folder', path),
  setAdBlocker: (enabled) => ipcRenderer.send('set-adblocker', enabled),
  onAdBlocked: (callback) => ipcRenderer.on('ad-blocked', (event, webContentsId) => callback(webContentsId)),

  onOpenPdfViewer: (callback) => ipcRenderer.on('open-pdf-viewer', (event, url) => callback(url)),
  fetchPdf: (url) => ipcRenderer.invoke('fetch-pdf', url),
  clearCache: () => ipcRenderer.send('clear-cache'),
  getPermissions: () => ipcRenderer.invoke('get-permissions'),
  deletePermission: (origin, permission) => ipcRenderer.send('delete-permission', origin, permission),
  cancelDownload: (id) => ipcRenderer.send('cancel-download', id),
  openPrivateWindow: () => ipcRenderer.send('open-private-window')

});

const { app, BrowserWindow, ipcMain, session, shell, Menu, dialog, clipboard } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const blocklist = require('./blocklist');
const permissionsStore = require('./permissions-store');
const passwordsStore = require('./passwords-store');
const fs = require('fs');

let mainWindow;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const PDF_FETCH_TIMEOUT_MS = 30_000;

function isAllowedNavigationUrl(rawUrl) {
  if (rawUrl === 'about:blank') return true;
  try {
    const parsedUrl = new URL(rawUrl);
    return ['http:', 'https:', 'view-source:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

function isTrustedAppSender(event) {
  const senderUrl = event.senderFrame?.url || event.sender.getURL();
  return senderUrl.startsWith('file://');
}

function requireTrustedAppSender(event) {
  if (!isTrustedAppSender(event)) {
    throw new Error('Untrusted IPC sender');
  }
}

async function fetchPdfBytes(rawUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error('Invalid PDF URL');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS PDFs are supported');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PDF_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_PDF_BYTES) {
      throw new Error('PDF exceeds the 50 MB limit');
    }

    if (!response.body) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_PDF_BYTES) {
        throw new Error('PDF exceeds the 50 MB limit');
      }
      return buffer;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_PDF_BYTES) {
          await reader.cancel();
          throw new Error('PDF exceeds the 50 MB limit');
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    return Buffer.concat(chunks, totalBytes);
  } finally {
    clearTimeout(timeout);
  }
}

function createWindow(isPrivate = false) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true
    }
  });

  // Load the index.html from a url in development or local file in production.
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const loadOptions = isPrivate ? { query: { private: 'true' } } : undefined;
  if (isDev) {
    // We'd normally use the Vite dev server URL here, but let's assume local build for simplicity, or we can use dist.
    // To make it simple for the user's build scripts, we'll always load from dist when packaged.
    // If we're not packaged, we can load from a dev server or dist. The instructions say `npm run build` then `npm run electron`.
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), loadOptions);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), loadOptions);
  }

  // Handle local shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    // Handle Ctrl/Cmd+T and Ctrl/Cmd+W
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'n') {
      mainWindow.webContents.send('shortcut-new-private-tab');
      event.preventDefault();
    } else if ((input.control || input.meta) && !input.shift && input.key.toLowerCase() === 'n') {
      mainWindow.webContents.send('shortcut-new-window');
      event.preventDefault();
    } else if ((input.control || input.meta) && input.key.toLowerCase() === 't') {
      mainWindow.webContents.send('shortcut-new-tab');
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.key.toLowerCase() === 'w') {
      mainWindow.webContents.send('shortcut-close-tab');
      event.preventDefault();
    }

    if ((input.control || input.meta) && input.key.toLowerCase() === 'f') {
      mainWindow.webContents.send('shortcut-find');
      event.preventDefault();
    }

    // Tab cycling and jumping
    if ((input.control || input.meta) && input.key === 'Tab') {
      if (input.shift) {
        mainWindow.webContents.send('shortcut-cycle-tab-prev');
      } else {
        mainWindow.webContents.send('shortcut-cycle-tab-next');
      }
      event.preventDefault();
    }

    if ((input.control || input.meta) && /^[1-9]$/.test(input.key)) {
      mainWindow.webContents.send('shortcut-jump-tab', parseInt(input.key, 10));
      event.preventDefault();
    }

    if ((input.control || input.meta) && input.key.toLowerCase() === 'l') {
      mainWindow.webContents.send('shortcut-focus-address');
      event.preventDefault();
    }

    // New shortcuts
    if (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r')) {
      mainWindow.webContents.send('shortcut-reload');
      event.preventDefault();
    }
    if (input.key === 'F12' || ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.send('shortcut-devtools');
      event.preventDefault();
    }
    if (input.key === 'F11') {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        win.setFullScreen(!win.isFullScreen());
      }
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.key.toLowerCase() === 'h') {
      mainWindow.webContents.send('shortcut-open-history');
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.key.toLowerCase() === 'j') {
      mainWindow.webContents.send('shortcut-open-downloads');
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.key.toLowerCase() === 'b') {
      mainWindow.webContents.send('shortcut-open-bookmarks');
      event.preventDefault();
    }
    if ((input.control || input.meta) && (input.key === '=' || input.key === '+')) {
      mainWindow.webContents.send('shortcut-zoom-in');
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.key === '-') {
      mainWindow.webContents.send('shortcut-zoom-out');
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.key === '0') {
      mainWindow.webContents.send('shortcut-zoom-reset');
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.key.toLowerCase() === 'k') {
      mainWindow.webContents.send('shortcut-command-palette');
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 't') {
      mainWindow.webContents.send('shortcut-restore-tab');
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'b') {
      mainWindow.webContents.send('shortcut-toggle-bookmarks-bar');
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.shift && input.key === 'Delete') {
      mainWindow.webContents.send('shortcut-open-settings');
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.key.toLowerCase() === 'u') {
      mainWindow.webContents.send('shortcut-view-source');
      event.preventDefault();
    }
    if (input.type === 'keyDown' && (input.key === 'BrowserBack' || input.key === 'BrowserForward' || (input.alt && (input.key === 'ArrowLeft' || input.key === 'ArrowRight')))) {
       // app-command takes care of this on Windows, but this is a fallback for some environments
       const isBack = input.key === 'BrowserBack' || (input.alt && input.key === 'ArrowLeft');
       const cmd = isBack ? 'browser-backward' : 'browser-forward';
       mainWindow.webContents.send('app-command', cmd);
       event.preventDefault();
    }
  });

  mainWindow.on('app-command', (e, cmd) => {
    mainWindow.webContents.send('app-command', cmd);
  });
}




app.whenReady().then(() => {
  session.defaultSession.setWebRTCIPHandlingPolicy('disable-non-proxied-udp');
  createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of Probaho Browser is ready. Restart now to install?',
        buttons: ['Restart Now', 'Later']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
  }

  let adBlockerEnabled = true;
  let currentSettings = {};
  const activeDownloadsMap = new Map();
  const configuredPrivateSessions = new WeakSet();

  const configurePrivateSession = (privateSession) => {
    if (configuredPrivateSessions.has(privateSession)) return;
    configuredPrivateSessions.add(privateSession);
    privateSession.setWebRTCIPHandlingPolicy('disable-non-proxied-udp');

    privateSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
      if (currentSettings.doNotTrack) details.requestHeaders.DNT = '1';
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    privateSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      let origin;
      try {
        origin = new URL(details.requestingUrl).origin;
      } catch {
        return callback(false);
      }

      const promptPermissions = ['media', 'geolocation', 'notifications'];
      if (!promptPermissions.includes(permission)) return callback(false);

      dialog.showMessageBox({
        type: 'question',
        title: 'Private Window Permission Request',
        message: `${origin} wants to access your ${permission}. This decision will not be saved.`,
        buttons: ['Allow Once', 'Block'],
        defaultId: 1,
        cancelId: 1
      }).then(result => callback(result.response === 0)).catch(() => callback(false));
    });

    privateSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      if (!adBlockerEnabled) return callback({ cancel: false });
      const url = details.url.toLowerCase();
      if (!blocklist.some(domain => url.includes(domain))) return callback({ cancel: false });

      const wc = details.webContentsId ? require('electron').webContents.fromId(details.webContentsId) : null;
      const hostContents = wc?.hostWebContents || wc;
      if (hostContents && !hostContents.isDestroyed()) {
        hostContents.send('ad-blocked', details.webContentsId);
      }
      callback({ cancel: true });
    });
  };

  ipcMain.on('set-adblocker', (event, enabled) => {
    requireTrustedAppSender(event);
    if (typeof enabled === 'boolean') adBlockerEnabled = enabled;
  });

  ipcMain.on('update-settings', (event, settings) => {
    requireTrustedAppSender(event);
    if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
      currentSettings = {
        doNotTrack: settings.doNotTrack === true,
        askDownloadLocation: settings.askDownloadLocation === true
      };
    }
  });

  ipcMain.on('cancel-download', (event, id) => {
    requireTrustedAppSender(event);
    if (typeof id !== 'string') return;
    const item = activeDownloadsMap.get(id);
    if (item) {
      item.cancel();
      activeDownloadsMap.delete(id);
    }
  });

  ipcMain.on('pause-download', (event, id) => {
    requireTrustedAppSender(event);
    if (typeof id !== 'string') return;
    const item = activeDownloadsMap.get(id);
    if (item && item.canResume()) {
      item.pause();
    }
  });

  ipcMain.on('resume-download', (event, id) => {
    requireTrustedAppSender(event);
    if (typeof id !== 'string') return;
    const item = activeDownloadsMap.get(id);
    if (item && item.canResume()) {
      item.resume();
    }
  });

  ipcMain.on('open-private-window', (event) => {
    requireTrustedAppSender(event);
    createWindow(true);
  });

  ipcMain.on('open-new-window', (event) => {
    requireTrustedAppSender(event);
    createWindow(false);
  });

  ipcMain.handle('load-extension', async (event) => {
    requireTrustedAppSender(event);
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (!result.canceled) {
      await session.defaultSession.loadExtension(result.filePaths[0]);
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.on('clear-cache', (event) => {
    requireTrustedAppSender(event);
    session.defaultSession.clearCache().then(() => {
      console.log('Cache cleared');
    });
    session.defaultSession.clearStorageData({ storages: ['cookies', 'cachestorage'] }).then(() => {
      console.log('Storage data cleared (excluding localstorage)');
    });
  });

  ipcMain.handle('get-permissions', (event) => {
    requireTrustedAppSender(event);
    return permissionsStore.data;
  });

  ipcMain.handle('get-password', (event, origin) => {
    requireTrustedAppSender(event);
    if (typeof origin !== 'string') return null;
    return passwordsStore.getPassword(origin);
  });

  ipcMain.handle('get-all-passwords', (event) => {
    requireTrustedAppSender(event);
    return passwordsStore.getAllPasswords();
  });

  ipcMain.on('save-password', (event, origin, creds) => {
    requireTrustedAppSender(event);
    if (typeof origin !== 'string' || !creds || typeof creds !== 'object') return;
    passwordsStore.setPassword(origin, creds);
  });

  ipcMain.on('delete-password', (event, origin) => {
    requireTrustedAppSender(event);
    if (typeof origin !== 'string') return;
    passwordsStore.deletePassword(origin);
  });

  ipcMain.on('delete-permission', (event, origin, permission) => {
    requireTrustedAppSender(event);
    if (typeof origin !== 'string' || typeof permission !== 'string') return;
    if (permissionsStore.data[origin] && permissionsStore.data[origin][permission] !== undefined) {
      delete permissionsStore.data[origin][permission];
      if (Object.keys(permissionsStore.data[origin]).length === 0) {
        delete permissionsStore.data[origin];
      }
      permissionsStore.saveData();
    }
  });

  ipcMain.on('save-as-pdf', async (event) => {
    requireTrustedAppSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    try {
      // Find the currently active webview inside the window, this is tricky via IPC.
      // Instead, we capture the window's webContents itself, which might just capture the UI.
      // To properly capture a page, it's better to tell the renderer to have the webview generate it, but webview.printToPDF is available.
      // However, we will emit an event back to the renderer to trigger `printToPDF` on the specific webview element for accuracy.
      win.webContents.send('trigger-save-as-pdf');
    } catch (e) {
      console.error('Failed to initiate PDF save', e);
    }
  });

  ipcMain.on('execute-save-pdf', async (event, data) => {
    requireTrustedAppSender(event);
    if (!(data instanceof Uint8Array) && !Buffer.isBuffer(data)) return;
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Save as PDF',
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });

    if (filePath) {
      try {
        // Here data is the Buffer sent from the renderer
        require('fs').writeFileSync(filePath, Buffer.from(data));
      } catch (err) {
        console.error('Failed to save PDF', err);
      }
    }
  });



  // Set a standard Chromium User Agent
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

    if (currentSettings.doNotTrack) {
      details.requestHeaders['DNT'] = '1';
    }

    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = new URL(details.requestingUrl).origin;

    // Ignore internal scheme
    if (origin.startsWith('probaho://')) {
      return callback(true);
    }

    const savedPermission = permissionsStore.getPermission(origin, permission);
    if (savedPermission !== null) {
      return callback(savedPermission);
    }

    // Only prompt for common sensitive permissions
    const promptPermissions = ['media', 'geolocation', 'notifications'];
    if (!promptPermissions.includes(permission)) {
       // Auto-allow or rely on default behavior for other things, or prompt. Let's auto-allow non-sensitive ones for simplicity unless otherwise requested.
       return callback(true);
    }

    dialog.showMessageBox({
      type: 'question',
      title: 'Permission Request',
      message: `${origin} wants to access your ${permission}.`,
      buttons: ['Allow', 'Block'],
      defaultId: 0,
      cancelId: 1
    }).then(result => {
      const allowed = result.response === 0;
      permissionsStore.setPermission(origin, permission, allowed);
      callback(allowed);
    }).catch(err => {
      console.error(err);
      callback(false);
    });
  });

  session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    if (adBlockerEnabled) {
      const url = details.url.toLowerCase();
      const isBlocked = blocklist.some(domain => url.includes(domain));
      if (isBlocked) {
        const wc = details.webContentsId ? require('electron').webContents.fromId(details.webContentsId) : null;
        const win = wc && wc.hostWebContents ? BrowserWindow.fromWebContents(wc.hostWebContents) : (wc ? BrowserWindow.fromWebContents(wc) : null);
        if (win) {
          win.webContents.send('ad-blocked', details.webContentsId);
        } else {
          // Fallback if window not found directly
          BrowserWindow.getAllWindows().forEach(w => w.webContents.send('ad-blocked', details.webContentsId));
        }
        return callback({ cancel: true });
      }
    }
    callback({ cancel: false });
  });


  session.defaultSession.on('will-download', (event, item, webContents) => {
    const url = item.getURL();
    const mimeType = item.getMimeType();

    // Check if it's a PDF
    if (url.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf') {
      event.preventDefault();

      // Let the renderer know to open this as a PDF instead of downloading
      const win = webContents && webContents.hostWebContents ? BrowserWindow.fromWebContents(webContents.hostWebContents) : (webContents ? BrowserWindow.fromWebContents(webContents) : null);
      if (win) {
        win.webContents.send('open-pdf-viewer', url, webContents.id);
      } else {
        BrowserWindow.getAllWindows().forEach(w => {
          w.webContents.send('open-pdf-viewer', url, webContents.id);
        });
      }
      return;
    }

    // Generate a unique ID for the download
    const downloadId = Date.now().toString();
    const fileName = item.getFilename();
    const savePath = path.join(app.getPath('downloads'), fileName);

    // Check if the user wants to be asked where to save the file
    if (!currentSettings.askDownloadLocation) {
      item.setSavePath(savePath);
    }

    activeDownloadsMap.set(downloadId, item);

    const win = webContents && webContents.hostWebContents ? BrowserWindow.fromWebContents(webContents.hostWebContents) : (webContents ? BrowserWindow.fromWebContents(webContents) : null);

    // Send initial download state
    if (win) {
      win.webContents.send('download-update', {
        id: downloadId,
        fileName: fileName,
        state: 'progressing',
        receivedBytes: 0,
        totalBytes: item.getTotalBytes(),
        savePath: savePath
      });
    } else {
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('download-update', {
        id: downloadId,
        fileName: fileName,
        state: 'progressing',
        receivedBytes: 0,
        totalBytes: item.getTotalBytes(),
        savePath: savePath
      }));
    }

    const updateTaskbarProgress = () => {
      let totalReceived = 0;
      let totalBytesAll = 0;
      let activeCount = 0;
      for (const [key, dlItem] of activeDownloadsMap.entries()) {
        const state = dlItem.getState();
        if (state === 'progressing') {
           activeCount++;
           totalReceived += dlItem.getReceivedBytes();
           totalBytesAll += dlItem.getTotalBytes();
        }
      }

      const windows = BrowserWindow.getAllWindows();
      if (activeCount > 0 && totalBytesAll > 0) {
         const progress = totalReceived / totalBytesAll;
         windows.forEach(w => w.setProgressBar(progress, { mode: 'normal' }));
      } else {
         windows.forEach(w => w.setProgressBar(-1));
      }
    };

    updateTaskbarProgress();

    item.on('updated', (event, state) => {
      updateTaskbarProgress();

      const isPaused = item.isPaused();
      const updatedState = isPaused ? 'paused' : state;

      if (win && !win.isDestroyed()) {
        win.webContents.send('download-update', {
          id: downloadId,
          fileName: fileName,
          state: updatedState,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          savePath: savePath
        });
      } else {
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send('download-update', {
          id: downloadId,
          fileName: fileName,
          state: updatedState,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          savePath: savePath
        }));
      }
    });

    item.once('done', (event, state) => {
      activeDownloadsMap.delete(downloadId);
      updateTaskbarProgress();
      if (win && !win.isDestroyed()) {
        win.webContents.send('download-update', {
          id: downloadId,
          fileName: fileName,
          state: state, // 'completed', 'cancelled', 'interrupted'
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          savePath: savePath
        });
      } else {
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send('download-update', {
          id: downloadId,
          fileName: fileName,
          state: state, // 'completed', 'cancelled', 'interrupted'
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          savePath: savePath
        }));
      }
    });
  });




  app.on('web-contents-created', (event, contents) => {
    contents.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

    contents.on('will-attach-webview', (event, webPreferences, params) => {
      delete webPreferences.preload;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;

      if (!isAllowedNavigationUrl(params.src)) {
        event.preventDefault();
        return;
      }

      if (params.partition?.startsWith('private-')) {
        configurePrivateSession(session.fromPartition(params.partition));
      }
    });

    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(({ url }) => {
        if (!isAllowedNavigationUrl(url)) return { action: 'deny' };
        contents.hostWebContents?.send('open-link-new-tab', url);
        return { action: 'deny' };
      });

      contents.on('will-navigate', (event, url) => {
        if (!isAllowedNavigationUrl(url)) {
          event.preventDefault();
          return;
        }
        if (url.toLowerCase().endsWith('.pdf')) {
          event.preventDefault();
          const win = contents.hostWebContents ? BrowserWindow.fromWebContents(contents.hostWebContents) : null;
          if (win) {
            win.webContents.send('open-pdf-viewer', url, contents.id);
          } else {
            BrowserWindow.getAllWindows().forEach(w => {
              w.webContents.send('open-pdf-viewer', url, contents.id);
            });
          }
        }
      });
    }
  });

app.on('render-process-gone', (event, webContents, details) => {
  const win = webContents && webContents.hostWebContents ? BrowserWindow.fromWebContents(webContents.hostWebContents) : (webContents ? BrowserWindow.fromWebContents(webContents) : null);
  if (win) {
    win.webContents.send('tab-crashed', webContents.id, details.reason);
  } else {
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('tab-crashed', webContents.id, details.reason);
    });
  }
});

app.on('child-process-gone', (event, details) => {
  // If it's a plugin/child process we might just log it, but if we need to reload tabs based on it:
  console.log('Child process gone:', details);
});

app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});



app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for window controls
ipcMain.on('window-minimize', (event) => {
  requireTrustedAppSender(event);
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
  requireTrustedAppSender(event);
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.restore();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window-close', (event) => {
  requireTrustedAppSender(event);
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});


ipcMain.on('open-file', (event, filePath) => {
  requireTrustedAppSender(event);
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return;
  shell.openPath(filePath);
});

ipcMain.on('show-in-folder', (event, filePath) => {
  requireTrustedAppSender(event);
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return;
  shell.showItemInFolder(filePath);
});

ipcMain.on('show-context-menu', (event, params) => {
  requireTrustedAppSender(event);
  if (!params || typeof params !== 'object') return;
  const win = BrowserWindow.fromWebContents(event.sender);
  const template = [
    {
      label: 'Back',
      click: () => { if (win) win.webContents.send('context-menu-action', 'back'); }
    },
    {
      label: 'Forward',
      click: () => { if (win) win.webContents.send('context-menu-action', 'forward'); }
    },
    {
      label: 'Reload',
      click: () => { if (win) win.webContents.send('context-menu-action', 'reload'); }
    },
    { type: 'separator' },
    { role: 'copy' }
  ];

  if (params.selectionText) {
    const trimmedText = params.selectionText.length > 15 ? params.selectionText.substring(0, 15) + '...' : params.selectionText;
    let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(params.selectionText)}`;
    const searchEngine = params.searchEngine || 'Google';
    if (searchEngine === 'Bing') {
      searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(params.selectionText)}`;
    } else if (searchEngine === 'DuckDuckGo') {
      searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(params.selectionText)}`;
    }

    template.push({
      label: `Search ${searchEngine} for "${trimmedText}"`,
      click: () => {
        if (win) win.webContents.send('open-link-new-tab', searchUrl);
      }
    });
  }

  if (params.linkURL) {
    template.push({ type: 'separator' });
    template.push({
      label: 'Open Link in New Tab',
      click: () => {
        if (win) {
          win.webContents.send('open-link-new-tab', params.linkURL);
        }
      }
    });
    template.push({
      label: 'Save Link As...',
      click: () => {
        if (win) {
          win.webContents.downloadURL(params.linkURL);
        }
      }
    });
    template.push({
      label: 'Copy Link Address',
      click: () => {
        clipboard.writeText(params.linkURL);
      }
    });
  }

  if (params.hasImageContents && params.srcURL) {
    template.push({ type: 'separator' });
    template.push({
      label: 'Open Image in New Tab',
      click: () => {
        if (win) {
          win.webContents.send('open-link-new-tab', params.srcURL);
        }
      }
    });
    template.push({
      label: 'Save Image As...',
      click: () => {
        if (win) {
          win.webContents.downloadURL(params.srcURL);
        }
      }
    });
    template.push({
      label: 'Copy Image URL',
      click: () => {
        clipboard.writeText(params.srcURL);
      }
    });
    template.push({
      label: 'Copy Image',
      click: () => {
        if (win) win.webContents.send('context-menu-action', 'copy-image', params.x, params.y);
      }
    });
  }

  if (params.pageURL) {
    template.push({ type: 'separator' });
    template.push({
      label: 'View Page Source',
      click: () => {
        if (win) win.webContents.send('open-link-new-tab', 'view-source:' + params.pageURL);
      }
    });
  }

  template.push({ type: 'separator' });
  template.push({
    label: 'Inspect Element',
    click: () => {
      if (win) win.webContents.send('context-menu-action', 'inspect', params.x, params.y);
    }
  });

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: win });
});


ipcMain.handle('fetch-pdf', async (event, url) => {
  requireTrustedAppSender(event);
  if (typeof url !== 'string') throw new Error('Invalid PDF URL');
  try {
    return await fetchPdfBytes(url);
  } catch (error) {
    console.error('Error fetching PDF:', error);
    throw error;
  }
});

ipcMain.handle('fetch-suggestions', async (event, query) => {
  requireTrustedAppSender(event);
  if (typeof query !== 'string' || query.length > 200) return [];
  try {
    const response = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`);
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
      return data[1];
    }
    return [];
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return [];
  }
});

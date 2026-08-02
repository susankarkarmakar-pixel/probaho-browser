const { app, BrowserWindow, ipcMain, session, shell, Menu, dialog, clipboard } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const blocklist = require('./blocklist');
const permissionsStore = require('./permissions-store');
const passwordsStore = require('./passwords-store');
const fs = require('fs');

let mainWindow;

function createWindow(isPrivate = false) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
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
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
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
  });
}




app.whenReady().then(() => {
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
  const activeDownloadsMap = new Map();

  ipcMain.on('set-adblocker', (event, enabled) => {
    adBlockerEnabled = enabled;
  });

  ipcMain.on('cancel-download', (event, id) => {
    const item = activeDownloadsMap.get(id);
    if (item) {
      item.cancel();
      activeDownloadsMap.delete(id);
    }
  });

  ipcMain.on('open-private-window', () => {
    createWindow(true);
  });

  ipcMain.handle('load-extension', async (event) => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (!result.canceled) {
      await session.defaultSession.loadExtension(result.filePaths[0]);
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.on('clear-cache', () => {
    session.defaultSession.clearCache().then(() => {
      console.log('Cache cleared');
    });
    session.defaultSession.clearStorageData({ storages: ['cookies', 'cachestorage'] }).then(() => {
      console.log('Storage data cleared (excluding localstorage)');
    });
  });

  ipcMain.handle('get-permissions', () => {
    return permissionsStore.data;
  });

  ipcMain.handle('get-password', (e, origin) => {
    return passwordsStore.getPassword(origin);
  });

  ipcMain.on('save-password', (e, origin, creds) => {
    passwordsStore.setPassword(origin, creds);
  });

  ipcMain.on('delete-permission', (event, origin, permission) => {
    if (permissionsStore.data[origin] && permissionsStore.data[origin][permission] !== undefined) {
      delete permissionsStore.data[origin][permission];
      if (Object.keys(permissionsStore.data[origin]).length === 0) {
        delete permissionsStore.data[origin];
      }
      permissionsStore.saveData();
    }
  });



  // Set a standard Chromium User Agent
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
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
    item.setSavePath(savePath);

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
      if (win && !win.isDestroyed()) {
        win.webContents.send('download-update', {
          id: downloadId,
          fileName: fileName,
          state: state,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          savePath: savePath
        });
      } else {
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send('download-update', {
          id: downloadId,
          fileName: fileName,
          state: state,
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
    if (contents.getType() === 'webview') {
      contents.on('will-navigate', (event, url) => {
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
ipcMain.on('window-minimize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.on('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) {
      win.restore();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});


ipcMain.on('open-file', (event, filePath) => {
  shell.openPath(filePath);
});

ipcMain.on('show-in-folder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.on('show-context-menu', (event, params) => {
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
    template.push({
      label: `Search Google for "${trimmedText}"`,
      click: () => {
        if (win) win.webContents.send('open-link-new-tab', `https://www.google.com/search?q=${encodeURIComponent(params.selectionText)}`);
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
      label: 'Copy Link Address',
      click: () => {
        clipboard.writeText(params.linkURL);
      }
    });
  }

  if (params.hasImageContents && params.srcURL) {
    template.push({ type: 'separator' });
    template.push({
      label: 'Copy Image URL',
      click: () => {
        clipboard.writeText(params.srcURL);
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
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer); // Convert ArrayBuffer to Node.js Buffer for IPC
  } catch (error) {
    console.error('Error fetching PDF:', error);
    throw error;
  }
});

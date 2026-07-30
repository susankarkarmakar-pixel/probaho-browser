const { app, BrowserWindow, ipcMain, session, shell, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const blocklist = require('./blocklist');
const permissionsStore = require('./permissions-store');
const fs = require('fs');

let mainWindow;

function createWindow() {
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
  if (isDev) {
    // We'd normally use the Vite dev server URL here, but let's assume local build for simplicity, or we can use dist.
    // To make it simple for the user's build scripts, we'll always load from dist when packaged.
    // If we're not packaged, we can load from a dev server or dist. The instructions say `npm run build` then `npm run electron`.
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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

  ipcMain.on('set-adblocker', (event, enabled) => {
    adBlockerEnabled = enabled;
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
        if (mainWindow) {
          mainWindow.webContents.send('ad-blocked', details.webContentsId);
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
      if (mainWindow) {
        mainWindow.webContents.send('open-pdf-viewer', url);
      }
      return;
    }

    // Generate a unique ID for the download
    const downloadId = Date.now().toString();
    const fileName = item.getFilename();
    const savePath = path.join(app.getPath('downloads'), fileName);
    item.setSavePath(savePath);

    // Send initial download state
    if (mainWindow) {
      mainWindow.webContents.send('download-update', {
        id: downloadId,
        fileName: fileName,
        state: 'progressing',
        receivedBytes: 0,
        totalBytes: item.getTotalBytes(),
        savePath: savePath
      });
    }

    item.on('updated', (event, state) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-update', {
          id: downloadId,
          fileName: fileName,
          state: state,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          savePath: savePath
        });
      }
    });

    item.once('done', (event, state) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-update', {
          id: downloadId,
          fileName: fileName,
          state: state, // 'completed', 'cancelled', 'interrupted'
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          savePath: savePath
        });
      }
    });
  });




  app.on('web-contents-created', (event, contents) => {
    contents.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    if (contents.getType() === 'webview') {
      contents.on('will-navigate', (event, url) => {
        if (url.toLowerCase().endsWith('.pdf')) {
          event.preventDefault();
          if (mainWindow) {
            mainWindow.webContents.send('open-pdf-viewer', url);
          }
        }
      });
    }
  });

app.on('render-process-gone', (event, webContents, details) => {
  if (mainWindow) {
    mainWindow.webContents.send('tab-crashed', webContents.id, details.reason);
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
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});


ipcMain.on('open-file', (event, filePath) => {
  shell.openPath(filePath);
});

ipcMain.on('show-in-folder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.on('show-context-menu', (event, params) => {
  const template = [
    {
      label: 'Back',
      click: () => { if (mainWindow) mainWindow.webContents.send('context-menu-action', 'back'); }
    },
    {
      label: 'Forward',
      click: () => { if (mainWindow) mainWindow.webContents.send('context-menu-action', 'forward'); }
    },
    {
      label: 'Reload',
      click: () => { if (mainWindow) mainWindow.webContents.send('context-menu-action', 'reload'); }
    },
    { type: 'separator' },
    { role: 'copy' }
  ];

  if (params.linkURL) {
    template.push({ type: 'separator' });
    template.push({
      label: 'Open Link in New Tab',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('open-link-new-tab', params.linkURL);
        }
      }
    });
  }

  template.push({ type: 'separator' });
  template.push({
    label: 'Inspect Element',
    click: () => {
      if (mainWindow) mainWindow.webContents.send('context-menu-action', 'inspect', params.x, params.y);
    }
  });

  const menu = Menu.buildFromTemplate(template);
  menu.popup();
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

const { app, BrowserWindow, ipcMain, session, shell, Menu } = require('electron');
const path = require('path');
const blocklist = require('./blocklist');

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
    if ((input.control || input.meta) && input.key.toLowerCase() === 't') {
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
  });
}




app.whenReady().then(() => {
  createWindow();


  let adBlockerEnabled = true;

  ipcMain.on('set-adblocker', (event, enabled) => {
    adBlockerEnabled = enabled;
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

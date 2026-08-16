with open("app/electron/preload.js", "r") as f:
    content = f.read()

replacement = """  onRestoreTab: (callback) => ipcRenderer.on('shortcut-restore-tab', () => callback()),
  onToggleBookmarksBar: (callback) => ipcRenderer.on('shortcut-toggle-bookmarks-bar', () => callback()),
  onOpenSettings: (callback) => ipcRenderer.on('shortcut-open-settings', () => callback()),
  onViewSource: (callback) => ipcRenderer.on('shortcut-view-source', () => callback()),"""

content = content.replace("""  onRestoreTab: (callback) => ipcRenderer.on('shortcut-restore-tab', () => callback()),""", replacement)

with open("app/electron/preload.js", "w") as f:
    f.write(content)

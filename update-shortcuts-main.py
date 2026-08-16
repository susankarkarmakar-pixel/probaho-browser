with open("app/electron/main.js", "r") as f:
    content = f.read()

replacement = """    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 't') {
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
    }"""

content = content.replace("""    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 't') {
      mainWindow.webContents.send('shortcut-restore-tab');
      event.preventDefault();
    }""", replacement)

with open("app/electron/main.js", "w") as f:
    f.write(content)

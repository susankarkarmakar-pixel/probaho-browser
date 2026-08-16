with open("app/electron/preload.js", "r") as f:
    content = f.read()

replacement = """  showContextMenu: (params) => ipcRenderer.send('show-context-menu', params),"""

# verify it exists
print("Exists:", "showContextMenu" in content)

with open("app/electron/main.js", "r") as f:
    content = f.read()

replacement = """app.whenReady().then(() => {
  session.defaultSession.setWebRTCIPHandlingPolicy('disable-non-proxied-udp');
  createWindow();"""

content = content.replace("""app.whenReady().then(() => {
  createWindow();""", replacement)

with open("app/electron/main.js", "w") as f:
    f.write(content)

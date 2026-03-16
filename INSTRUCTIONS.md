# Probaho Browser - Installation Instructions

**Browser Name**: Probaho  
**Version**: 1.0  
**Built by**: Susankar Karmakar

---

## 📦 What You Have Received

You have received the complete source code for **Probaho Browser**, a modern web browser built with Electron and React. Since executable files cannot be directly shared, you will need to build the browser on your own computer.

---

## 🚀 Quick Start (Easy Method)

### For Windows Users:
1. Install Node.js from https://nodejs.org/ (Download LTS version)
2. Double-click on `build-browser.bat`
3. Wait for the build to complete
4. Find your executable in the `app/release/` folder

### For Mac/Linux Users:
1. Install Node.js from https://nodejs.org/ (Download LTS version)
2. Open terminal in this folder
3. Run: `bash build-browser.sh`
4. Wait for the build to complete
5. Find your executable in the `app/release/` folder

---

## 📋 Manual Build Instructions

If the automatic build scripts don't work, follow these steps:

### Step 1: Install Node.js
- Go to https://nodejs.org/
- Download and install the LTS (Long Term Support) version
- Verify installation by opening terminal/command prompt and typing:
  ```
  node -v
  npm -v
  ```

### Step 2: Navigate to the App Folder
```bash
cd app
```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Build the Browser
```bash
# Build the React app
npm run build

# Build the executable (choose your platform)
npm run dist:win    # For Windows
npm run dist:mac    # For macOS
npm run dist:linux  # For Linux
```

### Step 5: Find Your Executable
After successful build, your executable will be in:
- **Windows**: `app/release/Probaho Browser Setup.exe` (installer) or `app/release/Probaho Browser.exe` (portable)
- **macOS**: `app/release/Probaho Browser.dmg`
- **Linux**: `app/release/Probaho Browser.AppImage`

---

## 🖥️ Running in Development Mode

If you just want to test the browser without building:

```bash
cd app
npm install
npm run electron
```

---

## 📁 Project Structure

```
probaho-browser/
├── app/                    # Main application folder
│   ├── electron/           # Electron main process files
│   │   ├── main.js         # Main Electron process
│   │   └── preload.js      # Preload script
│   ├── src/                # React source code
│   │   ├── App.tsx         # Main browser component
│   │   ├── App.css         # Browser styles
│   │   └── main.tsx        # React entry point
│   ├── public/             # Static assets (icons)
│   ├── dist/               # Built React app (generated)
│   ├── release/            # Packaged executables (generated)
│   ├── package.json        # Project configuration
│   ├── vite.config.ts      # Vite configuration
│   └── README.md           # Detailed documentation
├── build-browser.sh        # Linux/Mac build script
├── build-browser.bat       # Windows build script
└── INSTRUCTIONS.md         # This file
```

---

## ✨ Features

- **Tab Management**: Create multiple tabs, switch between them, close tabs
- **Navigation**: Back, Forward, Reload, Home buttons
- **Smart Address Bar**: Type URLs or search queries
- **Security Indicator**: Shows lock icon for HTTPS sites
- **Custom Window Frame**: Modern frameless design
- **Status Bar**: Shows loading status and browser info
- **Dark Theme**: Easy on the eyes with purple gradient accents

---

## 🛠️ Customization

You can customize the browser by editing:

1. **Change Browser Name**: Edit `app/package.json`
   ```json
   "productName": "Your Browser Name"
   ```

2. **Change Colors**: Edit `app/src/App.css`
   ```css
   --primary-color: #your-color;
   ```

3. **Change Icons**: Replace files in `app/public/` folder

4. **Add Features**: Edit `app/src/App.tsx`

---

## 🐛 Troubleshooting

### "npm is not recognized"
- Node.js is not installed or not in PATH
- Reinstall Node.js from https://nodejs.org/

### "Build failed" or "electron-builder not found"
```bash
cd app
npm install electron-builder --save-dev
npm run dist
```

### "Permission denied" (Linux/Mac)
```bash
chmod +x build-browser.sh
bash build-browser.sh
```

### Webview shows blank page
- Make sure you're connected to the internet
- Try reloading the page
- Check if the website is accessible in other browsers

---

## 📜 License

This project is open source. You are free to:
- Use it for personal or commercial purposes
- Modify and distribute it
- Share it with others

**Credit**: Built by Susankar Karmakar

---

## 🙏 Thank You

Thank you for using Probaho Browser! If you have any questions or need help, feel free to reach out.

**Probaho Browser v1.0**  
**Built with ❤️ by Susankar Karmakar**

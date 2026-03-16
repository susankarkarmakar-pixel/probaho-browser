@echo off
chcp 65001 >nul
cls

echo ==========================================
echo   Probaho Browser Build Script v1.0
echo   Built by Susankar Karmakar
echo ==========================================
echo.

:: Check if Node.js is installed
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo [SUCCESS] Node.js version: 
node -v

:: Navigate to the app directory
cd /d "%~dp0app"

:: Install dependencies
echo [INFO] Installing dependencies...
call npm install

if errorlevel 1 (
    echo [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)
echo [SUCCESS] Dependencies installed successfully!

:: Build React app
echo [INFO] Building React app...
call npm run build

if errorlevel 1 (
    echo [ERROR] Failed to build React app!
    pause
    exit /b 1
)
echo [SUCCESS] React app built successfully!

:: Build for Windows
echo [INFO] Building for Windows...
call npm run dist:win

if errorlevel 1 (
    echo [ERROR] Build failed!
    echo [INFO] Trying alternative build method...
    
    :: Try using npx directly
    call npx electron-builder --win
    
    if errorlevel 1 (
        echo [ERROR] Alternative build also failed!
        echo [INFO] You can try running the browser in development mode:
        echo   cd app && npm run electron
        pause
        exit /b 1
    )
)

echo [SUCCESS] Build completed successfully!
echo.
echo ==========================================
echo   Build Output Location:
echo   %cd%\release\
echo ==========================================
echo.

:: List built files
if exist "release" (
    echo [INFO] Built files:
    dir /b release\
)

echo.
echo [SUCCESS] Probaho Browser has been built successfully!
echo.
echo To install the browser:
echo   - Run release/Probaho Browser Setup.exe for installer
echo   - Or run release/Probaho Browser.exe for portable version
echo.
echo Thank you for using Probaho Browser!
echo Built by Susankar Karmakar
echo.
pause

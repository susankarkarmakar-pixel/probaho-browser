@echo off
setlocal

if "%~1"=="" (
  echo Usage: %~nx0 ^<installer.exe^> ^<checksum-file.txt^>
  echo Example: %~nx0 "Probaho Browser-2.2.0 Setup.exe" "SHA256SUMS-probaho-browser-windows.txt"
  exit /b 64
)

set "SCRIPT_DIR=%~dp0"
set "INSTALLER=%~1"
set "CHECKSUM_FILE=%~2"

if "%~2"=="" (
  echo A published checksum file is required.
  exit /b 64
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%windows-clean-install.ps1" -InstallerPath "%INSTALLER%" -ChecksumFile "%CHECKSUM_FILE%" %~3 %~4 %~5 %~6 %~7 %~8 %~9
exit /b %ERRORLEVEL%

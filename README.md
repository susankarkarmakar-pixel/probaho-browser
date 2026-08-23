# Probaho Browser

Probaho Browser is a lightweight custom web browser project.

## Features
- **Fast & Minimal:** Ultra-premium modern UI with macOS-style window controls and floating tabs.
- **Privacy First:** Built-in Ad and Tracker blocker, plus Private browsing (Incognito) in isolated, separate windows.
- **Advanced Tab Management:** Support for Pinned tabs, tab favicons, and active tab audio indicators with click-to-mute.
- **Reading & Media:** Distraction-free Reader Mode, offline Reading List, and Picture-in-Picture (PiP) video support.
- **Productivity:** Enhanced Download Manager with progress tracking, basic Password Manager & Form Autofill, and Chrome Extension support (Manifest V3).
- **Security Controls:** Dedicated Site Permissions Manager and robust Clear Browsing Data options.
- **Customization:** Custom wallpaper support for the New Tab Page and Dark/Light theme toggles.
- Custom build scripts

## Build Instructions

### Windows
Run:

build-browser.bat

### Linux / Mac

Run:

./build-browser.sh

## Download

Prebuilt versions will be available in the Releases section.

## Author

Susankar Karmakar
Testing GitHub Actions build

## Privacy service configuration

Probaho keeps Safe Browsing credentials out of the renderer and source code. To enable Google Safe Browsing Lookup API reputation checks in a packaged build, provide `GOOGLE_SAFE_BROWSING_API_KEY` through the protected process environment used to launch the application. The browser sends only the destination URL to the main-process provider client, caches short-lived results, and reports `safe`, `unsafe`, `unavailable`, or `error` status to the renderer. If no key is configured, navigation remains available and the Settings page reports that the provider is not configured. Google documents the Lookup API as a non-commercial service; commercial deployments should evaluate Google Web Risk instead.

DNS-over-HTTPS is enabled by default before Electron startup. The Settings page persists the DoH preference and applies a change after the next restart. For a controlled deployment, `PROBAHO_DOH_SERVERS` may contain a comma-separated list of HTTPS resolver endpoints. `PROBAHO_DOH_MODE=off` explicitly disables DoH for a deployment; non-HTTPS resolver endpoints are rejected by the startup policy.

Never commit API keys or resolver credentials to the repository. Use the operating system’s protected environment, CI secret store, or a platform-specific secure deployment mechanism.

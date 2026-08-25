# Probaho Browser

Probaho Browser is a privacy-focused desktop browser built with Electron, React, and TypeScript. It combines a familiar Chrome-style browsing shell with a Windows-inspired interface, private profile isolation, tracker protection, document tools, and user-controlled productivity panels.

> **Release status:** The project is undergoing final release hardening for a stable public release. Always download builds from the official [GitHub Releases](https://github.com/susankarkarmakar-pixel/probaho-browser/releases) page and verify published checksums when they are provided.

## Current capabilities

| Area | Features |
|---|---|
| Browsing | HTTP/HTTPS navigation, URL normalization, search fallback, omnibox suggestions, view-source support, error recovery, and keyboard commands |
| Tabs | Multiple tabs, pinned tabs, tab groups, collapsible groups, vertical tabs, drag-and-drop reorder, split view, lazy loading, and inactive-tab suspension |
| Privacy | Private windows with isolated state, tracker/ad blocking, Safe Browsing integration foundation, DNS-over-HTTPS controls, Do Not Track, and per-site permissions |
| Documents | PDF viewer, highlight/pen/text annotations, undo/redo, color controls, and flattened annotated PDF export |
| Productivity | Bookmarks, bookmark bar, history, reading list, download manager, password manager, reader mode, print, save page, and picture-in-picture support |
| Extensions | Constrained Chrome-style Manifest V3 extension management with explicit permissions and enable/disable controls |
| Interface | Windows-style titlebar, visible window controls, Mica-inspired surfaces, light/dark themes, auto-hidden utility rail, and accessible menus |
| Import | First-run import of HTTP(S) bookmarks from Chromium/Edge/Firefox HTML exports and supported JSON profiles |

## Privacy and safety boundaries

Probaho keeps private-window state separate from normal browsing data. Passwords are stored through the encrypted main-process password store and are **not automatically imported** from browser export files. The browser-data importer accepts only safe HTTP(S) bookmark entries and skips malformed or unsupported schemes.

Certificate errors are never bypassed silently. When a website presents an unverifiable certificate, Probaho shows the URL and certificate details and requires an explicit user decision. Choosing **Proceed anyway** should be limited to sites the user controls or independently trusts.

Safe Browsing credentials, when configured, remain in the main process. The renderer receives status information rather than provider credentials. DNS-over-HTTPS is enabled by default in the normal startup path and can be configured through the protected deployment environment; see the application Settings page and deployment documentation for operational details.

## Supported platforms

The release configuration targets Windows x64 installer and portable builds, macOS DMG builds for Apple Silicon and Intel x64 on **macOS 13 Ventura or newer**, and Linux x64 AppImage, Debian package, and tarball builds. The application is built on Electron 44 with a current Chromium runtime.

Unsigned local builds may produce operating-system trust warnings. Stable public distribution requires signed Windows and macOS artifacts, notarization where applicable, published checksums, and platform acceptance testing.

## Installation

Stable installers will be published on the [GitHub Releases](https://github.com/susankarkarmakar-pixel/probaho-browser/releases) page. Do not run an installer obtained from an untrusted mirror.

For local development, install Node.js 20 or later, then run:

```bash
cd app
npm ci
npm run build
npm run electron
```

## Building release artifacts

The project includes platform-specific Electron Builder targets:

```bash
cd app
npm run dist:win
npm run dist:mac
npm run dist:linux
```

The CI workflow builds and tests on GitHub Actions. A version tag such as `v2.2.0` triggers the release workflow after smoke tests, end-to-end tests, and platform packaging jobs complete successfully.

## Quality checks

Run the local validation commands before submitting a change:

```bash
cd app
npm run test:unit
npm run build
for file in electron/*.js; do node --check "$file"; done
xvfb-run --auto-servernum --server-args='-screen 0 1440x900x24' npx playwright test
npm audit --omit=dev --audit-level=high
```

The repository contains unit, Electron Playwright, navigation-policy, privacy, extension, and tracker-protection coverage. The main renderer bundle may emit a non-blocking Vite chunk-size advisory because the PDF worker and document tooling are substantial; this is tracked separately as a performance optimization.

## Configuration

Safe Browsing and DNS-over-HTTPS deployment settings must be supplied through protected environment variables. Never commit API keys, resolver credentials, password exports, or private browser profiles to the repository.

For security reports, consult [SECURITY.md](SECURITY.md). For release history, see [CHANGELOG.md](CHANGELOG.md).

## License

Probaho Browser is distributed under the [MIT License](LICENSE).

## Project

Source repository: [susankarkarmakar-pixel/probaho-browser](https://github.com/susankarkarmakar-pixel/probaho-browser)

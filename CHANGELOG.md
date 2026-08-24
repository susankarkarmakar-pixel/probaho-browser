# Changelog

All notable changes to Probaho Browser are documented here.

## [2.2.0] - Release hardening in progress

### Added

- Chrome-style omnibox URL classification, search fallback, local bookmark/history suggestions, keyboard selection, and unsafe-scheme feedback.
- Chrome-style Extensions manager with constrained Manifest V3 support, explicit permissions, enable/disable controls, and toolbar access.
- Windows-style titlebar with visible minimize, maximize/restore, and red close controls.
- Windows-inspired Mica surfaces with light/dark theme support and safe opaque fallbacks.
- Edge-inspired tab groups, collapsible groups, vertical tabs, group assignment, and group-state persistence.
- PDF and web-document annotation tools including highlight, pen, text notes, color selection, undo/redo, and clear.
- Flattened annotated PDF export that creates a new PDF copy while preserving the original document.
- First-run browser-data import for Chromium, Edge, and Firefox bookmark HTML exports and supported JSON profiles.
- Auto-hidden right utility rail with hover/focus reveal and optional pinning.
- Explicit certificate-error warning flow with certificate details, Go back, and Proceed anyway actions.
- Expanded Electron Playwright and unit-test coverage for URL handling, extensions, themes, tab groups, vertical tabs, annotations, import, and utility-rail behavior.

### Security and privacy

- Preserved renderer isolation, sandboxing, restricted preload APIs, navigation allowlists, private profile isolation, encrypted password storage, tracker protection, Safe Browsing foundation, DNS-over-HTTPS controls, and per-site permissions.
- Browser-data imports accept only safe HTTP(S) entries and do not automatically copy saved passwords.
- Certificate continuation is explicit, request-scoped, and denied by timeout when unresolved.

### Release notes

The 2.2.0 line is being prepared for stable public distribution. Signed Windows and macOS artifacts, notarization where applicable, published checksums, privacy and security documentation, and real platform acceptance testing are required before the stable release is announced.

[Unreleased]: https://github.com/susankarkarmakar-pixel/probaho-browser/compare/v2.1.0...HEAD

# Probaho Browser Privacy Notice

_Last updated: 2026-08-24_

Probaho Browser is designed to keep ordinary browsing preferences and most browser data on the user’s device. This notice describes the current desktop application behavior for the 2.2.0 release line. It is a technical product notice and should be reviewed alongside the laws and policies applicable to the distributor’s deployment.

## Data kept on the device

Normal-profile bookmarks, history, reading-list entries, tab state, workspaces, tab groups, collapsed-group preferences, theme preferences, utility-rail preferences, extension metadata, permissions, annotations, and other settings are stored locally in the application profile. Private windows use isolated state and do not write normal-profile browsing history, bookmarks, or settings through the normal renderer persistence paths.

Saved passwords are handled by the Electron main process and stored using the operating system-backed encryption facility when it is available. Password exports are not created by the first-run browser-data importer, and passwords from another browser are not automatically copied. If OS-backed encryption is unavailable, Probaho refuses to initialize the password store rather than silently writing plaintext credentials.

## Data sent to websites and services

When a user visits a website, the destination and request data are sent to that website in the same fundamental way as in other desktop browsers. Search queries are sent to the search engine selected by the user. Remote omnibox suggestions, when enabled by the current build, send the typed query to the configured suggestion provider.

If Safe Browsing reputation checks are configured, Probaho sends the destination URL to the provider from the main process and returns a status to the renderer. Provider credentials are not exposed to the renderer. If no provider key is configured, reputation checks remain unavailable and navigation is not silently blocked for that reason.

DNS-over-HTTPS may send DNS queries to the configured secure resolver. The resolver endpoint is controlled by deployment configuration and the user’s settings. Do Not Track and tracker blocking controls may change the requests made to websites, but they cannot guarantee that a website will honor a preference.

## Extensions and plugins

Extensions and plugins can process website content according to their declared permissions and the implementation permitted by Probaho. Users should install only extensions they trust. Probaho validates extension metadata and restricts supported permissions and host schemes, but an allowed extension can still access the data its permissions provide.

## Imports and exports

The first-run importer accepts Chromium, Edge, or Firefox bookmark HTML exports and supported JSON profiles. It keeps only valid HTTP(S) entries and ignores malformed or unsupported schemes. Imported bookmarks and history are merged with existing local data and duplicate URLs are skipped. Users should treat exported browser files as sensitive and delete them securely after use.

PDF annotations are stored separately from the original document and can be exported as a new flattened PDF. The original PDF is not overwritten by the export flow. Web-document annotations are browser-owned overlays and do not modify the source webpage.

## Certificate warnings

When a website presents a certificate that Probaho cannot verify, the browser displays the destination and available certificate details. The browser does not continue automatically. A user must choose whether to go back or proceed for that pending navigation. Proceeding through a certificate warning can expose the user to interception or impersonation and should be reserved for destinations independently controlled or trusted by the user.

## Diagnostics and telemetry

The current application does not include a product analytics or advertising telemetry service. Build and test tooling may contact package registries, GitHub Actions, update providers, search engines, Safe Browsing providers, DNS-over-HTTPS resolvers, and websites when those features are used or configured.

## Contact and changes

Security issues should be reported according to [SECURITY.md](SECURITY.md). This notice may be updated when data flows, providers, or release features change; the revision date above identifies the version reviewed for the release line.

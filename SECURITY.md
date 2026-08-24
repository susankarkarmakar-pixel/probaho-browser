# Security Policy

## Supported release line

Security fixes are developed against the latest release on the `main` branch. Users should use the latest signed stable release once it is published and should not rely on obsolete unsigned development builds for sensitive browsing.

## Reporting a vulnerability

Please do not publish exploit details in a public issue. Use a [private GitHub Security Advisory](https://github.com/susankarkarmakar-pixel/probaho-browser/security/advisories/new) when possible. Include the affected version, operating system, reproduction steps, impact, and any proof-of-concept that can be shared safely.

If a private advisory cannot be created, open a minimal public issue containing only the words “security report requested” and do not include exploit details or sensitive data. A maintainer will provide a private follow-up path.

## Scope

Reports involving Electron process isolation, preload exposure, navigation policy, unsafe protocol handling, certificate-warning bypasses, extension permissions, private-window data leakage, encrypted password storage, download handling, updater integrity, and release artifacts are in scope.

## Security boundaries

Probaho uses a sandboxed renderer, context isolation, a restricted preload bridge, an explicit navigation allowlist, private-window profile separation, OS-backed password encryption where available, and user-confirmed certificate continuation. These controls reduce risk but do not make arbitrary websites, extensions, downloads, or certificate overrides safe by themselves.

Users should keep the operating system updated, install builds only from the official Releases page, verify checksums when published, use only extensions they trust, and avoid proceeding through certificate warnings unless they independently control or trust the destination.

## Disclosure process

Security reports will be triaged privately. A fix, mitigation, or release note will be prepared before public disclosure when the impact warrants coordinated disclosure. Please avoid including personal information, passwords, private profiles, API keys, or unreleased exploit material in reports.

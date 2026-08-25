# Stable Release Runbook

This runbook describes how to publish a signed Probaho Browser release. A release should be published only after the smoke tests, Electron end-to-end tests, packaging jobs, checksum verification, and platform acceptance checks complete successfully.

## Versioning

Update the version in `app/package.json` and `app/package-lock.json`, update `CHANGELOG.md`, run the complete local validation suite, and commit the changes. The current release line is `2.2.0`.

Create an annotated version tag only after the release commit is present on `main`:

```bash
git fetch origin --prune
git checkout main
git pull --ff-only origin main
git tag -a v2.2.0 -m "Probaho Browser 2.2.0"
git push origin v2.2.0
```

The tag starts the GitHub Actions release workflow. A manual workflow run is suitable for unsigned packaging checks, but it must not be treated as a stable public release.

## Required GitHub secrets

Tagged Windows builds require `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`. `WIN_CSC_LINK` should contain the protected signing certificate value accepted by Electron Builder, normally a base64-encoded PFX/P12 secret.

Tagged macOS builds require `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`. The Apple account must have permission to sign and notarize the application, and the app’s bundle identifier must be registered appropriately.

Secrets must be added through the repository’s protected GitHub Actions secrets interface. Do not commit certificates, passwords, provisioning files, API keys, or notarization credentials. The workflow intentionally fails tagged Windows and macOS packaging when the required signing values are missing.

## Artifact verification

Each platform packaging job creates an artifact-specific `SHA256SUMS-*.txt` file. The release job verifies every checksum before publishing the files to the GitHub Release. After downloading a release, verify the checksums from a trusted shell before installing.

On Linux:

```bash
sha256sum -c SHA256SUMS-probaho-browser-linux.txt
```

On macOS:

```bash
shasum -a 256 -c SHA256SUMS-probaho-browser-macos.txt
```

On Windows PowerShell, calculate a file hash with `Get-FileHash` and compare it with the published SHA-256 value.

## Platform acceptance

Before announcing the release, install the signed Windows installer and portable build on a clean Windows x64 profile, open and close the application, verify update behavior, test certificate warnings, import bookmarks, open a PDF, export an annotated PDF, load a permitted extension, and confirm private-window isolation.

The repeatable Windows installer portion can be run with the repository helper:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\\scripts\\qa\\windows-clean-install.ps1 `
  -InstallerPath '.\\Probaho Browser-2.2.0 Setup.exe' `
  -ChecksumFile '.\\SHA256SUMS-probaho-browser-windows.txt' `
  -ReportPath '.\\qa-results\\windows-clean-install.json'
```

The helper verifies the checksum and Authenticode publisher, performs an isolated silent install, launches and closes the installed browser, confirms profile initialization, and uninstalls it. It does not replace manual UI, privacy, certificate-warning, updater, PDF, extension, or accessibility acceptance. See [`scripts/qa/README.md`](scripts/qa/README.md) for flags and limitations.

On macOS, test both Apple Silicon and Intel artifacts, verify Gatekeeper acceptance, first launch, window controls, private windows, PDF export, updater behavior, and notarization status. On Linux, test the AppImage and Debian package on a clean supported distribution, verify desktop integration, sandbox behavior, downloads, and profile migration.

Record the operating-system version, artifact filename, checksum, installation result, and any known issue in the release checklist before publishing.

## Rollback

If a published artifact is defective, mark the GitHub Release as a pre-release or remove the affected artifact, stop announcing the version, and publish a corrected patch version. Do not rewrite an already-published tag or force-push `main`. Investigate updater behavior before promoting a corrected build.

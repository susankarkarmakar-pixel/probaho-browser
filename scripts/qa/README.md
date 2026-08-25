# Windows clean-install QA harness

`windows-clean-install.ps1` automates the repeatable parts of the v2.2.0 Windows acceptance test. It verifies a published installer checksum, verifies the Authenticode signature and publisher, performs a silent per-user NSIS installation into an isolated temporary directory, launches the installed browser, confirms the profile is initialized, and silently uninstalls the application.

The harness does not replace manual product acceptance. A tester must still verify the visible UI, navigation, certificate warning interaction, private-window isolation, bookmark import, PDF annotations/export, extensions, downloads, updater behavior, and any Windows-specific rendering issues.

## Recommended stable-release usage

Run PowerShell from a clean Windows 10/11 x64 VM or a fresh Windows test account. Download the installer and the matching `SHA256SUMS-probaho-browser-windows.txt` file only from the official GitHub Release. Keep the checksum file in the same trusted working directory.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\windows-clean-install.ps1 `
  -InstallerPath '.\Probaho Browser-2.2.0 Setup.exe' `
  -ChecksumFile '.\SHA256SUMS-probaho-browser-windows.txt' `
  -ReportPath '.\qa-results\windows-clean-install.json'
```

The batch wrapper supports the same primary flow:

```bat
run-windows-clean-install.cmd "Probaho Browser-2.2.0 Setup.exe" "SHA256SUMS-probaho-browser-windows.txt"
```

The script fails if a Probaho profile already exists. This prevents an upgrade profile from being mistaken for a clean-install result. On a disposable test VM, an explicit reset is available:

```powershell
.\windows-clean-install.ps1 `
  -InstallerPath '.\Probaho Browser-2.2.0 Setup.exe' `
  -ChecksumFile '.\SHA256SUMS-probaho-browser-windows.txt' `
  -ResetUserData -Force
```

`-SkipSignature`, `-SkipChecksum`, and `-SkipUninstall` are intended only for exploratory testing. They produce warnings in the JSON report and must not be used as the stable signed-release acceptance result. The generated report includes the OS version, architecture, installer hash, install directory, each check result, and the final pass/fail state. The report should be attached to the release QA record and must not contain credentials or browser profile data.

## GitHub Actions workflow

The repository workflow at `.github/workflows/windows-clean-install.yml` runs on `windows-latest` after a successful tagged `Build and Release` run. It downloads the `probaho-browser-windows` artifact from that exact run, verifies the signed installer and checksum, executes the harness, and uploads the JSON report as a retained workflow artifact and job summary. It does not use signing secrets and does not publish a release.

For an existing successful build run, use **Actions → Windows Clean-Install QA → Run workflow** and provide that run’s numeric ID as `artifact_run_id`. The optional `skip_signature` input is only for unsigned exploratory artifacts; it must remain disabled for stable-release acceptance.

## What the script cannot verify

The harness cannot determine whether the browser’s rendered UI is visually correct or whether a remote website’s certificate is invalid. It also cannot prove updater behavior, private browsing isolation, PDF export correctness, extension permission boundaries, or user-facing accessibility. Those checks remain manual steps in the v2.2.0 release checklist.

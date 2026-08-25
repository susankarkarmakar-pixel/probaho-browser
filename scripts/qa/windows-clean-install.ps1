[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$InstallerPath,

  [string]$ExpectedSha256,
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$ChecksumFile,
  [string]$ExpectedPublisher = 'Susankar Karmakar',
  [string]$ReportPath,
  [switch]$SkipChecksum,
  [int]$LaunchTimeoutSeconds = 30,
  [switch]$SkipSignature,
  [switch]$SkipUninstall,
  [switch]$ResetUserData,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Checks = New-Object 'System.Collections.Generic.List[object]'
$script:InstallDirectory = $null
$script:LaunchProcess = $null
$script:InstallerExitCode = $null
$startedAt = Get-Date

function Add-Check {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][ValidateSet('PASS', 'FAIL', 'WARN')][string]$Status,
    [Parameter(Mandatory = $true)][string]$Details
  )
  $script:Checks.Add([pscustomobject]@{
      name = $Name
      status = $Status
      details = $Details
    })
}

function Require-Check {
  param(
    [Parameter(Mandatory = $true)][bool]$Condition,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Details
  )
  if (-not $Condition) {
    Add-Check -Name $Name -Status 'FAIL' -Details $Details
    throw "$Name failed: $Details"
  }
  Add-Check -Name $Name -Status 'PASS' -Details $Details
}

function Get-ProfilePaths {
  @(
    $(if ($env:APPDATA) { Join-Path $env:APPDATA 'Probaho Browser' }),
    $(if ($env:APPDATA) { Join-Path $env:APPDATA 'probaho-browser' }),
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'Probaho Browser' }),
    $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'probaho-browser' })
  ) | Where-Object { $_ -and $_.Trim() } | Select-Object -Unique
}

function Remove-ProfilePaths {
  foreach ($profilePath in Get-ProfilePaths) {
    if (Test-Path -LiteralPath $profilePath) {
      Remove-Item -LiteralPath $profilePath -Recurse -Force
    }
  }
}

function Get-ChecksumFromFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  $fileName = [IO.Path]::GetFileName((Resolve-Path -LiteralPath $InstallerPath).Path)
  $pattern = '(?im)^\s*([0-9a-f]{64})\s+\*?' + [regex]::Escape($fileName) + '\s*$'
  $match = [regex]::Match((Get-Content -LiteralPath $Path -Raw), $pattern)
  if (-not $match.Success) {
    throw "No SHA-256 entry for $fileName was found in $Path"
  }
  return $match.Groups[1].Value.ToUpperInvariant()
}

function Stop-LaunchedBrowser {
  if ($null -eq $script:LaunchProcess) { return }
  try {
    $process = Get-Process -Id $script:LaunchProcess.Id -ErrorAction SilentlyContinue
    if ($process) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
  } catch {
    # Cleanup must not replace the original test result.
  }
}

function Write-Report {
  param([bool]$Passed, [string]$Failure = '')

  $report = [ordered]@{
    test = 'windows-clean-install'
    startedAt = $startedAt.ToUniversalTime().ToString('o')
    completedAt = (Get-Date).ToUniversalTime().ToString('o')
    passed = $Passed
    failure = $Failure
    installer = (Resolve-Path -LiteralPath $InstallerPath).Path
    installerSha256 = (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA256).Hash
    installDirectory = $script:InstallDirectory
    windowsVersion = [Environment]::OSVersion.Version.ToString()
    architecture = $env:PROCESSOR_ARCHITECTURE
    checks = @($script:Checks.ToArray())
  }

  $resolvedReport = if ($ReportPath) { $ReportPath } else {
    Join-Path (Get-Location) ("windows-clean-install-report-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
  }
  $reportParent = Split-Path -Parent $resolvedReport
  if ($reportParent -and -not (Test-Path -LiteralPath $reportParent)) {
    New-Item -ItemType Directory -Path $reportParent -Force | Out-Null
  }
  $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resolvedReport -Encoding UTF8
  Write-Host "QA report: $resolvedReport"
  return $report
}

try {
  if ($LaunchTimeoutSeconds -lt 5) {
    throw 'LaunchTimeoutSeconds must be at least 5 seconds.'
  }
  if ($ResetUserData -and -not $Force) {
    throw 'ResetUserData is destructive. Re-run with both -ResetUserData and -Force, or use a clean Windows profile.'
  }

  $InstallerPath = (Resolve-Path -LiteralPath $InstallerPath).Path
  $installerName = [IO.Path]::GetFileName($InstallerPath)
  Require-Check -Condition ($installerName -match '\.exe$') -Name 'Installer file type' -Details "$installerName is a Windows executable."

  $actualHash = (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($ExpectedSha256) {
    $normalizedExpected = ($ExpectedSha256 -replace '\s', '').ToUpperInvariant()
    Require-Check -Condition ($normalizedExpected -match '^[0-9A-F]{64}$') -Name 'Expected SHA-256 format' -Details 'The expected checksum is a 64-character hexadecimal SHA-256 value.'
    Require-Check -Condition ($actualHash -eq $normalizedExpected) -Name 'Installer SHA-256' -Details "Expected $normalizedExpected; actual $actualHash."
  } elseif ($ChecksumFile) {
    $checksumFromFile = Get-ChecksumFromFile -Path $ChecksumFile
    Require-Check -Condition ($actualHash -eq $checksumFromFile) -Name 'Published SHA-256' -Details "Checksum file entry matches $installerName."
  } elseif ($SkipChecksum) {
    Add-Check -Name 'Installer SHA-256' -Status 'WARN' -Details "Calculated $actualHash; checksum verification was skipped explicitly."
  } else {
    throw 'Provide -ExpectedSha256 or -ChecksumFile for release QA, or explicitly pass -SkipChecksum for exploratory local testing.'
  }

  if ($SkipSignature) {
    Add-Check -Name 'Authenticode signature' -Status 'WARN' -Details 'Skipped explicitly with -SkipSignature; do not use this mode for stable signed-release acceptance.'
  } else {
    $signature = Get-AuthenticodeSignature -FilePath $InstallerPath
    Require-Check -Condition ($signature.Status -eq 'Valid') -Name 'Authenticode signature' -Details "Signature status: $($signature.Status)."
    $subject = [string]$signature.SignerCertificate.Subject
    Require-Check -Condition ($subject -match [regex]::Escape($ExpectedPublisher)) -Name 'Publisher identity' -Details "Signer subject: $subject"
  }

  $profilePaths = @(Get-ProfilePaths)
  $existingProfiles = @($profilePaths | Where-Object { Test-Path -LiteralPath $_ })
  if ($existingProfiles.Count -gt 0) {
    if ($ResetUserData) {
      Remove-ProfilePaths
      Add-Check -Name 'Clean profile preparation' -Status 'PASS' -Details 'Existing Probaho profile directories were removed with explicit -ResetUserData -Force.'
    } else {
      throw "Probaho profile data already exists: $($existingProfiles -join ', '). Use a clean Windows user/VM or explicitly pass -ResetUserData -Force."
    }
  } else {
    Add-Check -Name 'Clean profile preparation' -Status 'PASS' -Details 'No existing Probaho profile directories were found.'
  }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $script:InstallDirectory = Join-Path $env:TEMP "ProbahoBrowser-QA-$stamp"
  if (Test-Path -LiteralPath $script:InstallDirectory) {
    Remove-Item -LiteralPath $script:InstallDirectory -Recurse -Force
  }

  $installDirectoryArgument = "/D=`"$script:InstallDirectory`""
  $installResult = Start-Process -FilePath $InstallerPath -ArgumentList @('/S', $installDirectoryArgument) -Wait -PassThru
  $script:InstallerExitCode = $installResult.ExitCode
  Require-Check -Condition ($installResult.ExitCode -eq 0) -Name 'Silent installation' -Details "Installer exit code: $($installResult.ExitCode)."

  Require-Check -Condition (Test-Path -LiteralPath $script:InstallDirectory -PathType Container) -Name 'Install directory' -Details $script:InstallDirectory
  $installedExe = Get-ChildItem -LiteralPath $script:InstallDirectory -Filter '*.exe' -File | Where-Object { $_.Name -notmatch 'uninstall' } | Select-Object -First 1
  Require-Check -Condition ($null -ne $installedExe) -Name 'Installed browser executable' -Details 'A non-uninstaller executable was found in the installation directory.'
  Add-Check -Name 'Installed executable path' -Status 'PASS' -Details $installedExe.FullName

  $script:LaunchProcess = Start-Process -FilePath $installedExe.FullName -PassThru
  $deadline = (Get-Date).AddSeconds($LaunchTimeoutSeconds)
  while (-not $script:LaunchProcess.HasExited -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
  }
  Require-Check -Condition (-not $script:LaunchProcess.HasExited) -Name 'Application launch' -Details "The browser remained running for the $LaunchTimeoutSeconds-second smoke-test window."
  Add-Check -Name 'Application close' -Status 'PASS' -Details 'The browser process was stopped by the QA harness after the launch smoke test.'
  Stop-LaunchedBrowser
  $script:LaunchProcess = $null
  Start-Sleep -Seconds 2

  $createdProfiles = @($profilePaths | Where-Object { Test-Path -LiteralPath $_ })
  Require-Check -Condition ($createdProfiles.Count -gt 0) -Name 'Profile initialization' -Details "Profile directory created: $($createdProfiles -join ', ')"

  if ($SkipUninstall) {
    Add-Check -Name 'Silent uninstall' -Status 'WARN' -Details 'Skipped explicitly with -SkipUninstall.'
  } else {
    $uninstaller = Get-ChildItem -LiteralPath $script:InstallDirectory -Filter '*.exe' -File | Where-Object { $_.Name -match 'uninstall' } | Select-Object -First 1
    Require-Check -Condition ($null -ne $uninstaller) -Name 'Uninstaller discovery' -Details 'The NSIS uninstaller was found.'
    $uninstallResult = Start-Process -FilePath $uninstaller.FullName -ArgumentList @('/S') -Wait -PassThru
    Require-Check -Condition ($uninstallResult.ExitCode -eq 0) -Name 'Silent uninstall' -Details "Uninstaller exit code: $($uninstallResult.ExitCode)."
    Start-Sleep -Seconds 2
    Require-Check -Condition (-not (Test-Path -LiteralPath $script:InstallDirectory)) -Name 'Install cleanup' -Details 'The installation directory was removed after uninstall.'
  }

  $report = Write-Report -Passed $true
  Write-Host 'Windows clean-install QA: PASS' -ForegroundColor Green
  exit 0
} catch {
  Stop-LaunchedBrowser
  $failure = $_.Exception.Message
  Add-Check -Name 'Test execution' -Status 'FAIL' -Details $failure
  try { Write-Report -Passed $false -Failure $failure | Out-Null } catch { Write-Warning "Unable to write QA report: $($_.Exception.Message)" }
  Write-Error "Windows clean-install QA: FAIL - $failure"
  exit 1
} finally {
  Stop-LaunchedBrowser
}

#!/usr/bin/env bash
set -Eeuo pipefail

DEB_PATH=''
APPIMAGE_PATH=''
CHECKSUM_PATH=''
REPORT_PATH=''
NO_SANDBOX=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deb) DEB_PATH="$2"; shift 2 ;;
    --appimage) APPIMAGE_PATH="$2"; shift 2 ;;
    --checksum) CHECKSUM_PATH="$2"; shift 2 ;;
    --report) REPORT_PATH="$2"; shift 2 ;;
    --no-sandbox) NO_SANDBOX=true; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 64 ;;
  esac
done

: "${DEB_PATH:?--deb is required}"
: "${APPIMAGE_PATH:?--appimage is required}"
: "${CHECKSUM_PATH:?--checksum is required}"
: "${REPORT_PATH:?--report is required}"

mkdir -p "$(dirname "$REPORT_PATH")"
WORK_DIR="$(mktemp -d)"
LOG_PATH="${REPORT_PATH}.log"
INSTALLED_BINARY=''
APPIMAGE_PID=''
PACKAGE_INSTALLED=false
QA_FAILURE_DETAILS=''

cleanup() {
  if [[ -n "$APPIMAGE_PID" ]] && kill -0 "$APPIMAGE_PID" 2>/dev/null; then
    kill "$APPIMAGE_PID" 2>/dev/null || true
    wait "$APPIMAGE_PID" 2>/dev/null || true
  fi
  if [[ -n "$INSTALLED_BINARY" ]]; then
    pkill -TERM -f "$INSTALLED_BINARY" 2>/dev/null || true
  fi
  if [[ "$PACKAGE_INSTALLED" == true ]]; then
    sudo apt-get remove -y probaho-browser >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK_DIR"
}

on_error() {
  QA_FAILURE_DETAILS="Command failed at line $1: $2"
}

finish() {
  local exit_code=$?
  if [[ "$exit_code" -ne 0 ]]; then
    write_report 'FAIL' "${QA_FAILURE_DETAILS:-The Linux clean-install QA command failed.}" || true
  fi
  cleanup
  exit "$exit_code"
}
trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR
trap finish EXIT

write_report() {
  local result="$1"
  local details="$2"
  cat > "$REPORT_PATH" <<EOF
# Linux clean-install QA

- **Result:** $result
- **Distribution:** $(. /etc/os-release && printf '%s %s' "$NAME" "$VERSION_ID")
- **Architecture:** $(uname -m)
- **Debian artifact:** $(basename "$DEB_PATH")
- **AppImage artifact:** $(basename "$APPIMAGE_PATH")
- **Details:** $details
- **CI launch mode:** $(if [[ "$NO_SANDBOX" == true ]]; then echo 'no-sandbox (headless-runner compatibility)'; else echo 'normal Electron sandbox'; fi)

## Checks

| Check | Status |
|---|---|
| Published SHA-256 | $CHECKSUM_STATUS |
| Debian package metadata | $DEB_STATUS |
| Debian install and launch | $DEB_LAUNCH_STATUS |
| AppImage launch | $APPIMAGE_STATUS |
| **Debian uninstall** | $UNINSTALL_STATUS |
EOF
  if [[ -f "$LOG_PATH" ]]; then
    {
      echo
      echo '## Launch log tail'
      echo
      echo '```text'
      tail -40 "$LOG_PATH"
      echo '```'
    } >> "$REPORT_PATH"
  fi
}

CHECKSUM_STATUS='FAIL'
DEB_STATUS='FAIL'
DEB_LAUNCH_STATUS='FAIL'
APPIMAGE_STATUS='FAIL'
UNINSTALL_STATUS='FAIL'

CHECKSUM_DIR="$(dirname "$CHECKSUM_PATH")"
(cd "$CHECKSUM_DIR" && sha256sum -c "$(basename "$CHECKSUM_PATH")")
CHECKSUM_STATUS='PASS'

dpkg-deb --info "$DEB_PATH" >/dev/null
DEB_STATUS='PASS'

sudo apt-get install -y "$DEB_PATH" >/dev/null
PACKAGE_INSTALLED=true
INSTALLED_BINARY="$(command -v probaho-browser || true)"
[[ -n "$INSTALLED_BINARY" && -x "$INSTALLED_BINARY" ]]

launch_args=(--disable-gpu)
if [[ "$NO_SANDBOX" == true ]]; then
  launch_args+=(--no-sandbox)
fi

set +e
 timeout --foreground 12s xvfb-run --auto-servernum --server-args='-screen 0 1440x900x24' "$INSTALLED_BINARY" "${launch_args[@]}" >"$LOG_PATH" 2>&1
 deb_exit=$?
set -e
if [[ "$deb_exit" -eq 124 ]]; then
  DEB_LAUNCH_STATUS='PASS'
else
  write_report 'FAIL' "The installed Debian application exited before the 12-second smoke-test timeout (exit code $deb_exit)."
  exit 1
fi

chmod +x "$APPIMAGE_PATH"
set +e
 appimage_args=(--appimage-extract-and-run --disable-gpu)
 if [[ "$NO_SANDBOX" == true ]]; then
   appimage_args+=(--no-sandbox)
 fi
 timeout --foreground 12s xvfb-run --auto-servernum --server-args='-screen 0 1440x900x24' "$APPIMAGE_PATH" "${appimage_args[@]}" >>"$LOG_PATH" 2>&1
 appimage_exit=$?
set -e
if [[ "$appimage_exit" -eq 124 ]]; then
  APPIMAGE_STATUS='PASS'
else
  write_report 'FAIL' "The AppImage exited before the 12-second smoke-test timeout (exit code $appimage_exit)."
  exit 1
fi

sudo apt-get remove -y probaho-browser >/dev/null
PACKAGE_INSTALLED=false
if ! command -v probaho-browser >/dev/null 2>&1; then
  UNINSTALL_STATUS='PASS'
else
  write_report 'FAIL' 'The Debian package command remained available after uninstall.'
  exit 1
fi

write_report 'PASS' 'Checksum, Debian installation, launch, AppImage launch, and Debian uninstall completed.'

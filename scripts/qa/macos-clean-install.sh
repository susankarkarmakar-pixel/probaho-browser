#!/usr/bin/env bash
set -Eeuo pipefail

DMG_PATH=''
CHECKSUM_PATH=''
REPORT_PATH=''
EXPECTED_ARCH=''
SKIP_SIGNATURE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dmg) DMG_PATH="$2"; shift 2 ;;
    --checksum) CHECKSUM_PATH="$2"; shift 2 ;;
    --report) REPORT_PATH="$2"; shift 2 ;;
    --architecture) EXPECTED_ARCH="$2"; shift 2 ;;
    --skip-signature) SKIP_SIGNATURE=true; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 64 ;;
  esac
done

: "${DMG_PATH:?--dmg is required}"
: "${CHECKSUM_PATH:?--checksum is required}"
: "${REPORT_PATH:?--report is required}"
: "${EXPECTED_ARCH:?--architecture is required}"

mkdir -p "$(dirname "$REPORT_PATH")"
WORK_DIR="$(mktemp -d)"
MOUNT_DIR="$WORK_DIR/mount"
APP_DEST="$WORK_DIR/Probaho Browser.app"
mkdir -p "$MOUNT_DIR"
APP_PID=''

CHECKSUM_STATUS='FAIL'
ARCH_STATUS='FAIL'
SIGNATURE_STATUS='FAIL'
GATEKEEPER_STATUS='FAIL'
LAUNCH_STATUS='FAIL'
CLEANUP_STATUS='FAIL'
QA_FAILURE_DETAILS=''

write_report() {
  local result="$1"
  local details="$2"
  cat > "$REPORT_PATH" <<EOF
# macOS clean-install QA

- **Result:** $result
- **macOS:** $(sw_vers -productVersion)
- **Architecture:** $(uname -m)
- **Expected artifact architecture:** $EXPECTED_ARCH
- **DMG artifact:** $(basename "$DMG_PATH")
- **Details:** $details

## Checks

| Check | Status |
|---|---|
| Published SHA-256 | $CHECKSUM_STATUS |
| Application architecture | $ARCH_STATUS |
| Code signature | $SIGNATURE_STATUS |
| Gatekeeper assessment | $GATEKEEPER_STATUS |
| First-launch smoke test | $LAUNCH_STATUS |
| DMG/app cleanup | $CLEANUP_STATUS |
EOF
}

cleanup() {
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  if mount | grep -Fq "$MOUNT_DIR"; then
    hdiutil detach "$MOUNT_DIR" -force >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK_DIR"
}

on_error() {
  QA_FAILURE_DETAILS="Command failed at line $1: $2"
}

finish() {
  local exit_code=$?
  if [[ "$exit_code" -ne 0 ]]; then
    write_report 'FAIL' "${QA_FAILURE_DETAILS:-The macOS clean-install QA command failed.}" || true
  fi
  cleanup
  exit "$exit_code"
}
trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR
trap finish EXIT

CHECKSUM_DIR="$(dirname "$CHECKSUM_PATH")"
(cd "$CHECKSUM_DIR" && shasum -a 256 -c "$(basename "$CHECKSUM_PATH")")
CHECKSUM_STATUS='PASS'

arch_value=''
case "$EXPECTED_ARCH" in
  arm64|aarch64) arch_value='arm64' ;;
  x64|x86_64|amd64) arch_value='x86_64' ;;
  *) echo "Unsupported expected architecture: $EXPECTED_ARCH" >&2; exit 64 ;;
esac

hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountpoint "$MOUNT_DIR" >/dev/null
APP_SOURCE="$MOUNT_DIR/Probaho Browser.app"
[[ -d "$APP_SOURCE" ]]
cp -R "$APP_SOURCE" "$APP_DEST"
actual_arch="$(file "$APP_DEST/Contents/MacOS/Probaho Browser" | grep -oE 'arm64|x86_64|universal' | tail -1 || true)"
if [[ "$actual_arch" == "$arch_value" || "$actual_arch" == 'universal' ]]; then
  ARCH_STATUS='PASS'
else
  write_report 'FAIL' "Expected $arch_value application architecture, found ${actual_arch:-unknown}."
  exit 1
fi

if [[ "$SKIP_SIGNATURE" == true ]]; then
  SIGNATURE_STATUS='WARN'
  GATEKEEPER_STATUS='WARN'
else
  codesign --verify --deep --strict --verbose=2 "$APP_DEST"
  SIGNATURE_STATUS='PASS'
  spctl --assess --type execute --verbose=2 "$APP_DEST"
  GATEKEEPER_STATUS='PASS'
fi

export HOME="$WORK_DIR/home"
export TMPDIR="$WORK_DIR/tmp"
mkdir -p "$HOME" "$TMPDIR"
"$APP_DEST/Contents/MacOS/Probaho Browser" --disable-gpu >"$WORK_DIR/launch.log" 2>&1 &
APP_PID=$!
sleep 12
kill -0 "$APP_PID"
LAUNCH_STATUS='PASS'
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
APP_PID=''

hdiutil detach "$MOUNT_DIR" -force >/dev/null
rm -rf "$APP_DEST"
if ! mount | grep -Fq "$MOUNT_DIR" && [[ ! -e "$APP_DEST" ]]; then
  CLEANUP_STATUS='PASS'
else
  write_report 'FAIL' 'The DMG remained mounted or the temporary application copy remained after cleanup.'
  exit 1
fi

write_report 'PASS' 'Checksum, architecture, signing/Gatekeeper checks, launch smoke test, and cleanup completed.'

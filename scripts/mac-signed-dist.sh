#!/usr/bin/env bash
# Local Developer ID + notarized DMG (same env as CI).
set -euo pipefail
cd "$(dirname "$0")/.."

export APPLE_TEAM_ID="${APPLE_TEAM_ID:-XPPUZJDN56}"

if [[ -z "${CSC_LINK:-}" && -z "${CSC_NAME:-}" ]]; then
  if security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
    export CSC_NAME=$(security find-identity -v -p codesigning | sed -n 's/.*"\(Developer ID Application:.*\)"/\1/p' | head -1)
    echo "CSC_NAME=$CSC_NAME"
  else
    echo "Set CSC_LINK + CSC_KEY_PASSWORD or install Developer ID Application (see scripts/mac-create-developer-id-csr.sh)" >&2
    exit 1
  fi
fi

if [[ -z "${APPLE_ID:-}" || -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
  echo "Warning: APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD not set — app will be signed but not notarized." >&2
fi

npm run dist:mac

APP="release/mac-arm64/Cursor Auto Runner.app"
[[ -d "$APP" ]] || APP="release/mac/Cursor Auto Runner.app"
codesign --verify --deep --strict --verbose=2 "$APP"
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
  xcrun stapler validate "$APP"
  spctl -a -t exec -vv "$APP"
fi
echo ""
echo "DMGs in release/:"
ls -la release/Cursor.Auto.Runner-*.dmg 2>/dev/null || ls -la release/*.dmg

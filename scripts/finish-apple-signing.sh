#!/usr/bin/env bash
# Run once after Apple Developer → Developer ID Application → download .cer
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CER="${1:-}"
if [[ -z "$CER" ]]; then
  for candidate in \
    "$HOME/Downloads/developerID_application.cer" \
    "$HOME/Downloads/development.cer" \
    "$HOME/Desktop/developerID_application.cer"; do
    [[ -f "$candidate" ]] && CER="$candidate" && break
  done
fi
if [[ -z "$CER" || ! -f "$CER" ]]; then
  echo "No .cer found. Download Developer ID Application cert from Apple, then:" >&2
  echo "  bash scripts/finish-apple-signing.sh ~/Downloads/developerID_application.cer" >&2
  open "https://developer.apple.com/account/resources/certificates/add" 2>/dev/null || true
  open -R "$HOME/Desktop/DeveloperIDApplication.csr" 2>/dev/null || open -R "$HOME/DeveloperIDApplication.csr"
  exit 1
fi

bash "$ROOT/scripts/install-developer-id-from-cer.sh" "$CER"

P12="${HOME}/DeveloperIDApplication-for-ci.p12"
if [[ ! -f "$P12" ]]; then
  echo "Missing ${P12}" >&2
  exit 1
fi

if [[ -z "${APPLE_ID:-}" || -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
  echo ""
  echo "Set notarization env (app-specific password from appleid.apple.com):"
  read -rp "APPLE_ID: " APPLE_ID
  read -rsp "APPLE_APP_SPECIFIC_PASSWORD: " APPLE_APP_SPECIFIC_PASSWORD
  echo ""
  export APPLE_ID APPLE_APP_SPECIFIC_PASSWORD
fi
export APPLE_TEAM_ID="${APPLE_TEAM_ID:-XPPUZJDN56}"

read -rsp "CSC_KEY_PASSWORD (same as .p12 export password): " CSC_KEY_PASSWORD
echo ""
export CSC_LINK="$P12"
export CSC_KEY_PASSWORD

B64=$(mktemp)
base64 < "$P12" | tr -d '\n' > "$B64"
gh secret set CSC_LINK --repo KurtStevenK/cursor-auto-runner < "$B64"
gh secret set CSC_KEY_PASSWORD --repo KurtStevenK/cursor-auto-runner --body "$CSC_KEY_PASSWORD"
gh secret set APPLE_ID --repo KurtStevenK/cursor-auto-runner --body "$APPLE_ID"
gh secret set APPLE_APP_SPECIFIC_PASSWORD --repo KurtStevenK/cursor-auto-runner --body "$APPLE_APP_SPECIFIC_PASSWORD"
gh secret set APPLE_TEAM_ID --repo KurtStevenK/cursor-auto-runner --body "$APPLE_TEAM_ID"
rm -f "$B64"

npm run dist:mac:signed
ditto "$ROOT/release/mac-arm64/Cursor Auto Runner.app" "/Applications/Cursor Auto Runner.app"
xattr -cr "/Applications/Cursor Auto Runner.app"
open -a "Cursor Auto Runner"

echo ""
echo "Tagged release: git tag v1.2.28 && git push origin HEAD --tags"

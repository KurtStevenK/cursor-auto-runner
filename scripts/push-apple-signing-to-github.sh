#!/usr/bin/env bash
# Upload macOS signing + notarization secrets to GitHub Actions.
set -euo pipefail

REPO="KurtStevenK/cursor-auto-runner"
TEAM_ID="XPPUZJDN56"

if ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  echo "No Developer ID Application certificate in Keychain." >&2
  echo "Run: bash scripts/mac-create-developer-id-csr.sh" >&2
  exit 1
fi

security find-identity -v -p codesigning | grep "Developer ID Application" | head -3

echo ""
echo "Export the certificate from Keychain Access:"
echo "  My Certificates → Developer ID Application: … → File → Export → .p12"
echo ""

read -rp "Path to exported .p12 file: " P12_PATH
if [[ ! -f "$P12_PATH" ]]; then
  echo "File not found: $P12_PATH" >&2
  exit 1
fi

read -rsp "Password for that .p12 (CSC_KEY_PASSWORD): " P12_PASS
echo ""
read -rp "Apple ID email (notarization): " APPLE_ID
read -rsp "App-specific password (appleid.apple.com): " APPLE_ASP
echo ""

B64=$(mktemp)
base64 < "$P12_PATH" | tr -d '\n' > "$B64"

echo "Uploading secrets to ${REPO}…"
gh secret set CSC_LINK --repo "$REPO" < "$B64"
gh secret set CSC_KEY_PASSWORD --repo "$REPO" --body "$P12_PASS"
gh secret set APPLE_ID --repo "$REPO" --body "$APPLE_ID"
gh secret set APPLE_APP_SPECIFIC_PASSWORD --repo "$REPO" --body "$APPLE_ASP"
gh secret set APPLE_TEAM_ID --repo "$REPO" --body "$TEAM_ID"

rm -f "$B64"
echo "Done. Tag a release (git tag v1.2.28 && git push origin v1.2.28) to publish signed DMGs."

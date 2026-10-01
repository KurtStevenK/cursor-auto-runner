#!/usr/bin/env bash
# Install a downloaded Developer ID Application .cer and build a .p12 for CI.
# Usage: bash scripts/install-developer-id-from-cer.sh ~/Downloads/developerID_application.cer
set -euo pipefail

CER="${1:?usage: $0 path/to/developerID_application.cer}"
KEY="${HOME}/DeveloperIDApplication.key"
WORKDIR=$(mktemp -d)
PEM="${WORKDIR}/developer_id.pem"
P12="${WORKDIR}/DeveloperIDApplication.p12"

if [[ ! -f "$KEY" ]]; then
  echo "Missing ${KEY} — run scripts/mac-create-developer-id-csr.sh first" >&2
  exit 1
fi

security import "$CER" -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign -T /usr/bin/security 2>/dev/null \
  || security import "$CER" -k ~/Library/Keychains/login.keychain-db

openssl x509 -inform DER -in "$CER" -out "$PEM" 2>/dev/null || openssl x509 -inform PEM -in "$CER" -out "$PEM"

read -rsp "Password for exported .p12 (used as CSC_KEY_PASSWORD): " P12_PASS
echo ""

openssl pkcs12 -export -out "$P12" -inkey "$KEY" -in "$PEM" -passout pass:"$P12_PASS"

OUT="${HOME}/DeveloperIDApplication-for-ci.p12"
cp "$P12" "$OUT"
echo "Wrote ${OUT}"

if security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  echo "Keychain identity:"
  security find-identity -v -p codesigning | grep "Developer ID Application"
else
  echo "Warning: Developer ID Application not listed yet — open Keychain Access and ensure the cert pairs with your private key." >&2
fi

echo ""
echo "Next: bash scripts/push-apple-signing-to-github.sh"
echo "  (use p12 path: ${OUT})"

rm -rf "$WORKDIR"

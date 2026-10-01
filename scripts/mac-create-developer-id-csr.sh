#!/usr/bin/env bash
# Create a CSR for a "Developer ID Application" certificate (direct download / Homebrew).
# Upload the CSR at developer.apple.com, install the downloaded .cer, then run:
#   bash scripts/push-apple-signing-to-github.sh
set -euo pipefail

KEY="${HOME}/DeveloperIDApplication.key"
CSR="${HOME}/DeveloperIDApplication.csr"
EMAIL="kurt.steven.kainzmayer@gmail.com"
CN="Kurt Steven Kainzmayer"

if security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  echo "A Developer ID Application identity is already in your keychain."
  security find-identity -v -p codesigning | grep "Developer ID Application"
  exit 0
fi

if [[ ! -f "$KEY" ]]; then
  echo "Creating key + CSR at:"
  echo "  $KEY"
  echo "  $CSR"
  openssl req -new -newkey rsa:2048 -nodes \
    -keyout "$KEY" \
    -out "$CSR" \
    -subj "/emailAddress=${EMAIL}, CN=${CN}, C=AT"
  chmod 600 "$KEY"
else
  echo "Reusing existing key: $KEY"
  if [[ ! -f "$CSR" ]]; then
    openssl req -new -key "$KEY" -out "$CSR" -subj "/emailAddress=${EMAIL}, CN=${CN}, C=AT"
  fi
fi

echo ""
echo "Next (one time in the browser):"
echo "  1. Certificates → + → Developer ID Application"
echo "  2. Upload: $CSR"
echo "  3. Download the .cer and double-click to add it to Keychain"
echo "  4. Run: bash scripts/push-apple-signing-to-github.sh"
echo ""

open "https://developer.apple.com/account/resources/certificates/add" 2>/dev/null || true
open -R "$CSR" 2>/dev/null || true

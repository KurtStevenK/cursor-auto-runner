#!/usr/bin/env bash
# Regenerate DeveloperIDApplication-for-ci.p12 and upload CSC_* to GitHub (non-interactive).
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-KurtStevenK/cursor-auto-runner}"
TEAM_ID="${APPLE_TEAM_ID:-XPPUZJDN56}"
CER="${1:-$HOME/Downloads/developerID_application.cer}"
KEY="${HOME}/DeveloperIDApplication.key"
OUT="${HOME}/DeveloperIDApplication-for-ci.p12"

if [[ ! -f "$KEY" || ! -f "$CER" ]]; then
  echo "Need $KEY and $CER" >&2
  exit 1
fi

WORKDIR=$(mktemp -d)
PEM="${WORKDIR}/developer_id.pem"
openssl x509 -inform DER -in "$CER" -out "$PEM" 2>/dev/null || openssl x509 -inform PEM -in "$CER" -out "$PEM"

CSC_PASS="${CSC_KEY_PASSWORD:-$(openssl rand -base64 24)}"
openssl pkcs12 -export -out "$OUT" -inkey "$KEY" -in "$PEM" -passout pass:"$CSC_PASS"
rm -rf "$WORKDIR"

openssl pkcs12 -in "$OUT" -passin pass:"$CSC_PASS" -nokeys -clcerts >/dev/null 2>&1 || {
  echo "Generated .p12 failed password check" >&2
  exit 1
}

B64=$(mktemp)
base64 < "$OUT" | tr -d '\n' > "$B64"
gh secret set CSC_LINK --repo "$REPO" < "$B64"
gh secret set CSC_KEY_PASSWORD --repo "$REPO" --body "$CSC_PASS"
gh secret set APPLE_TEAM_ID --repo "$REPO" --body "$TEAM_ID"
rm -f "$B64"

echo "Updated CSC_LINK, CSC_KEY_PASSWORD, APPLE_TEAM_ID on $REPO"
echo "Local p12: $OUT"
echo "CSC_KEY_PASSWORD is stored in GitHub Actions secrets (and matches the regenerated .p12)."
if [[ -z "${CSC_KEY_PASSWORD:-}" ]]; then
  echo "A new CSC_KEY_PASSWORD was generated and uploaded to GitHub — it is not printed here."
  echo "Export CSC_KEY_PASSWORD before running this script if you need a known value in your password manager."
fi

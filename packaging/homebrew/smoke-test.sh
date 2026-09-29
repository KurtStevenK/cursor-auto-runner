#!/usr/bin/env bash
# Verify Homebrew cask URLs and SHA-256 digests for a released version (run on macOS).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

VERSION="${VERSION:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: VERSION=1.2.18 $0" >&2
  exit 1
fi

CASK_URL="${CASK_URL:-https://raw.githubusercontent.com/KurtStevenK/homebrew-tap/main/Casks/cursor-auto-runner.rb}"
CASK_FILE="$(mktemp)"
trap 'rm -f "$CASK_FILE" /tmp/cursor-auto-runner-smoke-*.dmg' EXIT

if [[ -n "${RENDER_LOCAL:-}" ]]; then
  DMG_X64="release/Cursor.Auto.Runner-${VERSION}.dmg"
  DMG_ARM="release/Cursor.Auto.Runner-${VERSION}-arm64.dmg"
  if [[ ! -f "$DMG_X64" || ! -f "$DMG_ARM" ]]; then
    echo "Missing local DMGs; run npm run dist:mac or unset RENDER_LOCAL" >&2
    exit 1
  fi
  SHA_X64=$(shasum -a 256 "$DMG_X64" | awk '{print $1}')
  SHA_ARM=$(shasum -a 256 "$DMG_ARM" | awk '{print $1}')
  sed -e "s/__VERSION__/$VERSION/g" \
      -e "s/__SHA_X64__/$SHA_X64/g" \
      -e "s/__SHA_ARM__/$SHA_ARM/g" \
      packaging/homebrew/cursor-auto-runner.rb > "$CASK_FILE"
else
  curl -fsSL "$CASK_URL" -o "$CASK_FILE"
fi

CASK_VERSION="$(grep -E '^[[:space:]]*version ' "$CASK_FILE" | head -1 | sed -E 's/.*"([^"]+)".*/\1/')"
if [[ "$CASK_VERSION" != "$VERSION" ]]; then
  echo "Cask version $CASK_VERSION does not match VERSION=$VERSION" >&2
  exit 1
fi

SHA_INTEL="$(grep -E 'sha256.*intel:' "$CASK_FILE" | sed -E 's/.*intel: "([a-f0-9]+)".*/\1/')"
SHA_ARM_CASK="$(grep -E 'sha256.*arm:' "$CASK_FILE" | sed -E 's/.*arm: "([a-f0-9]+)".*/\1/')"

URL_INTEL="https://github.com/KurtStevenK/cursor-auto-runner/releases/download/v${VERSION}/Cursor.Auto.Runner-${VERSION}.dmg"
URL_ARM="https://github.com/KurtStevenK/cursor-auto-runner/releases/download/v${VERSION}/Cursor.Auto.Runner-${VERSION}-arm64.dmg"

TMP_INTEL="/tmp/cursor-auto-runner-smoke-intel.dmg"
TMP_ARM="/tmp/cursor-auto-runner-smoke-arm.dmg"

echo "Fetching $URL_INTEL"
curl -fL -o "$TMP_INTEL" "$URL_INTEL"
echo "Fetching $URL_ARM"
curl -fL -o "$TMP_ARM" "$URL_ARM"

DL_INTEL="$(shasum -a 256 "$TMP_INTEL" | awk '{print $1}')"
DL_ARM="$(shasum -a 256 "$TMP_ARM" | awk '{print $1}')"

if [[ "$DL_INTEL" != "$SHA_INTEL" ]]; then
  echo "Intel SHA mismatch: cask=$SHA_INTEL download=$DL_INTEL" >&2
  exit 1
fi
if [[ "$DL_ARM" != "$SHA_ARM_CASK" ]]; then
  echo "ARM SHA mismatch: cask=$SHA_ARM_CASK download=$DL_ARM" >&2
  exit 1
fi

if [[ "${BREW_STYLE:-}" == "1" ]] && command -v brew >/dev/null 2>&1; then
  brew style --cask "$CASK_FILE"
fi

echo "smoke-test OK (v${VERSION})"

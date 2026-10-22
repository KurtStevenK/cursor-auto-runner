#!/usr/bin/env bash
# Finn macOS builds (config: build/finn.config.js, output: release/finn/).
#   finn-dist.sh dmg   Developer ID DMG; notarized when ASC_KEY_ID + ASC_ISSUER_ID (or APPLE_ID +
#                      APPLE_APP_SPECIFIC_PASSWORD) are set
#   finn-dist.sh mas   Mac App Store .pkg for TestFlight / App Store upload
#   finn-dist.sh upload <pkg>   upload a .pkg with the App Store Connect API key
# MAS signing follows FeatherShot (packaging/mac/build_appstore.sh there): electron-builder signs the
# sandboxed app with Apple Distribution, then `xcodebuild -exportArchive` (automatic signing) embeds
# the Mac App Store profile and signs the installer package.
set -euo pipefail
cd "$(dirname "$0")/.."

TEAM_ID="${APPLE_TEAM_ID:-XPPUZJDN56}"
BUNDLE_ID="xyz.kainzmayer.finn"
VERSION=$(node -p "require('./package.json').version")
BUILD="${FINN_BUILD:-$(date +%Y%m%d%H%M)}"
OUT="release/finn"

identity() {
  security find-identity -v -p codesigning | sed -n "s/.*\"\($1:.*\)\"/\1/p" | head -1
}

build_dmg() {
  local id
  id="${CSC_NAME:-$(identity 'Developer ID Application')}"
  [[ -n "$id" ]] || { echo "No Developer ID Application identity in keychain" >&2; exit 1; }
  # electron-builder wants the name without the certificate type prefix.
  export CSC_NAME="${id#Developer ID Application: }"
  export APPLE_TEAM_ID="$TEAM_ID"
  # Notarize with the App Store Connect API key when it is configured (same key as the upload).
  if [[ -n "${ASC_KEY_ID:-}" && -n "${ASC_ISSUER_ID:-}" ]]; then
    export APPLE_API_KEY="${APPLE_API_KEY:-$HOME/.private_keys/AuthKey_${ASC_KEY_ID}.p8}"
    export APPLE_API_KEY_ID="$ASC_KEY_ID" APPLE_API_ISSUER="$ASC_ISSUER_ID"
  elif [[ -z "${APPLE_ID:-}" || -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
    echo "Warning: set ASC_KEY_ID + ASC_ISSUER_ID (or APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD) to notarize; DMG is signed only." >&2
  fi
  npm run compile
  npx electron-builder --config build/finn.config.js --mac dmg --arm64 --publish never
  codesign --verify --deep --strict --verbose=2 "$OUT/mac-arm64/Finn.app"
  ls -la "$OUT"/Finn-*.dmg
}

build_mas() {
  local sign_id app archive export_dir plist pkg
  sign_id="${MAS_SIGN_IDENTITY:-$(identity 'Apple Distribution')}"
  [[ -n "$sign_id" ]] || { echo "No Apple Distribution identity in keychain" >&2; exit 1; }
  npm run compile
  # The installer step needs a Mac Installer Distribution identity; without one electron-builder
  # stops after signing the app, and xcodebuild below signs the package instead.
  CSC_NAME="${sign_id#Apple Distribution: }" npx electron-builder --config build/finn.config.js \
    --mac mas --arm64 --publish never -c.buildVersion="$BUILD" || true
  app="$OUT/mas-arm64/Finn.app"
  codesign --verify --deep --strict --verbose=2 "$app"

  archive="$OUT/appstore/Finn.xcarchive"
  export_dir="$OUT/appstore/export"
  plist="$OUT/appstore/ExportOptions.plist"
  rm -rf "$OUT/appstore"
  mkdir -p "$archive/Products/Applications" "$export_dir"
  ditto "$app" "$archive/Products/Applications/Finn.app"
  cat > "$archive/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>ApplicationProperties</key>
  <dict>
    <key>ApplicationPath</key><string>Applications/Finn.app</string>
    <key>Architectures</key><array><string>arm64</string></array>
    <key>CFBundleIdentifier</key><string>${BUNDLE_ID}</string>
    <key>CFBundleShortVersionString</key><string>${VERSION}</string>
    <key>CFBundleVersion</key><string>${BUILD}</string>
    <key>SigningIdentity</key><string>${sign_id}</string>
    <key>Team</key><string>${TEAM_ID}</string>
  </dict>
  <key>ArchiveVersion</key><integer>2</integer>
  <key>CreationDate</key><date>$(date -u +%Y-%m-%dT%H:%M:%SZ)</date>
  <key>Name</key><string>Finn</string>
  <key>SchemeName</key><string>Finn</string>
</dict>
</plist>
PLIST
  cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>${TEAM_ID}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><false/>
</dict>
</plist>
PLIST
  xcodebuild -exportArchive -archivePath "$archive" -exportPath "$export_dir" \
    -exportOptionsPlist "$plist" -allowProvisioningUpdates
  pkg="$OUT/Finn-${VERSION}-${BUILD}-AppStore.pkg"
  cp "$(find "$export_dir" -name '*.pkg' | head -1)" "$pkg"
  pkgutil --check-signature "$pkg" | head -4
  echo "Done: $pkg"
}

upload() {
  local pkg="$1"
  : "${ASC_KEY_ID:?Set ASC_KEY_ID (App Store Connect API key ID)}"
  : "${ASC_ISSUER_ID:?Set ASC_ISSUER_ID (App Store Connect → Users and Access → Integrations)}"
  # System PATH so GNU mktemp from coreutils does not break iTMSTransporter's Java.
  PATH="/usr/bin:/bin:/usr/sbin:/sbin:$(xcode-select -p)/usr/bin" TMPDIR=/tmp \
    xcrun iTMSTransporter -m upload -assetFile "$(cd "$(dirname "$pkg")" && pwd)/$(basename "$pkg")" \
    -apiKey "$ASC_KEY_ID" -apiIssuer "$ASC_ISSUER_ID"
}

case "${1:-}" in
  dmg) build_dmg ;;
  mas) build_mas ;;
  upload) upload "${2:?pkg path}" ;;
  *) echo "usage: $0 dmg|mas|upload <pkg>" >&2; exit 2 ;;
esac

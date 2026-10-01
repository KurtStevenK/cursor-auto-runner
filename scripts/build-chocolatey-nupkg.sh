#!/usr/bin/env bash
# Build cursor-auto-runner.nupkg locally (metadata + install script). Requires: choco CLI (Windows or choco on PATH).
set -euo pipefail

VERSION="${1:?usage: $0 <version> [path-to-setup.exe]}"
EXE="${2:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "$EXE" ]]; then
  for candidate in \
    "release/Cursor Auto Runner Setup ${VERSION}.exe" \
    "release/Cursor.Auto.Runner.Setup.${VERSION}.exe"; do
    [[ -f "$candidate" ]] && EXE="$candidate" && break
  done
fi

if [[ -z "$EXE" || ! -f "$EXE" ]]; then
  echo "Download installer first, e.g.:" >&2
  echo "  gh release download v${VERSION} --pattern 'Cursor.Auto.Runner.Setup.${VERSION}.exe' -D release" >&2
  exit 1
fi

if ! command -v choco >/dev/null 2>&1; then
  echo "choco CLI not found. On macOS use GitHub Actions:" >&2
  echo "  gh workflow run chocolatey-moderation-push.yml -f version=${VERSION}" >&2
  exit 1
fi

SHA=$(shasum -a 256 "$EXE" | awk '{print $1}')
PKG=choco-pkg
mkdir -p "$PKG/tools"
sed -e "s/__VERSION__/$VERSION/g" -e "s/__EXESHA__/$SHA/g" packaging/chocolatey/cursor-auto-runner.nuspec > "$PKG/cursor-auto-runner.nuspec"
sed -e "s/__VERSION__/$VERSION/g" -e "s/__EXESHA__/$SHA/g" packaging/chocolatey/tools/chocolateyinstall.ps1 > "$PKG/tools/chocolateyinstall.ps1"
( cd "$PKG" && choco pack )
echo "Built: $PKG/cursor-auto-runner.${VERSION}.nupkg"
echo "Push: choco push $PKG/cursor-auto-runner.${VERSION}.nupkg --source https://push.chocolatey.org/"

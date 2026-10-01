#!/usr/bin/env bash
# Mirror GitHub Release assets (and optional local extras) to Firebase Storage under releases/<version>/.
set -euo pipefail

VERSION="${1:?usage: $0 <version> [extra-dir]}"
BUCKET="${FIREBASE_STORAGE_BUCKET:?set FIREBASE_STORAGE_BUCKET}"
REPO="${GITHUB_REPOSITORY:-KurtStevenK/cursor-auto-runner}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud required" >&2
  exit 1
fi

WORKDIR="${TMPDIR:-/tmp}/car-mirror-${VERSION}"
mkdir -p "$WORKDIR"

echo "Downloading GitHub release v${VERSION} assets..."
if command -v gh >/dev/null 2>&1; then
  gh release download "v${VERSION}" --repo "$REPO" --dir "$WORKDIR" 2>/dev/null || true
fi

if [[ -n "${2:-}" && -d "${2:-}" ]]; then
  echo "Merging extra files from $2"
  cp -n "$2"/* "$WORKDIR"/ 2>/dev/null || cp "$2"/* "$WORKDIR"/ || true
fi

shopt -s nullglob
files=("$WORKDIR"/*)
if ((${#files[@]} == 0)); then
  echo "No files to upload in $WORKDIR" >&2
  exit 1
fi

for f in "${files[@]}"; do
  [[ -f "$f" ]] || continue
  name=$(basename "$f")
  dest="gs://${BUCKET}/releases/${VERSION}/${name}"
  echo "Uploading $name -> $dest"
  gcloud storage cp "$f" "$dest" --cache-control="public, max-age=86400"
done

echo "Done. Example URL:"
name=$(basename "${files[0]}")
echo "  https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/releases%2F${VERSION}%2F${name}?alt=media"

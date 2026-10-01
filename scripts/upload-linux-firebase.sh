#!/usr/bin/env bash
# Upload Linux release artifacts to Firebase Storage (GCS bucket).
# Requires: FIREBASE_STORAGE_BUCKET, GOOGLE_APPLICATION_CREDENTIALS or gcloud auth.
set -euo pipefail

VERSION="${1:?usage: $0 <version> [artifacts-dir]}"
DIR="${2:-release}"
BUCKET="${FIREBASE_STORAGE_BUCKET:?set FIREBASE_STORAGE_BUCKET e.g. myproject.firebasestorage.app}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI required (Google Cloud SDK)" >&2
  exit 1
fi

# gcloud does not read GOOGLE_APPLICATION_CREDENTIALS on its own.
if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
  gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS" --quiet
fi

upload_name() {
  local base
  base=$(basename "$1")
  if [[ "$base" == *".AppImage" ]]; then
    echo "cursor-auto-runner-${VERSION}.AppImage"
  else
    echo "$base"
  fi
}

shopt -s nullglob
appimage=""
for candidate in \
  "$DIR"/cursor-auto-runner-"${VERSION}".AppImage \
  "$DIR"/Cursor.Auto.Runner-"${VERSION}".AppImage \
  "$DIR"/"Cursor Auto Runner-${VERSION}.AppImage"; do
  if [[ -f "$candidate" ]]; then
    appimage="$candidate"
    break
  fi
done
files=()
[[ -n "$appimage" ]] && files+=("$appimage")
for f in \
  "$DIR"/cursor-auto-runner_"${VERSION}"_amd64.deb \
  "$DIR"/cursor-auto-runner-"${VERSION}".pacman; do
  [[ -f "$f" ]] && files+=("$f")
done

if ((${#files[@]} == 0)); then
  echo "No Linux artifacts in $DIR for version $VERSION" >&2
  ls -la "$DIR" 2>/dev/null || true
  exit 1
fi

for f in "${files[@]}"; do
  name=$(upload_name "$f")
  dest="gs://${BUCKET}/linux/${VERSION}/${name}"
  echo "Uploading $f -> $dest"
  gcloud storage cp "$f" "$dest" --cache-control="public, max-age=86400"
done

echo "Done. Public URLs (encode slashes as %2F):"
for f in "${files[@]}"; do
  name=$(upload_name "$f")
  echo "  https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/linux%2F${VERSION}%2F${name}?alt=media"
done

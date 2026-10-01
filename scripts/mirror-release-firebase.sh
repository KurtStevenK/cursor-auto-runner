#!/usr/bin/env bash
# Mirror release installers to Firebase Storage under releases/<version>/.
#
# usage:
#   $0 <version> [artifacts-root]
#
# artifacts-root (CI): tree with windows/, linux/, macos/ subdirs, or a flat dir of files.
# Without artifacts-root: download GitHub Release assets with gh (manual backfill).
set -euo pipefail

VERSION="${1:?usage: $0 <version> [artifacts-root]}"
BUCKET="${FIREBASE_STORAGE_BUCKET:?set FIREBASE_STORAGE_BUCKET}"
REPO="${GITHUB_REPOSITORY:-KurtStevenK/cursor-auto-runner}"
ARTIFACTS_ROOT="${2:-}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud required" >&2
  exit 1
fi

if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
  gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS" --quiet
fi

WORKDIR="${TMPDIR:-/tmp}/car-mirror-${VERSION}"
STAGE="${WORKDIR}/stage"
rm -rf "$WORKDIR"
mkdir -p "$STAGE"

should_skip_basename() {
  case "$1" in
    *.blockmap | *.nupkg) return 0 ;;
    *) return 1 ;;
  esac
}

stage_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local base
  base=$(basename "$f")
  should_skip_basename "$base" && return 0
  cp "$f" "$STAGE/$base"
}

stage_from_artifacts_tree() {
  local root="$1"
  local sub
  for sub in windows linux macos; do
    [[ -d "$root/$sub" ]] || continue
    local f
    for f in "$root/$sub"/*; do
      stage_file "$f"
    done
  done
}

stage_from_flat_dir() {
  local f
  for f in "$1"/*; do
    stage_file "$f"
  done
}

if [[ -n "$ARTIFACTS_ROOT" && -d "$ARTIFACTS_ROOT" ]]; then
  echo "Staging release files from $ARTIFACTS_ROOT"
  if [[ -d "$ARTIFACTS_ROOT/windows" || -d "$ARTIFACTS_ROOT/linux" || -d "$ARTIFACTS_ROOT/macos" ]]; then
    stage_from_artifacts_tree "$ARTIFACTS_ROOT"
  else
    stage_from_flat_dir "$ARTIFACTS_ROOT"
  fi
else
  echo "Downloading GitHub release v${VERSION} assets..."
  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI required when no artifacts-root is passed" >&2
    exit 1
  fi
  gh release download "v${VERSION}" --repo "$REPO" --dir "$STAGE"
fi

shopt -s nullglob
files=("$STAGE"/*)
if ((${#files[@]} == 0)); then
  echo "No files to upload in $STAGE" >&2
  ls -la "$STAGE" 2>/dev/null || true
  exit 1
fi

for f in "${files[@]}"; do
  [[ -f "$f" ]] || continue
  name=$(basename "$f")
  should_skip_basename "$name" && continue
  dest="gs://${BUCKET}/releases/${VERSION}/${name}"
  echo "Uploading $name -> $dest"
  gcloud storage cp "$f" "$dest" --cache-control="public, max-age=86400"
done

echo "Done. Example URL:"
name=$(basename "${files[0]}")
echo "  https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/releases%2F${VERSION}%2F${name}?alt=media"

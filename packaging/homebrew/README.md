# Homebrew tap (`KurtStevenK/homebrew-tap`)

macOS users install with:

```bash
brew install --cask KurtStevenK/tap/cursor-auto-runner
```

Homebrew maps `KurtStevenK/tap` to the public repository **`KurtStevenK/homebrew-tap`**. The cask is updated automatically on every tagged release (`v*`) by the **Update Homebrew tap** step in [`.github/workflows/build.yml`](../../.github/workflows/build.yml).

## One-time setup (maintainer)

1. Public repository **`KurtStevenK/homebrew-tap`** (may already exist; it can host multiple casks).
2. **PAT for CI:** GitHub → Developer settings → Personal access tokens.
   - Classic token with **`repo`** scope, or fine-grained token with **Contents: Read and write** on **`homebrew-tap`** (and **`apt`** if APT publishing should keep working).
3. In **`cursor-auto-runner`** → Settings → Secrets → Actions:
   - **`TAP_TOKEN`**: PAT value (same secret is used for APT repo push).
4. Push a tag (`v*`). The release job renders [cursor-auto-runner.rb](cursor-auto-runner.rb) with version and SHA-256 digests of the two arch DMGs and pushes `Casks/cursor-auto-runner.rb` to the tap.

**Verify on GitHub:** [homebrew-tap/Casks/cursor-auto-runner.rb](https://github.com/KurtStevenK/homebrew-tap/blob/main/Casks/cursor-auto-runner.rb) has real `version` / `sha256` (no `__VERSION__` placeholders).

## DMG filenames (must stay in sync)

| Intel | `Cursor.Auto.Runner-<version>.dmg` |
| ARM64 | `Cursor.Auto.Runner-<version>-arm64.dmg` |

These names are produced by [`scripts/rename-mac-dmg-artifacts.js`](../../scripts/rename-mac-dmg-artifacts.js) after `npm run dist:mac` (electron-builder defaults to spaced `productName` basenames), match the cask `url` lines in [cursor-auto-runner.rb](cursor-auto-runner.rb), and are what CI hashes before updating the tap.

## User upgrade

```bash
brew upgrade --cask cursor-auto-runner
```

Or download the DMG from [GitHub Releases](https://github.com/KurtStevenK/cursor-auto-runner/releases/latest).

## Release smoke test (macOS)

After a release is published:

```bash
VERSION=1.2.19 bash packaging/homebrew/smoke-test.sh
```

Optional: pass `CASK_URL` to test the live tap file instead of rendering the template locally.

## Local cask render (debug)

Build DMGs locally (`npm run dist:mac`), then render the cask the same way CI does:

```bash
VERSION=1.2.18
DMG_X64="release/Cursor.Auto.Runner-${VERSION}.dmg"
DMG_ARM="release/Cursor.Auto.Runner-${VERSION}-arm64.dmg"
SHA_X64=$(shasum -a 256 "$DMG_X64" | awk '{print $1}')
SHA_ARM=$(shasum -a 256 "$DMG_ARM" | awk '{print $1}')
sed -e "s/__VERSION__/$VERSION/g" \
    -e "s/__SHA_X64__/$SHA_X64/g" \
    -e "s/__SHA_ARM__/$SHA_ARM/g" \
    packaging/homebrew/cursor-auto-runner.rb
```

Compare output to the live tap cask or run `brew install --cask` with a local tap checkout.

## Troubleshooting

| Symptom | Likely cause | Fix |
|--------|----------------|-----|
| `brew install` checksum mismatch | Tap SHA-256 does not match the DMG at the cask URL | Re-tag after fixing `artifactName` / CI `DMG_*` paths; confirm release asset names with `gh release view vX.Y.Z --json assets` |
| 404 on DMG URL | Release asset basename differs from cask (spaces vs dots) | Ensure `npm run dist:mac` ran the rename script; CI uses the same dotted paths in `build.yml` |
| Tap not updated | Missing `TAP_TOKEN` or release job failed before tap step | Check **Build releases** logs for **Verify publish secrets** / **Update Homebrew tap** |
| Stale cask version | Tag built before tap step succeeded | Re-run **Build releases** on the tag or push a patch tag |

Functional check after install: open **Cursor Auto Runner** from Applications; grant **Screen Recording** and **Accessibility** when prompted.

# macOS signing (Developer ID) & App Store (later)

Never commit `.p12` or private `.key` files — see [SECURITY.md](../../SECURITY.md) and [`.gitignore`](../../.gitignore).

## Two different Apple certificates

| Certificate | Use |
|-------------|-----|
| **Developer ID Application** | DMG, ZIP, Homebrew — normal install outside the App Store (**required now**) |
| **Apple Distribution** | Mac App Store only (you already have this; use when you ship on the Store) |

Your Mac currently has **Apple Development** and **Apple Distribution**. You still need **Developer ID Application** for public DMG/Homebrew builds.

## One-time: Developer ID + GitHub Actions

```bash
# 1) Create CSR and open Apple’s certificate page
bash scripts/mac-create-developer-id-csr.sh
# Upload ~/DeveloperIDApplication.csr → Developer ID Application → install .cer

# 2) Keychain Access → export Developer ID Application as .p12

# 3) App-specific password: https://appleid.apple.com

# 4) Push secrets to GitHub (interactive)
bash scripts/push-apple-signing-to-github.sh
```

If CI fails with `SecKeychainUnlock: passphrase you entered is not correct` on `set-key-partition-list`, the **CSC_KEY_PASSWORD** does not match **CSC_LINK** (base64 `.p12`). Regenerate from your key + `.cer` and re-upload:

```bash
bash scripts/refresh-csc-github-secrets.sh
# Saves ~/DeveloperIDApplication-for-ci.p12 and updates CSC_LINK + CSC_KEY_PASSWORD on GitHub
```

Optional notarization secrets (interactive): `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` via `push-apple-signing-to-github.sh`.

Required for signed macOS CI: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_TEAM_ID` (`XPPUZJDN56`).

Register App ID **`com.kurtstevenk.cursor-auto-runner`** in [Identifiers](https://developer.apple.com/account/resources/identifiers/list) if it does not exist yet.

## Release on GitHub

```bash
git tag v1.2.28
git push origin v1.2.28
```

The `macos` job signs + notarizes, then the release includes:

- `Cursor.Auto.Runner-<version>.dmg` (Intel)
- `Cursor.Auto.Runner-<version>-arm64.dmg` (Apple Silicon)
- `Cursor.Auto.Runner-<version>-mac.zip` / `-arm64-mac.zip` (signed `.app` archives)

Tagged releases **fail** if Apple secrets are missing (no more ad-hoc Homebrew builds).

## Local signed build

```bash
export APPLE_ID=...
export APPLE_APP_SPECIFIC_PASSWORD=...
export APPLE_TEAM_ID=XPPUZJDN56
npm run dist:mac:signed
```

## Verify

```bash
codesign --verify --deep --strict "release/mac-arm64/Cursor Auto Runner.app"
spctl -a -t exec -vv "release/mac-arm64/Cursor Auto Runner.app"
```

Expect `Developer ID Application` and `accepted`.

## Mac App Store (later)

See [APP-STORE.md](APP-STORE.md). Store builds use **Apple Distribution**, sandbox entitlements, and a separate `mas` target — not the same artifact as the DMG.

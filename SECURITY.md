# Security

This repository is **public**. Signing keys, API tokens, and service accounts must stay out of git.

## Never commit

- Apple **`.p12` / `.pfx`** and private **`.key`** (e.g. `DeveloperIDApplication.key`)
- **`apt-signing-private.asc`** (APT repo private GPG key)
- **Firebase / GCP service account JSON** (e.g. `firebase-sa.json`, `car-linux-releases-sa.json`)
- **`.env`** and **`.env.local`** (local secrets including `VIRUSTOTAL_API_KEY`)
- **PATs** (`TAP_TOKEN`), Chocolatey keys, Apple app-specific passwords, or base64-encoded `CSC_LINK`

Public APT **`gpg.key`** on [KurtStevenK/apt](https://github.com/KurtStevenK/apt) `gh-pages` is intentional (public key only).

See [`.gitignore`](.gitignore) for the full ignore list.

## Where secrets live

| Secret | Purpose | Setup |
|--------|---------|--------|
| `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | macOS Developer ID sign + notarize | [packaging/mac/README.md](packaging/mac/README.md) |
| `APT_GPG_PRIVATE_KEY`, `APT_GPG_PASSPHRASE`, `TAP_TOKEN` | APT repo + tap push | [packaging/apt/README.md](packaging/apt/README.md) |
| `FIREBASE_SERVICE_ACCOUNT_LINUX`, `FIREBASE_STORAGE_BUCKET` | Linux release mirror | [packaging/linux/firebase/README.md](packaging/linux/firebase/README.md) |
| `CHOCOLATEY_API_KEY` | Chocolatey publish | [packaging/chocolatey/README.md](packaging/chocolatey/README.md) |
| `VIRUSTOTAL_API_KEY` | Optional release artifact scan in CI | [.env.example](.env.example), GitHub Actions secret |

Local VirusTotal scans: copy `.env.example` → `.env.local`, set `VIRUSTOTAL_API_KEY`, then after a build:

```bash
npm run scan:virustotal
# or: node scripts/virustotal-scan.js --artifacts-dir release
```

Tagged releases run the same scan in CI when `VIRUSTOTAL_API_KEY` is configured; results are appended to GitHub Release notes. A full release may scan several installers and take **30–60+ minutes** (API rate limits and polling).

## If a secret was committed

1. **Rotate/revoke** the credential immediately (Apple cert, PAT, GPG key, Firebase SA, VirusTotal key, etc.).
2. Remove the file from history: [GitHub — removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Reporting vulnerabilities

Please report security issues via [GitHub Security Advisories](https://github.com/KurtStevenK/cursor-auto-runner/security/advisories/new) or email the maintainer listed in [`package.json`](package.json).

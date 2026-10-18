# Windows code signing

Windows installers are currently **unsigned**. The release workflow ([build.yml](../../.github/workflows/build.yml), `windows` job) already contains the signing steps; they stay skipped until the maintainer creates the secrets below. No code change is needed to turn signing on.

## Why sign

- **SmartScreen**: unsigned installers show "Windows protected your PC" and a reputation warning on download.
- **Chocolatey moderation**: signed installers are reviewed with far less friction.
- **Auto-update trust**: `electron-updater` verifies the publisher certificate on Windows only when `build.win.publisherName` is configured. Without signing there is nothing to verify, so updates are protected by the SHA-512 in `latest.yml` only.

## Option A: Azure Trusted Signing (wired up)

Cost is roughly **$10/month** (Basic tier). Microsoft requires identity validation; individual developers are supported in the supported regions (check current availability in the Azure portal).

1. In Azure, create a **Trusted Signing account** and complete identity validation.
2. Create a **certificate profile** (Public Trust).
3. Create an app registration (service principal) and assign it the **Trusted Signing Certificate Profile Signer** role on the account.
4. Add these GitHub Actions secrets (repository settings):

| Secret | Value |
|--------|-------|
| `AZURE_TENANT_ID` | Directory (tenant) ID of the app registration |
| `AZURE_CLIENT_ID` | Application (client) ID |
| `AZURE_CLIENT_SECRET` | Client secret of the app registration |
| `AZURE_TRUSTED_SIGNING_ENDPOINT` | Regional endpoint, e.g. `https://eus.codesigning.azure.net/` |
| `AZURE_TRUSTED_SIGNING_ACCOUNT` | Trusted Signing account name (its presence enables signing) |
| `AZURE_CERTIFICATE_PROFILE` | Certificate profile name |

What happens on a `v*` tag once `AZURE_TRUSTED_SIGNING_ACCOUNT` is set (job order):

1. `npm run dist:win` builds the unsigned NSIS installer.
2. `azure/trusted-signing-action` signs `release/*.exe` (SHA256, RFC 3161 timestamp).
3. `Get-AuthenticodeSignature` verification fails the job unless every installer is `Valid`.
4. `scripts/refresh-update-feed-hashes.js` recomputes `sha512` and `size` in `release/latest.yml`, because signing changes the installer bytes.
5. `npm run test:packaged-worker`, then the Chocolatey package is built from the signed installer (so its SHA-256 matches).

Untagged builds and repositories without the secrets build unsigned, as before.

## Option B: SignPath Foundation (not implemented)

[SignPath Foundation](https://signpath.org/) signs open-source projects for free. It requires an approved project application (OSS licence, public repository, reputable release process) and uses the SignPath GitHub action with an organization ID, project/signing-policy slugs and an API token, typically uploading the unsigned artifact and downloading the signed one. Certificates are issued to SignPath Foundation, so the publisher name is theirs. This is described only; it is not wired into the workflow.

## Follow-up: enable the publisher check

Once signed releases ship, set `build.win.publisherName` in `package.json` to the **certificate subject CN** (the `Subject` printed by the verification step in the workflow log). Then `electron-updater` rejects updates not signed by that publisher.

This is **not set yet** because the certificate CN is unknown until the first signed build. Setting it before installers are signed, or with a wrong value, would break updates.

# Chocolatey package (`cursor-auto-runner`)

Windows installs via [Chocolatey Community](https://community.chocolatey.org/packages/cursor-auto-runner):

```powershell
choco install cursor-auto-runner
```

The `.nupkg` is built in the **Build releases** workflow on tagged releases. It downloads the NSIS installer from GitHub Releases (see `tools/chocolateyinstall.ps1`).

`iconUrl` in the nuspec must **not** use `raw.githubusercontent.com` (moderation rejects it). CI renders:

`https://cdn.jsdelivr.net/gh/KurtStevenK/cursor-auto-runner@v<version>/assets/icons/icon-256.png`

## First-time moderation

The first pushed version stays **unlisted** until a moderator approves it. While **no version is approved**, Chocolatey returns **403** on pushes of newer versions.

CI behavior (since v1.2.14):

1. [`should-push.sh`](should-push.sh) loads the community package page.
2. If no approved version exists yet, the **chocolatey** job logs a notice and **exits successfully** (workflow stays green).
3. After approval, new tags push normally; older skipped versions use the retry workflow below.

## Manual push after approval

If a release tag was built while moderation blocked push:

1. Open **Actions → Chocolatey push** in this repository.
2. **Run workflow** with the release tag (e.g. `v1.2.12`).
3. The job downloads `cursor-auto-runner.<version>.nupkg` from that GitHub Release and runs `choco push`.

Requires **`CHOCOLATEY_API_KEY`** in repository secrets (same as Build releases).

## Local check

```bash
bash packaging/chocolatey/should-push.sh
echo "exit code: $?"
# 0 = push allowed, 2 = skip (moderation), other = error
```

## Maintainer links

- Package status: https://community.chocolatey.org/packages/cursor-auto-runner
- Push docs: https://docs.chocolatey.org/en-us/create/commands/push/
- Common 403 causes: https://docs.chocolatey.org/en-us/community-repository/maintainers/common-errors/

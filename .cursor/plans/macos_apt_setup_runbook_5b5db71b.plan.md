---
name: macOS APT setup runbook
overview: "Finish the Debian/Ubuntu APT channel from a Mac: generate the signing key, add the GitHub Actions secret, re-run the failed v1.2.11 release job, enable Pages on KurtStevenK/apt, and optionally smoke-test install with Docker."
todos:
  - id: mac-gpg-key
    content: "On Mac: generate APT GPG key and save apt-signing-private.asc (Step 1)"
    status: completed
  - id: mac-gh-secret
    content: gh secret set APT_GPG_PRIVATE_KEY on KurtStevenK/cursor-auto-runner (Step 2)
    status: completed
  - id: mac-rerun-ci
    content: Re-run failed Build releases workflow for tag v1.2.11 (Step 3)
    status: completed
  - id: mac-enable-pages
    content: Enable KurtStevenK/apt GitHub Pages from gh-pages branch (Step 4)
    status: completed
  - id: mac-verify-apt
    content: curl InRelease/gpg.key and optional Docker apt-get install test (Steps 5–6)
    status: completed
isProject: false
---

# macOS runbook: finish APT repo and `apt-get install`

The implementation in [cursor-auto-runner](cursor-auto-runner) is already merged (scripts under [packaging/apt/](cursor-auto-runner/packaging/apt/), CI step **Update APT repository** in [.github/workflows/build.yml](cursor-auto-runner/.github/workflows/build.yml)). Repo [KurtStevenK/apt](https://github.com/KurtStevenK/apt) exists.

**Why v1.2.11 failed:** the release job reached **Update APT repository** then exited with `APT_GPG_PRIVATE_KEY is required`. Secrets today: `TAP_TOKEN`, `CHOCOLATEY_API_KEY` only — no APT key yet.

You do **not** need to re-implement the plan on macOS; this runbook is operator steps on your Mac.

## Prerequisites on the Mac

- **Homebrew** (for `gpg` and `gh` if missing):

```bash
brew install gnupg gh
gh auth login   # if not already logged in as KurtStevenK
```

- Clone or `cd` into your `cursor-auto-runner` repo (optional; only needed for local smoke test).

---

## Step 1 — Generate APT signing key (no passphrase recommended for CI)

```bash
export GNUPGHOME="$HOME/.gnupg-apt-cursor-auto-runner"
mkdir -p "$GNUPGHOME"
chmod 700 "$GNUPGHOME"

gpg --homedir "$GNUPGHOME" --batch --passphrase '' \
  --quick-generate-key 'Cursor Auto Runner APT <kurt.steven.kainzmayer@gmail.com>' rsa4096

KEY_ID="$(gpg --homedir "$GNUPGHOME" --list-secret-keys --with-colons \
  | awk -F: '$1=="sec"{print $5; exit}')"

echo "Signing key: $KEY_ID"

gpg --homedir "$GNUPGHOME" --armor --export-secret-keys "$KEY_ID" \
  > ~/apt-signing-private.asc

gpg --homedir "$GNUPGHOME" --armor --export "$KEY_ID" \
  > ~/apt-signing-public.asc
```

Keep `apt-signing-private.asc` private; back it up securely (1Password, etc.).

---

## Step 2 — Add GitHub Actions secret

From the Mac (repo must be `KurtStevenK/cursor-auto-runner`):

```bash
gh secret set APT_GPG_PRIVATE_KEY \
  --repo KurtStevenK/cursor-auto-runner \
  < ~/apt-signing-private.asc
```

Only if you used a passphrase on the key:

```bash
gh secret set APT_GPG_PASSPHRASE --repo KurtStevenK/cursor-auto-runner
# paste passphrase when prompted
```

Confirm:

```bash
gh secret list --repo KurtStevenK/cursor-auto-runner
# should show APT_GPG_PRIVATE_KEY (and optionally APT_GPG_PASSPHRASE)
```

`TAP_TOKEN` is already present and is used to push to `KurtStevenK/apt`.

---

## Step 3 — Re-publish APT (re-run CI, no new tag required)

The v1.2.11 tag build failed **after** building the `.deb`; re-running the workflow is enough.

```bash
gh run list --repo KurtStevenK/cursor-auto-runner --workflow "Build releases" --limit 3
# find the failed run for tag v1.2.11, then:
gh run rerun <RUN_ID> --repo KurtStevenK/cursor-auto-runner --failed
```

Or re-run from GitHub: **Actions → Build releases → failed v1.2.11 run → Re-run failed jobs**.

Watch the **release → Update APT repository** step until it succeeds and pushes `gh-pages` to `KurtStevenK/apt`.

Verify branch:

```bash
gh api repos/KurtStevenK/apt/branches --jq '.[].name'
# expect gh-pages (and main)
```

---

## Step 4 — Enable GitHub Pages on `KurtStevenK/apt` (one-time)

After `gh-pages` exists with `pool/`, `dists/`, `gpg.key`, and `.nojekyll`:

1. Open https://github.com/KurtStevenK/apt/settings/pages  
2. **Build and deployment** → Source: **Deploy from a branch**  
3. Branch: **`gh-pages`** / **`/ (root)`** → Save  

Wait 1–2 minutes, then check:

```bash
curl -fsSL https://kurtstevenk.github.io/apt/gpg.key | head -3
curl -fsSL https://kurtstevenk.github.io/apt/dists/stable/InRelease | head -5
```

Both should return data (not 404).

---

## Step 5 — Smoke-test APT scripts locally (optional, Mac + Docker)

If **Docker Desktop** is installed:

```bash
cd /path/to/cursor-auto-runner
docker run --rm -v "$PWD:/work" -w /work ubuntu:24.04 bash packaging/apt/smoke-test.sh
```

Expected output: `smoke-test OK`.

This does **not** replace a real `apt-get install` against Pages; it only validates the shell pipeline.

---

## Step 6 — End-to-end install test (optional, Mac + Docker Ubuntu)

Simulates what Debian/Ubuntu users run:

```bash
docker run --rm -it ubuntu:24.04 bash -lc '
  set -e
  apt-get update -qq
  apt-get install -y -qq curl gnupg ca-certificates
  curl -fsSL https://kurtstevenk.github.io/apt/gpg.key | gpg --dearmor -o /usr/share/keyrings/cursor-auto-runner-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/cursor-auto-runner-archive-keyring.gpg] https://kurtstevenk.github.io/apt stable main" > /etc/apt/sources.list.d/cursor-auto-runner.list
  apt-get update
  apt-cache policy cursor-auto-runner
  apt-get install -y cursor-auto-runner
'
```

Note: the GUI app will not run meaningfully inside the container; success means **apt resolves, downloads, and installs** the package (`dpkg -l cursor-auto-runner`).

---

## Step 7 — If you still have unpushed 1.2.11 app changes on Windows

Local detector/template fixes may not be on `master` yet. APT only ships whatever `.deb` CI builds from the **tagged commit**. When your app changes are pushed, bump [package.json](cursor-auto-runner/package.json), update [CHANGELOG.md](cursor-auto-runner/CHANGELOG.md) / [landing/index.html](cursor-auto-runner/landing/index.html) versions if needed, then:

```bash
git tag v1.2.12
git push origin v1.2.12
```

CI will append the new `.deb` to the APT pool and refresh signatures.

---

## Quick reference: user install (share in docs)

Documented in [packaging/apt/README.md](cursor-auto-runner/packaging/apt/README.md):

```bash
curl -fsSL https://kurtstevenk.github.io/apt/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/cursor-auto-runner-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/cursor-auto-runner-archive-keyring.gpg] https://kurtstevenk.github.io/apt stable main" | sudo tee /etc/apt/sources.list.d/cursor-auto-runner.list
sudo apt-get update
sudo apt-get install cursor-auto-runner
```

---

## Checklist

| Step | Action |
|------|--------|
| 1 | GPG key in `~/.gnupg-apt-cursor-auto-runner`, export `apt-signing-private.asc` |
| 2 | `gh secret set APT_GPG_PRIVATE_KEY` on `cursor-auto-runner` |
| 3 | Re-run failed **Build releases** for `v1.2.11` |
| 4 | Enable Pages on `apt` from `gh-pages` |
| 5 | `curl` InRelease + optional Docker smoke / install test |

No edits to the attached plan file or to application code are required unless CI reveals a new error after the secret is set.

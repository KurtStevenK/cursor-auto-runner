# APT repository (`KurtStevenK/apt`)

Never commit `apt-signing-private.asc` or other private keys — see [SECURITY.md](../../SECURITY.md) and [`.gitignore`](../../.gitignore).

Debian and Ubuntu users install with `apt-get install cursor-auto-runner` after adding this signed repository (hosted on GitHub Pages at https://kurtstevenk.github.io/apt/).

## One-time setup (maintainer)

1. Public repository **`KurtStevenK/apt`** (created on GitHub).
2. After the first tagged release publishes `gh-pages`, enable **Settings → Pages** → **Deploy from a branch** → **`gh-pages`** → `/` (root). CI adds `.nojekyll` so `dists/` is served correctly.
   - **Verify** (after Pages deploy finishes, often 1–2 minutes):

     ```bash
     curl -fsSL https://kurtstevenk.github.io/apt/gpg.key | head -n 1
     # expected: -----BEGIN PGP PUBLIC KEY BLOCK-----
     ```

   - If the URL returns 404/500, Pages is not enabled on `gh-pages` or the first publish has not run yet.
3. Generate a dedicated GPG key for APT signing (no passphrase is easiest for CI):

   ```bash
   gpg --full-generate-key
   # kind: RSA, 4096, email: kurt.steven.kainzmayer@gmail.com, name: Cursor Auto Runner APT
   gpg --armor --export YOUR_KEY_ID > gpg.key   # optional local copy; CI writes gpg.key into the repo
   gpg --armor --export-secret-keys YOUR_KEY_ID > apt-signing-private.asc
   ```

4. In **`cursor-auto-runner`** repo → Settings → Secrets → Actions:
   - **`APT_GPG_PRIVATE_KEY`**: contents of `apt-signing-private.asc`
   - **`APT_GPG_PASSPHRASE`**: only if the key has a passphrase
   - **`TAP_TOKEN`**: existing PAT with `repo` scope (push access to `KurtStevenK/apt`)

5. Push a tagged release (`v*`). The `release` job in `.github/workflows/build.yml` clones `KurtStevenK/apt`, checks out the existing **`gh-pages`** branch when present, runs `publish.sh`, and pushes updates. Packages larger than GitHub's 100 MB file limit are stored with Git LFS. Pages is deployed by the workflow in `KurtStevenK/apt` so those files are the real `.deb`, not an LFS pointer.

## User install (Debian / Ubuntu, amd64)

```bash
curl -fsSL https://kurtstevenk.github.io/apt/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/cursor-auto-runner-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/cursor-auto-runner-archive-keyring.gpg] https://kurtstevenk.github.io/apt stable main" | sudo tee /etc/apt/sources.list.d/cursor-auto-runner.list
sudo apt-get update
sudo apt-get install cursor-auto-runner
```

Upgrades: `sudo apt-get upgrade` after a new release is published.

## Local republish (debug)

```bash
export APT_GPG_PRIVATE_KEY="$(cat apt-signing-private.asc)"
# export APT_GPG_PASSPHRASE=...   # if needed
bash packaging/apt/publish.sh /path/to/apt-repo-clone cursor-auto-runner_1.2.11_amd64.deb
```

## Key rotation

1. Generate a new key pair and update `APT_GPG_PRIVATE_KEY`.
2. Run a tagged release (or manual `publish.sh`) so `gpg.key` and signatures are refreshed.
3. Users who already installed only need `apt-get update` after the new `gpg.key` is on Pages (they may need to re-fetch the keyring if the key id changes).

## Compatibility

Packages are built on `ubuntu-latest` in CI (amd64). Very old Debian/Ubuntu releases may not satisfy the bundled Electron/glibc baseline; use the AppImage from GitHub Releases if needed.

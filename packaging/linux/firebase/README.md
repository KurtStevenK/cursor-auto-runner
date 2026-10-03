# Linux binaries on Firebase Storage

Linux AppImage, `.deb`, and `.pacman` are **published to Firebase Storage**, not attached to the GitHub Release. Those packages are larger than GitHub's 100 MB limit for files stored in a git repository. Storage is the download source for [GitHub Pages](https://kurtstevenk.github.io/cursor-auto-runner/).

- **`linux/<version>/`** — Linux AppImage, `.deb`, `.pacman`. This is the public download path.
- **`releases/<version>/`** — Windows and macOS installers, plus a copy of the Linux packages.

**Public site:** [https://cursor-auto-runner-linux.web.app](https://cursor-auto-runner-linux.web.app) (Firebase Hosting, built from `firebase-landing/`).

## One-time setup

1. **Create a Firebase project** (separate from app data — releases only):
   ```bash
   firebase login
   firebase projects:create cursor-auto-runner-linux --display-name "Cursor Auto Runner Linux"
   ```
   Or use [Firebase Console](https://console.firebase.google.com/) → Add project.

2. **Enable Storage** in that project (Console → Build → Storage → Get started).

3. **Link the repo** (copy example config):
   ```bash
   cp .firebaserc.example .firebaserc
   # edit .firebaserc → set default project id
   firebase deploy --only storage   # publishes storage.rules (public read for linux/*)
   ```

4. **Service account for CI** (Google Cloud → IAM → Service accounts):
   - Create key JSON with roles: **Storage Object Admin** on the default bucket.
   - GitHub → `cursor-auto-runner` → Settings → Secrets → Actions:
     - **`FIREBASE_SERVICE_ACCOUNT_LINUX`**: full JSON key contents
     - **`FIREBASE_STORAGE_BUCKET`**: e.g. `cursor-auto-runner-linux.firebasestorage.app` (Console → Storage → bucket name)
   - For **GitHub Actions Hosting deploy** (`.github/workflows/firebase-landing.yml`), either:
     - **`FIREBASE_TOKEN`**: `firebase login:ci` (recommended), or
     - Grant the same service account **Firebase Hosting Admin** (Storage-only keys cannot deploy Hosting).

5. **gcloud** (optional, same Google account):
   ```bash
   gcloud auth login
   gcloud config set project cursor-auto-runner-linux
   ```

## CI

On tagged releases, the **release** job uploads when `FIREBASE_SERVICE_ACCOUNT_LINUX` and `FIREBASE_STORAGE_BUCKET` are set:

1. `scripts/upload-linux-firebase.sh` → `linux/<version>/`
2. `scripts/mirror-release-firebase.sh` → `releases/<version>/` (all installer assets from CI artifacts)

Manual backfill for an old tag (downloads from GitHub):

```bash
export FIREBASE_STORAGE_BUCKET=cursor-auto-runner-linux.firebasestorage.app
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
bash scripts/mirror-release-firebase.sh 1.2.39
```

## Manual upload (local)

```bash
VERSION=1.2.28
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export FIREBASE_STORAGE_BUCKET=cursor-auto-runner-linux.firebasestorage.app
bash scripts/upload-linux-firebase.sh "$VERSION" release/
```

## Public download URL

After upload, files are available at:

`https://firebasestorage.googleapis.com/v0/b/BUCKET/o/linux%2FVERSION%2FFILENAME?alt=media`

GitHub Pages uses these URLs for the Linux AppImage, `.deb`, and `.pacman` buttons.

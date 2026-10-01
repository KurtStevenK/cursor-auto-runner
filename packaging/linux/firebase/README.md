# Linux binaries on Firebase Storage (optional mirror)

Large Linux artifacts (AppImage, `.deb`, `.pacman`) can be mirrored to **Firebase Storage** with **public read** under `linux/<version>/`. GitHub Releases remain the primary source; Firebase is an extra CDN-style mirror for Linux only.

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

On tagged releases, the **release** job uploads Linux artifacts from `artifacts/linux/` when `FIREBASE_SERVICE_ACCOUNT_LINUX` is set.

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

Use these on the landing page as optional Linux mirrors alongside GitHub Releases.

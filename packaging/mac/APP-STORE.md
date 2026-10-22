# Mac App Store / TestFlight — F1nn

The Mac App Store build ships under the app's new name **F1nn** ("Finn" was taken on the store;
same style as Beaut1fy), bundle ID `xyz.kainzmayer.finn`, team `XPPUZJDN56`, App Store Connect app
[6825765989](https://appstoreconnect.apple.com/apps/6825765989/distribution/info). Config: [`build/finn.config.js`](../../build/finn.config.js), script:
[`scripts/finn-dist.sh`](../../scripts/finn-dist.sh), output: `release/finn/`.

Direct download (DMG / Homebrew) keeps using **Developer ID Application** + notarization (see
[README.md](README.md)). Do not replace that pipeline.

## Builds

| Command | Result |
|---------|--------|
| `npm run dist:finn:dmg` | `release/finn/F1nn-<version>-arm64.dmg`, Developer ID signed; notarized when `ASC_KEY_ID` + `ASC_ISSUER_ID` (or `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD`) are set |
| `npm run dist:finn:mas` | `release/finn/F1nn-<version>-<build>-AppStore.pkg` for TestFlight / App Store |
| `bash scripts/finn-dist.sh testflight` | Upload the last `mas` build through the Apple account signed in to Xcode (`xcodebuild -exportArchive`, destination upload) |
| `bash scripts/finn-dist.sh upload <pkg>` | Upload with the App Store Connect API key (`ASC_KEY_ID`, `ASC_ISSUER_ID`, key in `~/.private_keys/AuthKey_<id>.p8`) |

`FINN_BUILD` sets `CFBundleVersion` (default: a `YYYYMMDDHHMM` timestamp, so every upload is higher).

### How the store package is signed

Same approach as FeatherShot (`FeatherShot/packaging/mac/build_appstore.sh`):

1. electron-builder (`--mac mas`) signs the sandboxed app with **Apple Distribution** and the
   entitlements in `build/entitlements.mas*.plist`. There is no Mac Installer certificate in the
   keychain, so electron-builder stops before building its own `.pkg`; that is expected.
2. The script wraps the app in an `.xcarchive` and runs `xcodebuild -exportArchive` with automatic
   signing. Xcode creates/embeds the **Mac Team Store** provisioning profile and signs the package
   with the **3rd Party Mac Developer Installer** identity.

### Entitlements

- `entitlements.mas.plist` (main app): App Sandbox, app group `XPPUZJDN56.xyz.kainzmayer.finn`
  (Electron's MAS build needs it for Mach port rendezvous; without it the app crashes at launch),
  JIT.
- `entitlements.mas.inherit.plist` (Electron helpers): sandbox inherit.
- `entitlements.mas.loginhelper.plist` (login item helper): its own sandbox, since launchd starts it.

### Updates

App Review guideline 2.4.5: only the store updates a store app. Electron sets `process.mas` in
MAS builds; `isMasBuild` in `src/main/updates.ts` hides the update menu items and skips all
GitHub / electron-updater checks.

## Local sandbox test

`--mac mas-dev` builds a sandboxed app signed with Apple Development. Without a Mac development
provisioning profile, macOS refuses to launch it (error 163) because osx-sign adds
`com.apple.application-identifier`. For a quick local test, re-sign only the top bundle with
sandbox + JIT + an app group under the signing certificate's team prefix that Electron reports
in its rendezvous error.

## After upload

1. Wait for **Processing** in App Store Connect → F1nn → TestFlight → macOS.
2. Export compliance: `ITSAppUsesNonExemptEncryption` is false.
3. Add the build to an internal testing group.
4. Use manual release until the listing (screenshots, privacy URL, review notes explaining Screen
   Recording + Accessibility, demo video) is ready.

## Open points

- The in-app texts still say "Cursor Auto Runner"; the full rename and "click any button you
  capture" come next.
- arm64 only for now (native modules); a universal build needs x64 prebuilds of `better-sqlite3`
  and libnut.
- App Review risk: Accessibility-driven clicks into other apps (guideline 2.4.5 / 4.x) must be
  explained in the review notes.

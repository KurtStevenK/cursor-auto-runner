# Mac App Store (planned)

Direct download (DMG / Homebrew) uses **Developer ID Application** + notarization (see [README.md](README.md)).

The Mac App Store uses:

- **Apple Distribution** certificate (already in your keychain)
- App Store Connect app record + sandbox entitlements
- electron-builder `mas` / `mas-dev` targets (not wired in CI yet)
- Review guidelines (accessibility / screen recording usage must be justified)

When you are ready, add a separate CI job and do not replace the Developer ID DMG pipeline — most users will install from GitHub/Homebrew until the Store listing is live.

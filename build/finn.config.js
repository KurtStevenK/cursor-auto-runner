/**
 * electron-builder config for Finn, the macOS build of this app under its new name.
 * Extends the `build` block in package.json. Targets:
 *   --mac dmg      Developer ID DMG (scripts/finn-dist.sh dmg)
 *   --mac mas      Mac App Store (scripts/finn-dist.sh mas)
 *   --mac mas-dev  sandboxed local test build signed with Apple Development
 */
const base = require('../package.json').build;

const usage = {
  NSScreenCaptureUsageDescription:
    'Finn looks at the screen to find the buttons you taught it to click.',
  NSAccessibilityUsageDescription: 'Finn needs accessibility access to click those buttons for you.',
  ITSAppUsesNonExemptEncryption: false,
};

module.exports = {
  ...base,
  appId: 'xyz.kainzmayer.finn',
  productName: 'Finn',
  extraMetadata: { productName: 'Finn' },
  directories: { output: 'release/finn' },
  mac: {
    ...base.mac,
    target: [{ target: 'dmg', arch: ['arm64'] }],
    extendInfo: usage,
  },
  dmg: { artifactName: 'Finn-${version}-${arch}.${ext}' },
  mas: {
    hardenedRuntime: false,
    entitlements: 'build/entitlements.mas.plist',
    entitlementsInherit: 'build/entitlements.mas.inherit.plist',
    // launchd starts the login helper on its own, so it gets its own sandbox instead of inherit.
    entitlementsLoginHelper: 'build/entitlements.mas.loginhelper.plist',
    extendInfo: usage,
  },
  masDev: {
    hardenedRuntime: false,
    entitlements: 'build/entitlements.mas.plist',
    entitlementsInherit: 'build/entitlements.mas.inherit.plist',
    extendInfo: usage,
  },
  publish: null,
};

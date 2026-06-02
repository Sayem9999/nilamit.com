# Mobile, PWA & Android APK

Nilamit ships as an **installable PWA** (the cross-platform app for Android, iOS,
and desktop) and can be wrapped into a signed **Android APK/AAB** via a Trusted
Web Activity (TWA).

## PWA (already wired)

| Piece | Location |
|---|---|
| Web App Manifest | `public/manifest.json` |
| Service worker (offline + installability) | `public/sw.js` |
| SW registration | `src/components/pwa/PWARegister.tsx` (mounted in `app/layout.tsx`, prod only) |
| Icons (192 / 512 maskable) | `public/icon-192.png`, `public/icon-512.png` |
| Viewport / theme / apple meta | `app/layout.tsx` (`viewport`, `appleWebApp`) |
| Install / APK UI | `src/components/install/InstallAppButton.tsx` (on `/browse`) |

- **Android / desktop Chrome:** real install via the `beforeinstallprompt` flow.
- **iOS Safari:** Add to Home Screen (Apple gives no programmatic install).
- The FCM push SW is registered at `/firebase-cloud-messaging-push-scope/` so it
  never collides with the PWA SW at `/`.

## Build the Android APK (TWA via Bubblewrap)

> Requires the Android toolchain — **JDK 17, Android SDK/build-tools, and a
> signing keystore.** This is why the binary is not produced in CI-less sandboxes.

```bash
# 1. One-time: install Bubblewrap
npm i -g @bubblewrap/cli

# 2. Initialise from the live web manifest (config already in twa-manifest.json)
bubblewrap init --manifest https://www.nilamit.com/manifest.json

# 3. Build (prompts to create/sign with a keystore on first run)
bubblewrap build
#   → produces app-release-signed.apk  and  app-release-bundle.aab

# 4. Publish the APK for in-app download
mkdir -p public/downloads
cp app-release-signed.apk public/downloads/nilamit.apk
git add public/downloads/nilamit.apk && git commit -m "chore: ship Android APK" && git push
```

The `/browse` "Download Android APK" button serves `public/downloads/nilamit.apk`.

### Digital Asset Links (removes the browser URL bar in the TWA)

`bubblewrap` prints a SHA-256 fingerprint. Publish it at
`public/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.nilamit.twa",
    "sha256_cert_fingerprints": ["<FINGERPRINT_FROM_BUBBLEWRAP>"]
  }
}]
```

### Alternative: PWABuilder (no local Android SDK)

1. Go to https://www.pwabuilder.com and enter `https://www.nilamit.com`.
2. Package for Android → download the signed APK/AAB.
3. Drop the APK at `public/downloads/nilamit.apk` (step 4 above).

## Play Store

Upload the `.aab` (not the APK) to the Play Console. Keep `appVersionCode` in
`twa-manifest.json` monotonically increasing per release.

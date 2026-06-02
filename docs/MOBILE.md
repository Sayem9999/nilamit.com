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

## Automated APK build (GitHub Actions)

`.github/workflows/android-apk.yml` builds + signs the APK and publishes it to
`public/downloads/nilamit.apk` (served by the in-app download button), plus a
workflow artifact and an optional GitHub Release. It uses
`android-actions/setup-android` + JDK 17 + Bubblewrap, driven by the committed
`twa-manifest.json`.

**Triggers:** manual (`workflow_dispatch`, optional “create Release” input) or
pushing a `v*` tag.

### One-time setup — create a stable keystore + secrets

> The keystore must be reused on every build — re-signing with a new key breaks
> updates for anyone who already installed a previous APK.

```bash
# 1. Generate the signing keystore (alias must match twa-manifest.json → "nilamit")
keytool -genkeypair -v -keystore android.keystore -alias nilamit \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "<STORE_PASS>" -keypass "<KEY_PASS>" \
  -dname "CN=Nilamit, O=Nilamit, C=BD"

# 2. Base64-encode it for the secret
base64 -w0 android.keystore   # macOS: base64 -i android.keystore
```

Add these **repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | output of the base64 command above |
| `ANDROID_KEYSTORE_PASSWORD` | `<STORE_PASS>` |
| `ANDROID_KEY_PASSWORD` | `<KEY_PASS>` |
| `ANDROID_KEY_ALIAS` | `nilamit` (optional; default) |

Then run **Actions → Build Android APK → Run workflow**. The job commits the
signed `nilamit.apk`, which triggers an App Hosting deploy → the download button
goes live. Keep `android.keystore` itself out of git (it already matches `*.pem`
/ ignore patterns — never commit the raw keystore).

> Note: Bubblewrap's CLI prompts are version-sensitive; the workflow feeds
> passwords on stdin and skips PWA re-validation. If a future Bubblewrap release
> changes prompt order, adjust the `printf` in the "Build & sign APK" step.

## Play Store

Upload the `.aab` (not the APK) to the Play Console. Keep `appVersionCode` in
`twa-manifest.json` monotonically increasing per release. For Play, also publish
the Digital Asset Links fingerprint (above) and prefer `bubblewrap build` locally
to capture the `.aab`.

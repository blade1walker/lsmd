# Nexus EMS - Android Application (Phones & Tablets)

This directory contains the full-fledged native Android application for the Nexus EMS system, designed specifically for **Android mobile devices, foldables, and tablets**.

---

## 🚀 Key Features & How It Works

### 1. Instant Live Sync (Zero-Delay Web-to-App Updates)
* **Automatic Live Updates:** When you push updates to your website repository and deploy to production (https://lsmd.tech), **all mobile and tablet users automatically see the new features, UI, and data immediately inside the installed Android application**.
* You do **not** need to submit a new app update to the Google Play Store every time you fix a bug, update forms, adjust rosters, or add new features on the website.

### 2. Full-Fledged Native Android Application
Unlike a simple browser bookmark, this is an authentic Android application:
* **Package:** `com.nexus.ems`
* **Target SDK:** Android 14 (API 34) — fully compliant with Google Play Store 2024–2026 requirements.
* **Min SDK:** Android 7.0 (API 24) — compatible with >98% of active Android devices.
* **Hardware Back Button Navigation:** Handles history navigation smoothly inside the app without abruptly closing. Double-tap back prompts to exit.
* **File Upload / Chooser:** Supports uploading PDF documents, medical scans, and profile photos directly from the Android camera and gallery.
* **Native JavaScript Bridge (`window.NexusAndroid`):**
  - `NexusAndroid.isNativeApp()` — returns `true`
  - `NexusAndroid.isTablet()` — detects tablet form-factor
  - `NexusAndroid.getAppVersion()` — returns native version string
  - `NexusAndroid.vibrate(ms)` — triggers haptic feedback
  - `NexusAndroid.showToast(msg)` — displays native Android toast
* **Pull-to-Refresh:** Native `SwipeRefreshLayout` styled in Nexus Red (`#dc2626`).
* **Offline Fallback:** If internet connectivity drops, gracefully serves bundled local `offline.html` and offers a one-tap reconnect retry.

### 3. Adaptive Tablet & Mobile Layouts
* Supports phones and tablets (`sw600dp` resource qualifiers, landscape and portrait orientation).
* High-resolution adaptive launcher icons and immersive dark theme matching `#0a0a0f`.

---

## 📦 Automated GitHub Actions CI/CD Pipeline

Every time you push commits to `main` on GitHub, `.github/workflows/android-build.yml` automatically triggers and builds:
1. **`nexus-ems-debug.apk`** — Install directly on any Android phone or tablet for testing.
2. **`nexus-ems-release.apk`** — Optimized standalone release APK.
3. **`nexus-ems-playstore.aab`** — Official Android App Bundle (AAB) ready to upload to the Google Play Console.

The builds are uploaded as workflow artifacts and automatically published to the **GitHub Releases** page under `android-latest`.

---

## 🛠 Local Build Instructions

### Prerequisites
* JDK 17
* Android Studio (Koala / Iguana or later) or Android SDK Platform 34

### Building via Command Line
```bash
# Build Debug APK (installs immediately on phone/tablet)
npm run android:apk
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Build Release APK
npm run android:build
# Output: android/app/build/outputs/apk/release/app-release-unsigned.apk

# Build Google Play Store Bundle (.aab)
npm run android:bundle
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### Opening in Android Studio
1. Open Android Studio.
2. Select **Open an existing project** and navigate to `lsmd/android`.
3. Allow Gradle to sync dependencies.
4. Select your connected Android phone, tablet, or emulator and click **Run (Shift + F10)**.

---

## 🌐 Configuring the Production Server URL

The default server URL points to your deployed website:
* **Configuration File:** `android/app/src/main/res/values/strings.xml`
```xml
<string name="server_url">https://your-custom-domain.com</string>
```
Or in `capacitor.config.ts`:
```ts
server: {
  url: 'https://your-custom-domain.com',
}
```
Whenever this URL receives changes, your Android application updates in real time for all users.

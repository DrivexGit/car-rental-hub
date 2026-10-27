# Drivex for Android

The Drivex customer app for Android. It is a native Kotlin app that shows the Drivex site
(`https://drivex-customer.vercel.app`) in a WebView. It also handles the things a browser tab cannot do well:

| On the site | In the app |
|---|---|
| WhatsApp, call and email links, maps | Open the WhatsApp, Phone, Mail or Maps app |
| Links to other sites | Open in a Chrome Custom Tab over the app, so the customer comes back to Drivex |
| Stripe / Ziina checkout | Stays inside the app, so the payment returns to the booking |
| Download invoice (PDF made in the page, or the uploaded PDF) | Saved to **Downloads**, then opened |
| View invoice / document | Opens the file in a Custom Tab |
| Upload a document or profile photo | File picker, with **Take photo** (camera permission is asked only then) |
| Back button | Goes back in the page, and closes the app on the first page |
| No internet / site not loading | Native "No connection" screen with **Try again** (English, Persian, Arabic) |
| Links to the site (from WhatsApp, email) | Open in the app (see *App links*) |

Other details:
- The launch screen is the white Drivex mark on the brand green, and it stays until the first page has drawn, so there is no white flash.
- The page sits between the status bar and the navigation bar. The keyboard pushes the page up, so a field is never hidden.
- The site's own colours are used for the bars.
- The phone's font-size setting does not resize the page (`textZoom = 100`), so the layout stays as designed.
- The sign-in session is kept in the WebView's storage and is excluded from backups and device transfer.
- Only HTTPS is allowed. The debug build also allows the local dev server.
- The page knows it runs in the app from its user agent (`DrivexApp/<version> (Android)`). The site uses this to hide its "Install the app" banner.

## Project

```
app/src/main/java/com/drivex/app/
  MainActivity.kt   WebView, splash, insets, back, file upload, popups, offline screen
  LinkRouter.kt     where each link goes (unit-tested in app/src/test)
  Downloads.kt      saving files to Downloads
app/src/main/assets/bridge.js   hands the page's download links to the app (Drivex origin only)
store/play-icon-512.png         Play Store icon
```

- Kotlin 2.0, Android Gradle Plugin 8.7, Gradle 8.10 (wrapper included).
- minSdk 26 (Android 8), targetSdk 35 (Android 15).
- Dependencies are AndroidX only: core, activity, splashscreen, webkit and browser.
- The page and the app talk through `androidx.webkit` `WebMessageListener`, limited to the Drivex origin. There is no `addJavascriptInterface`.

## Build

You need Android Studio (or JDK 17 and the Android SDK).

```bash
./gradlew testDebugUnitTest      # unit tests
./gradlew assembleDebug          # app/build/outputs/apk/debug/app-debug.apk (id com.drivex.app.debug)
./gradlew bundleRelease          # app/build/outputs/bundle/release/app-release.aab, for Google Play
```

To open another site, for example the local dev server from the emulator, pass `-PdrivexUrl=http://10.0.2.2:9291`.
Only the debug build allows plain `http`.

## Release signing

1. Create an upload key once and keep it safe. Every Play update must be signed with it.
   ```bash
   keytool -genkeypair -v -keystore drivex-upload.jks -alias drivex -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Copy `keystore.properties.example` to `keystore.properties` and fill it in. Neither file is committed.
3. Before each Play release, raise `versionCode` (and `versionName`) in `app/build.gradle.kts`.

## App links

Site links already open in the app when the customer picks Drivex. To open them **without asking**, Android must verify
the site:
1. Get the SHA-256 fingerprint from Play Console › App integrity › App signing.
2. Publish it at `https://drivex-customer.vercel.app/.well-known/assetlinks.json`:
   ```json
   [{ "relation": ["delegate_permission/common.handle_all_urls"],
      "target": { "namespace": "android_app", "package_name": "com.drivex.app",
                  "sha256_cert_fingerprints": ["AA:BB:…"] } }]
   ```
If the site moves to its own domain, change the host in `AndroidManifest.xml` and the default URL in `app/build.gradle.kts`.

## Not in this version

- **Push notifications.** Web push does not work inside a WebView. Native notifications need Firebase Cloud Messaging:
  a Firebase project (`google-services.json`), and the server would send to FCM tokens next to the current web-push
  subscriptions.
- **Google Pay in Stripe Checkout.** Cards work. Google Pay inside a WebView needs Stripe's native SDK.

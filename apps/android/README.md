# Drivex for Android

The Drivex customer app for Android, written natively in **Kotlin and Jetpack Compose**. It is not a web view: every
screen of the customer site (`apps/customer`) is rebuilt as a native screen, with the same layout, colours, texts and
rules. It talks to the same backend as the site: Supabase (same tables, same row-level security, same anon key) and the
site's `/api` functions (sign-in code, booking, payment, extension, chat, documents). Version 2.0.0 replaces the 1.x app
(the site in a web view): same app id and signing key, so it installs over it.

| Site page | Android screen |
|---|---|
| Sign in (phone, code, name) | `LoginScreen` |
| Home | `HomeScreen`: greeting, banners that slide by themselves, booked cars, pending invoice, offers, DriveX Community codes |
| Book | `BookScreen`: daily / weekly / monthly, search, sort, filters, rental dates (hides booked cars), offers only |
| Car page (step 1 of 3) | `ReserveScreen`: photos with a full-screen album, specs, plan, pickup date, extras, deposit, document / email checks |
| Review & pay, Confirmed | `CheckoutScreen`, `ConfirmedScreen` |
| Bookings, booking details | `BookingsScreen`, `BookingDetailScreen`: days left, extend, invoices, Salik & fines, Mulkiya, insurance, help |
| Notifications | `InboxScreen` (live: a new notification reloads the data, as on the site) |
| Support | `SupportScreen`: Drivex AI chat, urgent call, WhatsApp |
| Profile and its pages | `ProfileScreens.kt`: edit with photo (camera or gallery), payments, documents (camera, photos, files; viewing needs the WhatsApp code), security, notifications, language, appearance, legal, other |
| Terms, privacy, delete account | `LegalScreens.kt` (open without signing in too) |

Also as on the site: the animated splash, the three onboarding slides, green and navy themes, English / Arabic /
Persian with right-to-left layout, UAE dates (Dubai time, the Persian calendar in Persian) and the dirham sign.
The Android back button goes back a page, then to the Home tab, then closes the app.

### How a few things work

- **Payment.** Stripe Checkout opens inside the app. When Stripe sends the customer back to the site (`…?payment=<id>`),
  the app catches that address, closes the page and confirms the payment with `api/pay` (`confirm`), exactly what the
  site's return page does. Cards work; Google Pay would need Stripe's own Android SDK.
- **Invoices.** The tax invoice is the same document as the site's (`data/InvoiceDocument.kt` is a port of
  `src/lib/invoice.ts`; keep them in step). *Download* makes an A4 PDF, saves it to **Downloads** and opens it.
  An invoice staff uploaded as a PDF is saved and opened as that file.
- **Texts.** The Arabic and Persian words and the legal pages are the site's own: `scripts/sync-content.mjs` copies them
  to `app/src/main/assets/content`. Run it after changing them on the site. `app-strings.json` holds the few texts only
  the phone app has.
- **Prices** (`data/Pricing.kt`) are a copy of `src/data/pricing.ts`; the server still decides the real price.
- **Data** (`data/AppStore.kt`) runs the same queries as `src/lib/store.tsx`. The session is kept in the app's private
  storage (excluded from backups) and refreshed before it runs out.

## Project

```
app/src/main/java/com/drivex/app/
  core/      config, translations, colours and type, dates and money, the Supabase client (REST, storage, realtime), files
  data/      the store, models, prices, fleet, invoice document
  ui/        the site's components, navigation (tabs and pages), calendar, splash and onboarding
  screens/   one file per page or group of pages
app/src/main/assets/content/   translations and legal texts from the site
app/src/test/                  RulesTest (prices, UAE dates, fleet, links, invoice maths), ScreensTest (screen pictures)
scripts/sync-content.mjs       copies translations and legal texts from the site
```

- Kotlin 2.0, Compose (BOM 2024.12), Android Gradle Plugin 8.7, minSdk 26 (Android 8), targetSdk 35.
- Libraries: AndroidX (Compose, activity, splashscreen, lifecycle, exifinterface), OkHttp, kotlinx.serialization (JSON
  tree only), Coil (pictures). No Supabase SDK: the REST API is called directly, which keeps the app small.

## Build

You need Android Studio (or JDK 17 and the Android SDK).

1. `cp secrets.properties.example secrets.properties` and fill in the Supabase URL and anon key (the site's
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`). Not committed.
2. Then:

```bash
./gradlew testDebugUnitTest                      # unit tests
./gradlew testDebugUnitTest -Pscreens            # also draws every screen to app/build/screens (no phone needed)
./gradlew assembleRelease                        # app/build/outputs/apk/release/Drivex-2.0.0.apk (signed with keystore.properties)
./gradlew bundleRelease                          # .aab for Google Play
```

## Release signing

The upload key is `drivex-upload.jks` with `keystore.properties` (neither is committed; see `keystore.properties.example`).
Every Play update must be signed with it. Raise `versionCode` / `versionName` in `app/build.gradle.kts` for each release.

## App links

Site links already open in the app when the customer picks Drivex. To open them **without asking**, publish the signing
key's SHA-256 fingerprint at `https://drivex-customer.vercel.app/.well-known/assetlinks.json`:

```json
[{ "relation": ["delegate_permission/common.handle_all_urls"],
   "target": { "namespace": "android_app", "package_name": "com.drivex.app",
               "sha256_cert_fingerprints": ["AA:BB:…"] } }]
```

## Not in this version

- **Push notifications.** The site sends web push; the Android app needs Firebase Cloud Messaging (a Firebase project
  with `google-services.json`, and the server sending to device tokens). Until then notifications appear in the app
  (live while it is open, and on every open).

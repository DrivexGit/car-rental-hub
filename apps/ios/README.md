# Drivex for iPhone

The Drivex customer app for iPhone, written natively in **Swift and SwiftUI**. It is not a web view: every screen of the
customer site (`apps/customer`) is rebuilt as a native screen, with the same layout, colours, texts and rules. It talks to
the same backend as the site: Supabase (same tables, same row-level security, same anon key) and the site's `/api`
functions (sign-in code, booking, payment, extension, chat, documents).

| Site page | iPhone screen |
|---|---|
| Sign in (phone, code, name) | `LoginView`: UAE number, 6-digit code with the iPhone code suggestion, name once |
| Home | `HomeView`: greeting, banners that slide by themselves, booked cars, pending invoice, offers, DriveX Community codes |
| Book | `BookView`: daily / weekly / monthly, search, sort, filters, rental dates (hides booked cars), offers only |
| Car page (step 1 of 3) | `ReserveView`: photos with a full-screen album, specs, plan, pickup date, extras, deposit, missing documents / email checks |
| Review & pay (step 2 of 3) | `CheckoutView`: summary, price with VAT, terms, payment |
| Confirmed (step 3 of 3) | `ConfirmedView` |
| Bookings, booking details | `BookingsView`, `BookingDetailView`: status, days left, extend, invoices, Salik & fines, Mulkiya, insurance, help |
| Notifications | `InboxView`: live (a new notification reloads the data, as on the site) |
| Support | `SupportView`: Drivex AI chat, urgent call, WhatsApp |
| Profile and its pages | `ProfileView`, `ProfilePages.swift`: edit with photo, payments, documents (camera, photos, files; viewing needs the WhatsApp code), security, notifications, language, appearance, legal, other |
| Terms, privacy, delete account | `LegalPages.swift` (open without signing in too) |

Also as on the site: the animated splash, the three onboarding slides, the green and navy themes, English / Arabic / Persian
with right-to-left layout, UAE dates (Dubai time) and the dirham sign.

### How a few things work on iPhone

- **Payment.** Stripe Checkout opens inside the app (cards and Apple Pay). When Stripe sends the customer back to the site
  (`…?payment=<id>`), the app catches that address, closes the page and confirms the payment with `api/pay` (`confirm`),
  exactly what the site does on its return page. Nothing is injected into the Stripe page.
- **Invoices.** The tax invoice is the same document as the site's (`Data/InvoiceDocument.swift` is a port of
  `src/lib/invoice.ts`; keep them in step). *Download* makes an A4 PDF and opens the share sheet (Save to Files, WhatsApp,
  Mail…). An invoice staff uploaded as a PDF is shown and saved as that file.
- **Texts.** The Arabic and Persian words are the site's own dictionaries, and the legal pages are the site's texts:
  `scripts/sync-content.mjs` copies them into `Drivex/Resources/Content`. Run it after changing them on the site.
  `ios-strings.json` holds the few texts only the iPhone app has.
- **Prices** (`Data/Pricing.swift`) are a copy of `src/data/pricing.ts`; the server still decides the real price.

## Project

```
project.yml                 Xcode project definition (XcodeGen); Drivex.xcodeproj is generated, not committed
Config/App.xcconfig          site URL; includes Config/Secrets.xcconfig (Supabase URL + anon key, team id; not committed)
Drivex/App                   app entry, tabs and routes, splash and onboarding
Drivex/Core                  config, translations, colours, formatting, the Supabase client and the /api caller
Drivex/Data                  the store (same queries as src/lib/store.tsx), models, prices, invoice document
Drivex/UI                    the site's components: buttons, cards, chips, sheets, lists, calendar
Drivex/Screens               one file per page
Drivex/Resources             images, app icon, translations and legal texts
DrivexTests                  unit tests: prices, UAE dates, fleet grouping, notification links, invoice maths
scripts/sync-content.mjs     copies translations and legal texts from the site
```

- iOS 17 or later, iPhone. Swift 5, SwiftUI with Observation.
- One dependency: [supabase-swift](https://github.com/supabase/supabase-swift) (Swift Package Manager). The session is kept
  in the Keychain.

## Build

You need a Mac with Xcode 16.3 or later and [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`).

1. `cp Config/Secrets.example.xcconfig Config/Secrets.xcconfig` and fill in the Supabase URL and anon key (the site's
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) and your Apple team id.
2. `xcodegen generate`, then open `Drivex.xcodeproj` and run on a simulator or an iPhone.

Without a Mac, the GitHub workflow `.github/workflows/ios.yml` builds the app and runs the tests on a macOS runner for every
push that changes `apps/ios`.

## Release (App Store)

1. An Apple Developer account (99 USD a year), with the app id `com.drivex.app` and the team id in `Secrets.xcconfig`.
2. Raise `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in `project.yml` for each upload.
3. Xcode › Product › Archive › Distribute App › App Store Connect, then TestFlight for testing.
4. App Store Connect needs: screenshots, the privacy policy link (`/privacy` on the site), the account deletion link
   (`/delete-account`) and a test phone number with a fixed code for Apple's review (the server's `OTP_TEST_CODE`).

## Not in this version

- **Push notifications.** The site sends web push; the iPhone app needs Apple push (APNs): an APNs key from the Apple
  Developer account, and the server sending to device tokens next to the web-push subscriptions. Until then notifications
  appear in the app (live while it is open, and on every open).
- **Universal links** (site links opening the app) need an `apple-app-site-association` file on the site and the
  Associated Domains capability.

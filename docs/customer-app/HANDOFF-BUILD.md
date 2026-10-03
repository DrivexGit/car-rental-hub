# Handoff: Build the DriveX customer mobile app

Work in `~/Desktop/projects/zakeri/drivex` (repo `car-rental-hub`). Reply to Hossein in **Persian**; write code, comments and commits in English.

## Status (2026-10-03) — NEW DIRECTION FROM ZAKERI
Zakeri designed **5 master screens** and sent them to Kamyar for approval:
`references/zakeri-v2-five-screens.jpg` — **Home · Book · Support · Bookings (labelled "FAQ" in the image, it is the bookings list) · Profile**.

His voice note to Kamyar (summary, this is the brief):
- **Minimalism and simplification over everything.** "We won't sit and perfect every detail of every page now. Approve, and we develop — with the same minimal, simple view, not a pile of pages."
- **Support = AI.** The Support screen is an AI chat ("How can we help?", Drivex AI assistant) with quick chips (*Extend my rental*, *Payment help*, *Urgent call*) and a WhatsApp button.
  - **No 3-call counter, no emergency-number list, no warnings on screen.** Nothing extra that confuses people.
  - Urgent call: when tapped, we get notified.
  - The AI answers FAQs cleanly, calls the user by name, follows up, and **auto-escalates urgent cases** to staff even if the user doesn't ask.
- **Book screen:** tabs **Daily / Weekly / Monthly**, search by car name, filter, sort, pick rental dates (optional), shows **available** cars, "View & book".
- **Login = mobile number only.** Enter number → code. **First time:** also ask the name. **Returning user:** straight in (we already know them). No 5 login screens.
- **Reservation flow: 2–3 screens max.** User must book fast and reach payment quickly.

### What this changes vs. older docs
- The older rule "UX frozen to Kamyar's Figma" (in `README.md`, `CODEX.md`, `PROMPTS.md`, memory) is **superseded where it conflicts** with the 5 screens + the brief above. Zakeri's 5 screens are now the source of truth for structure and style.
- `ui/01…37` (images made from Kamyar's screens) are now **reference only** for screens Zakeri did not redesign (booking details, invoice, documents, edit profile…). Restyle them to match the 5 masters and simplify — fewer steps, fewer elements.
- Drop: onboarding slides (optional, 1 screen max), email/Google/Meta login, forgot password, the separate FAQ screen (FAQ is answered by the AI), the locked-hotline state, the emergency numbers list.
- Tab bar stays: **Home / Bookings / Support / FAQ / Profile** as in the image. ⚠ The FAQ tab and the bookings list look mixed up in the image — **ask Hossein** which tab shows what before coding the tab bar.

## Read first
`README.md`, `TASKS.md`, `FEATURES.md` (feature list; follow the simplifications above), `references/README.md`, `docs/DATABASE.md`.

## Style (from the 5 masters)
- Deep green `#1f4d2f` primary, warm off-white background, white cards with soft borders.
- Header: Drivex logo left, user photo right. Large bold page title ("Good morning, Emma", "Find your drive", "How can we help?", "My profile").
- Prices in **AED with the dirham symbol** (Ð-style), "/ day", strikethrough old price on offers.
- Status dots: Overdue (red), Ongoing (green), Completed (grey).
- Pale red card for pending invoice + green "Pay now →".
- Big tap targets, large text (users include older people).

## Screens (phase 1 first)
1. **Login:** phone → OTP → (first time) name → Home.
2. **Home:** greeting, offers carousel, pending invoice + Pay now, Your offers (cars with discount), Dining benefits.
3. **Book:** Daily/Weekly/Monthly tabs, rental dates, search, sort, filter, car cards with price + "View & book".
4. **Reservation (2–3 screens):** car + dates + options → summary + payment (Ziina) → confirmation.
5. **Bookings:** list with status, price, pickup/return dates, Invoice, View details → details (car, plate, dates, time left, invoice + pay, insurance, fines/Salik, extend).
6. **Support:** AI chat + chips + WhatsApp + Urgent call.
7. **Profile:** card with name/email/edit; Account (Payments, Security, Documents); Preferences & support (Notifications, Change language, Support & legal, Other); Log out.
- Contract items not designed yet (Mulkiya card, Salik, change car, insurance certificate): put them inside Booking details as simple rows. **Ask Hossein before adding new screens.**

## Build steps
1. **Design system:** Tailwind tokens + shared components (AppShell + TabBar, Header, Card, Button, ListRow, Badge/StatusDot, PriceTag, Chip, EmptyState).
2. **App skeleton:** mobile-first PWA, Vite + React + TS + Tailwind + Supabase client, same family as this repo. **Ask Hossein first:** `apps/customer` in this repo or a separate repo (TASKS §0).
3. **Database migrations (TASKS §2):** `customers` (phone, name; link to `leads`), `invoices`, `payments`, `fines` (type: traffic / salik), documents, `offers`, `support_messages` / `urgent_requests`.
   - RLS: a customer sees only their own rows; staff via `is_active_staff()`.
   - New migration files only; never run against production without Hossein's OK. Update `docs/DATABASE.md`.
4. **Auth:** Supabase phone OTP (or reuse `cafoo` `lib/auth/phone-otp.ts`). First login creates the `customers` row with the name.
5. **Payment:** Ziina payment link; store status in `payments`, mark invoice paid.
6. **AI support:**
   - Vercel AI Gateway, key `AI_GATEWAY_API_KEY` from `.env.local`.
   - Context: FAQ (`faq_entries`) + the user's own bookings, invoices and fines. Address the user by name.
   - Detect urgent cases (accident, breakdown, police, locked out…) → create an urgent request and notify staff (WhatsApp/Telegram channel the dashboard already uses), even if the user doesn't ask.
   - "Urgent call" chip → same escalation + a call button.
   - Unsure → offer WhatsApp.
7. **QA:** 375px, compare with the 5 masters; RLS test with two customers.
8. **Deploy:** Vercel preview, send the link only to Hossein. Domains later (`app.drivex…`); **never touch drivex.ae**.

## Rules
- Simple > complete. If a screen can be removed or merged, do it.
- No new screens or flows outside this brief without asking Hossein.
- Secrets only from `.env.local`; never print or commit them. Don't commit unless asked.
- Tick `TASKS.md` as you go.

## Done when
Phase-1 screens coded in the 5-master style, real Supabase data with RLS verified, phone login, Ziina payment, AI support with urgent escalation, preview link sent, and a Persian report to Hossein: done / left / questions.

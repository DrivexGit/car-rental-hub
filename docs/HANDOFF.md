# DriveX — Handoff (2026-10-05)

Repo: `~/Desktop/projects/zakeri/drivex` → GitHub **DrivexGit/car-rental-hub** (Kamyar owns it; `softkdev` is admin).
Branches: `main` = everything below (panel builds from it). `customer-app` = same commits.
Reply to Hossein in Persian; code, comments and commits in English. No secrets in docs or commits.

## Live
| What | URL | Hosting |
|---|---|---|
| Customer app (PWA) | https://drivex-customer.vercel.app | Kamyar's Vercel, project `drivex-customer` (CLI deploy, not git-linked) |
| Admin panel (CarBox) | https://car-rental-hub-kappa.vercel.app | Kamyar's Vercel, project `car-rental-hub`, git → `main` auto-deploys |
| Old panel | https://carbox.zakeri.dev | Zakeri's Vercel, repo zakeriuae/car-rental-hub — **does not have this work** |
| Database | Supabase `ampdpgwcjgoqbamfttlw` ("Drivex") | |
| n8n | https://drivexai.app.n8n.cloud | Kamyar's n8n Cloud |

## Where the keys are (local only, gitignored)
- `drivex/.env.local` — panel env + `SUPABASE_ACCESS_TOKEN` (Management API: run SQL, read API keys).
- `drivex/apps/customer/.env.local` — everything the app's server functions need (Supabase service role, AI, VAPID, push hook secret, Vercel token, OTP test code). Names listed in `apps/customer/.env.example`.
- `drivex/.env.n8n` — n8n API key `claude-drivex-2` (expires ~2026-11-02).
Never print these; read them with `set -a; . ./.env.local; set +a`.

## Customer app — `apps/customer`
Vite + React + TS + Tailwind + framer-motion + react-day-picker. Built from Zakeri's 5 master screens
(`docs/customer-app/references/zakeri-v2-five-screens.jpg`). Tabs: **Home · Book · Support · Bookings · Profile**.

- Dev: `npm --prefix apps/customer run dev` (port 9191, also serves `/api/*`). Deploy: `apps/customer/deploy.sh`.
- Screens: phone login (name on first visit) → Home (banners, pending invoice + Pay now, car offers, partner benefits, install prompt, push prompt, bell/inbox) → Book (daily/weekly/monthly, date-range calendar, search/sort/filter, availability) → Reserve (specs, plan, pickup calendar, extras) → Checkout → Confirmed → Bookings → Booking detail (time left, invoices + pay, Salik/fines, extend, Mulkiya, insurance, change car) → Support (AI chat, Urgent call, WhatsApp) → Profile (edit, payments, security, documents upload, notification prefs + push, language, legal).
- Server functions `api/`: `auth` (phone sign-in → Supabase session; creates `customers` + `leads`), `book` (server pricing, offer discount, picks a free car, 30-min hold), `pay` (Ziina or test), `extend`, `chat` (AI + live FAQ + customer data; urgent → `urgent_requests` + n8n webhook), `push-hook` (called by DB, sends web push).
- Car images: `public/cars/<make-model>.webp` (generated with gpt-image-2). New model → add an image with the same slug.
- AI: client's OpenAI key (`AI_BASE_URL=api.openai.com`, `gpt-4.1-mini`). **Never use 9Router for DriveX.**

## Admin panel (repo root, `src/`)
New: **Notifications** (realtime feed, sound, toast, urgent requests with WhatsApp/Handled), bell + **Enable alerts** (staff web push, `public/sw.js`), **App customers** (detail sheet), **Invoices** (create, mark paid, void), **Fines & Salik** (optional auto-invoice), **Offers** (car discounts + partner benefits), **Reservation detail** sheet (`?id=`), Total column.
Vehicles are imported (no edit UI by design).

## Database (migrations in `supabase/migrations/2026100*`, all applied to production)
`customers`, `invoices`, `payments`, `fines`, `offers`, `urgent_requests`, `notifications`, `push_subscriptions`, `vehicle_model_specs`, `private.app_config` (push hook URL + secret);
`reservations` + `customer_id, rental_period, extras, total_amount`. Functions: `is_customer()`, `busy_vehicle_ids()`, `notify_events()` triggers, `notifications_push()` (pg_net → `/api/push-hook`).
RLS: customers read only their own rows; staff full access by tenant. Details: `docs/DATABASE.md`.
Apply SQL: POST `https://api.supabase.com/v1/projects/ampdpgwcjgoqbamfttlw/database/query` with `SUPABASE_ACCESS_TOKEN`.

## Tested (2026-10-03/04, on production data, then cleaned up)
Login (wrong code, bad phone, new vs returning), booking price/discount/extras, overbooking (409), invalid inputs, pay + double pay, extend, unauthenticated calls, RLS between two customers (read, update phone, fake invoice, pay/extend others), private document upload, urgent → DB + n8n, booking/payment/invoice/fine notifications + push hook, panel pages in Chrome.
Real data left in DB: Hossein's own test account + one Mercedes booking.

## Not finished / test mode
1. **SMS OTP** — code is always `OTP_TEST_CODE` (shown on screen). Anyone knowing a number can sign in as it. Must add an SMS provider before real customers (`api/auth.ts`).
2. **Ziina** — no `ZIINA_API_KEY` → payments are marked paid without charging. Code path for real Ziina + confirm is ready.
3. **OpenAI credit** — account has no credit; AI replies fall back. Urgent detection works without AI.
4. **Urgent → staff WhatsApp** — n8n workflow "DriveX App – Urgent alerts" (id `3BOLz3kHvch7tUcf`) ends in a placeholder node; add a WhatsApp send when Cloud API credentials exist.
5. **WhatsApp bot** — n8n "DriveX Bot" (id `hvkXTbNfbf1UDkmV`) cleaned to 80 nodes, inactive; needs Supabase/OpenAI/channel credentials. Telegram dropped by Hossein; WhatsApp waits for Facebook Business access (Phone Number ID, WABA ID, System User token).
6. **Content to replace** — partner offer texts/codes (ZUMA, Nusr-Et, Al Noor) and `vehicle_model_specs` are typical values, not confirmed by DriveX.
7. iPhone push only works when installed via Add to Home Screen.
8. Arabic UI not built.

## Security to-do
- Rotate: old Supabase secret (was in public repo history), Telegram bot token (hardcoded in old workflow), all tokens/passwords pasted in chat (Vercel ×6, Supabase ×3, n8n password, OpenAI key).
- Make the DrivexGit repo private (check Vercel Hobby can still deploy from a private org repo).
- `public/` of the panel serves the price list PDFs/XLSX publicly — move if not meant to be public.
- Disable the mirror GitHub Action on zakeriuae/car-rental-hub (it force-pushes to DrivexGit).

## Suggested next
Panel dashboard (revenue, today's pickups/returns, unpaid invoices) · automatic reminders (day before pickup / end of rental, via pg_cron + notifications) · specs edit page in panel · real SMS · Ziina live · Arabic.

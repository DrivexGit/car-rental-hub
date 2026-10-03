# Drivex customer app

Mobile-first PWA for Drivex customers. Built from Zakeri's 5 master screens
(`docs/customer-app/references/zakeri-v2-five-screens.jpg`).

```bash
npm install
npm run dev      # http://localhost:9191  (also serves /api/* locally)
npm run build
```

## Screens
Login (phone → code → name on first visit) · Home · Book · Reserve (3 steps: car → review & pay → confirmed)
· Bookings → Booking details (time left, invoices, Salik & fines, extend, Mulkiya, insurance, change car)
· Support (AI chat + Urgent call + WhatsApp) · Profile (+ Payments, Security, Documents, Notifications, Language, Legal).

## Data — live Supabase (project `ampdpgwcjgoqbamfttlw`)
Everything is read from / written to the real database (see `docs/DATABASE.md` → Customer app tables):
fleet + prices (`vehicles`), offers, bookings (`reservations`), invoices, payments, fines, documents, urgent requests.
Car photos are static assets keyed by make-model (`public/cars/<make-model>.webp`).

## Server functions (`api/`, Vercel Functions)
| File | Does |
|---|---|
| `auth.ts` | phone sign-in → Supabase session (creates `customers` + `leads` row on first visit) |
| `book.ts` | prices on the server, picks a free car, creates pending reservation + invoice |
| `pay.ts` | Ziina payment (or test payment without `ZIINA_API_KEY`), confirms reservation |
| `extend.ts` | extends a confirmed rental if the car is free, adds an invoice |
| `chat.ts` | AI support with live FAQ + the customer's data; urgent → `urgent_requests` + n8n webhook |

Env: see `.env.example`. Deploy: `./deploy.sh` (Kamyar's Vercel, project `drivex-customer`).

## Still in test mode
- **SMS:** no provider yet → the code is `OTP_TEST_CODE` (shown on screen). Anyone who knows a phone number can sign in as it — fine for testing, must be replaced before real customers.
- **Payments:** no `ZIINA_API_KEY` → payments are marked paid without charging.
- **AI:** needs credit on the OpenAI account; urgent detection works without it.
- Fines/Salik and partner offers are entered by staff (no admin screen yet — insert in Supabase for now).

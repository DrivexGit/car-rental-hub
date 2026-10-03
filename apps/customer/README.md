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

## Data
- `src/data/fleet.json` — snapshot of the live `vehicles` table (28 models, real daily/weekly/monthly prices).
- `src/lib/store.tsx` — **demo data in localStorage** (bookings, invoices, fines, session). Swap for Supabase
  once the customer tables + RLS exist (`docs/customer-app/TASKS.md` §2).
- `api/faq.ts` — snapshot of `faq_entries`, used by the AI.

## Server functions (`api/`, Vercel Functions)
| File | Does | Env |
|---|---|---|
| `chat.ts` | AI support, urgent detection, staff alert | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `STAFF_WEBHOOK_URL` |
| `pay.ts` | Ziina payment intent → hosted checkout | `ZIINA_API_KEY`, `ZIINA_TEST_MODE` |

Without `ZIINA_API_KEY` payments are simulated. Without `STAFF_WEBHOOK_URL` urgent alerts are only logged.
Client env: `VITE_SUPPORT_PHONE`, `VITE_WHATSAPP_NUMBER`. See `.env.example`.

## Not real yet
- OTP is simulated (any 6 digits) — needs an SMS provider for Supabase phone auth.
- Bookings/invoices/fines are demo data per device.
- Arabic UI.

# Handoff — DriveX customer app: Zakeri's feedback round (2026-10-03)

Work in `~/Desktop/projects/zakeri/drivex` (repo `car-rental-hub`). Reply to Hossein in **Persian**; write code, comments and commits in English.

## Read first
- `DriveX-Feedback-2026-10-03.pdf` (or `feedback.html`) in this folder. It has the full numbered list of 27 items, all from Zakeri's demo review. Item numbers below refer to it.
- `../HANDOFF-BUILD.md` (the 5 master screens and the brief) and `../TASKS.md`.

## No rush, but this order
1. **P0 bugs and visuals:** #1, #6–9, #13, #14, #16, #20.
   - #1: generate the login background with AI.
   - #14: get the car photos from Ali Davari or crawl drivex.ae **read-only**.
2. **P1:**
   - #2: keep colours as tokens and try navy instead of green, plus red accents.
   - #3: tab bar shadow and border.
   - #4: app-like transitions; GSAP is fine.
   - #10, #11: real desktop layout.
   - #15, #17: unique discount code per user, with usage count.
   - #18: avatar upload, also shown in the admin leads page.
   - #19: Arabic.
   - #21: send a message to a contact.
3. **P2 (next week):** #23 Ziina, #24 invoices, #25 SMS, #26 WhatsApp copies of notifications, #27 AI support (waiting on DriveX credit).

## Rules
- The DB is shared with the admin dashboard. Use new migrations only, keep existing data, and nothing goes to production without Hossein's OK.
- Never touch `drivex.ae`. Secrets only from `.env.local`.
- Keep it simple. Don't add screens outside the list without asking.
- After each group: send the Vercel preview link and a Persian report to Hossein (done / left / questions). Tick items in `../TASKS.md`.

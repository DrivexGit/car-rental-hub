# Customer app QA (end to end)

Browser tests that drive the real UI in Chrome, plus an API test for sign-in. **The backend is mocked** (`lib.mjs` fakes the Supabase REST/auth/storage calls and `/api/*` and injects a fake session), so nothing touches the production database and no real account is created.

## Run

Chrome is found automatically on macOS, Windows and Linux (set `CHROME_PATH` to use another one; with none installed, Playwright's own Chromium is used). On a slow machine raise the page-load timeout with `E2E_TIMEOUT=180000` (ms, default 90000).

1. Start the app so it is reachable on IPv4 (Vite's default `localhost` can be IPv6 only):
   ```bash
   npm run dev -- --host 127.0.0.1 --port 9291 --strictPort
   ```
2. In another terminal:
   ```bash
   npm run e2e
   ```
   Environment: `BASE` (default `http://127.0.0.1:9291`), `CHROME_PATH` (default: Chrome on Windows).

Screenshots and `report.json` go to `e2e/.out/` (git-ignored). Look at them: the checks are mechanical, the screenshots are for your eyes (layout, RTL, colours).

## What runs

| Script | Covers |
|---|---|
| `flows.mjs` | Tab navigation, offers filter, reserve → checkout, browser back, language and theme switch (and persistence), Support chip in Arabic, avatar upload (compress → storage → `avatar_url`), desktop sidebar and centred sheet, no duplicate history entries when tapping the current page, long/unbroken chat text stays on screen. Prints PASS/FAIL per check. |
| `sweep.mjs` | Every main page × mobile/desktop × English/Arabic: console errors, horizontal overflow, `dir`, and Latin words left on Arabic pages. |
| `api-auth.mjs` | `api/auth.ts` rate limiting (needs no running app: PostgREST is faked in-process): code requests per phone/IP, wrong-code lockout, fail-open when the table is missing. |
| `api-chat.mjs` | `api/chat.ts` (AI support) with Supabase, the AI provider and the staff webhook faked: auth, urgent detection in English/Persian/Arabic, no false alarms on ordinary questions, urgent row + staff alert contents, model-raised urgency, AI outage fallback, own-data-only context, input hygiene. |
| `panel-carphotos.mjs` | Panel **Car photos** page (not part of `npm run e2e`: it needs the panel dev server on a fake backend, see the header of the file). Upload/replace/remove studio photo, gallery add/remove, file type and size checks, search, remove button usable on touch. |
| `login.mjs` | Login screen × viewport × language × theme, phone validation (Persian digits accepted, non-UAE number rejected). |

Also run `npm run i18n:check`: every `t("…")` key must have an Arabic translation. It cannot see keys passed as variables (`t(label)`); add those to `src/locales/ar` by hand.

## AI support: manual check with the real model

The suite never calls the real AI (it costs DriveX credit, and an urgent case writes a real row and pages staff). Before a release, do this once against a **test customer** and tell staff first:

1. Ask an FAQ question and a question about your own booking and invoice; check the answer matches the data.
2. Ask in Persian and in Arabic; the reply must be in the same language.
3. Write "I had an accident": the reply must be calm, mention safety/999 and that the team was alerted; a row must appear in `urgent_requests`, the panel must notify, and n8n must post the alert. Mark the row handled afterwards.

## Not covered

The mocked backend means real sign-in, payment (Ziina), push notifications, RLS and the storage policy are **not** tested here. Test those against a staging project when one exists.

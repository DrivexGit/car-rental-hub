# Customer app QA (end to end)

Browser tests that drive the real UI in Chrome. **The backend is mocked** (`lib.mjs` fakes the Supabase REST/auth/storage calls and `/api/*` and injects a fake session), so nothing touches the production database and no real account is created.

## Run

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
| `flows.mjs` | Tab navigation, offers filter, reserve → checkout, browser back, language and theme switch (and persistence), Support chip in Arabic, avatar upload (compress → storage → `avatar_url`), desktop sidebar and centred sheet. Prints PASS/FAIL per check. |
| `sweep.mjs` | Every main page × mobile/desktop × English/Arabic: console errors, horizontal overflow, `dir`, and Latin words left on Arabic pages. |
| `login.mjs` | Login screen × viewport × language × theme, phone validation (Persian digits accepted, non-UAE number rejected). |

Also run `npm run i18n:check`: every `t("…")` key must have an Arabic translation. It cannot see keys passed as variables (`t(label)`); add those to `src/locales/ar` by hand.

## Not covered

The mocked backend means real sign-in, payment (Ziina), push notifications, RLS and the storage policy are **not** tested here. Test those against a staging project when one exists.

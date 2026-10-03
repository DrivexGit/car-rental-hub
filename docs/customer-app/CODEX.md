# Codex task: DriveX Customer App (UI images, roadmap, mobile code)

You are working in the repo `car-rental-hub` (DriveX / CarBox dashboard: Vite + React + TypeScript + Tailwind + Supabase).
Reply to the user in **Persian**. Code, comments and commit messages in English.

## Read first
1. `docs/customer-app/README.md` — contract, scope, decisions, architecture, Supabase facts
2. `docs/customer-app/TASKS.md` — checklist; tick items as you finish them
3. `docs/customer-app/references/README.md` + `home-screen.jpg` + `support-screen.jpg` — the two **approved** screens and Zakeri's two design prompts. Every new screen must match these two.
4. `docs/DATABASE.md` — the shared Supabase schema
5. `docs/customer-app/FEATURES.md` — every feature, taken from the screens' real text. Each generated screen must show exactly these features, nothing more.

`FIGMA_TOKEN` and `AI_GATEWAY_API_KEY` are already in `.env.local` and both were tested.

## Context
- Client: Kamyar, owner of DriveX (car rental, Dubai). Contract AED 3,000: 2 weeks build + 1 week test.
- Users: monthly renters, many of them **older people** → large text, simple words, minimal UI.
- The customer app talks **directly to the same Supabase** as this dashboard (project `ampdpgwcjgoqbamfttlw`). No middle API.
- Confidential: nothing goes to public channels.

## Hard rule: UX is frozen, only UI changes
- UX source of truth: Kamyar's Figma. Use the public recoloured copy, which has the same screens and flows:
  `https://www.figma.com/design/5tBTJv7RuyxDYn2hjKPhdw` (page "Apps", node `4:4`).
  Original (view-only): `https://www.figma.com/design/Jdu9YvVoaFqtiiDfNkA7h9` (page "Apps", node `4:4`).
- Keep the same screens, section order, flows, tab bar (Home / Bookings / Support / FAQ / Profile) and components.
- **Do not invent screens, flows or navigation.** If something is missing, reuse an existing pattern and **ask first**.
- Only the look changes: colour, type, spacing, cards, buttons — like the two reference images: deep green `#1f4d2f`, cream background `#faf8f5`, big bold headings, pale cards (invoice/hotline pale red, WhatsApp pale green), font Chakra Petch.

### Screens in the Figma copy (file `5tBTJv7RuyxDYn2hjKPhdw`, node IDs)
| Group | Screens |
|---|---|
| Onboarding | Welcome `133:2629`, S1 `134:1962`, S2 `137:2080`, S3 `138:2131` |
| Auth | Login `286:3437`, Login `144:2223`, Login `286:3283`, Login `151:3674`, Forgot Password / OTP `149:3178`, `150:3325`, `151:3757`, `151:3575` |
| Home | Home `262:1812` (approved reference) |
| Support | Support active `286:3535` (approved reference), Support locked `294:11087`, FAQ `270:3887` |
| Bookings | List `131:2081`, List `149:2544`, Details `131:2427`, `144:3267`, `144:3575`, `144:4259`, `144:4968`, `144:5749`, `144:6434`, `144:7240`, `192:1114`; Forgot Password–named booking steps `152:4842`, `158:5074`, `158:5340` |
| Fleet (Phase 2) | Fleet `204:1808`, Search `210:6014`, Change Search `210:5672`, Filter `210:7047` |
| Profile | Pending Invoice `285:2913`, `289:3794`, `294:11443`, Edit `152:3885`, Security `152:4152` |

Export screenshots with the Figma REST API (no MCP needed):
`GET https://api.figma.com/v1/images/5tBTJv7RuyxDYn2hjKPhdw?ids=<comma-separated ids>&format=png&scale=2`
with header `X-Figma-Token: $FIGMA_TOKEN`. Read `FIGMA_TOKEN` from `.env.local`. **Never write a token or key into a file you commit, or into chat.** If the token is missing or the call fails, stop and ask the user.

## Task 1 — New UI image for every screen (today, urgent)
1. Export every screen above to `docs/customer-app/ui/source/` (e.g. `home.png`). Drop exact duplicates and tell the user which ones you dropped.
2. For each screen, generate a new UI image:
   - Screen exists in Figma → **Prompt 1** from `references/README.md` (the screen screenshot = Image A, the rest = references).
   - Screen is in the contract but not in Kamyar's design (fines & Salik, insurance, car registration card / Mulkiya, change car) → **Prompt 2**, **only after the user approves**.
   - **Always** attach `references/home-screen.jpg` and `references/support-screen.jpg` as references.
   - Tool: `openai/gpt-image-2` through Vercel AI Gateway, `POST https://ai-gateway.vercel.sh/v1/images/edits` (multipart, several `image[]` files) with `Authorization: Bearer $AI_GATEWAY_API_KEY`. Read the key from `.env.local`. Portrait output, phone ratio (e.g. 1024x1536), quality `high`. Roughly $0.06–0.20 per image; tell the user the estimated total before running everything.
3. Save outputs to `docs/customer-app/ui/` with numbered names: `01-welcome.jpg`, `02-onboarding-1.jpg`, …, following the flow order.
4. Create `docs/customer-app/ui/INDEX.md`: table of screens with number, file, Figma node, status (`draft` / `approved` / `needs-approval`) and one line of description.
5. Check each image yourself: same sections and order as the Figma source, no invented buttons, readable text, correct brand. Regenerate bad ones.
6. Give the user the list of files, ready to post in the "Drivex App" group (Kamyar, Zakeri, Hossein).

## Task 2 — One-page roadmap for Kamyar (today)
Kamyar asked: "write the roadmap of the app and its features on one page so we can review and approve together".
- **One page**, plain simple **English**, DriveX brand and the same colours/font as the UI.
- Content from `README.md`, contract and phases section:
  - **Phase 1 (now, priority):** monthly customer portal — car info and days left; invoices and online payment (Ziina); fines and Salik; insurance; car registration card (Mulkiya) to show police; request a car change; offers; support (emergency call with a 3-call limit, WhatsApp, UAE emergency numbers); FAQ; profile; sign-in with a mobile one-time code.
  - **Phase 2:** daily rentals — choose a car, book, pay.
  - **Phase 3:** partner coupons and discounts (restaurants etc.).
  - **Timeline:** 2 weeks build + 1 week test, with Kamyar's approval points (UI approval → Phase 1 demo → test week → launch).
- One line per feature: what the customer can do. No technical words.
- End with a short "Please approve or add anything missing" section.
- Output: `docs/customer-app/ROADMAP.html` (self-contained, A4, print CSS) and `ROADMAP.pdf` via headless Chrome:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf=docs/customer-app/ROADMAP.pdf docs/customer-app/ROADMAP.html`
  Open the PDF and check it really is one page.

## Task 3 — Mobile code (after UI approval, or in parallel if the user says so)
- Mobile-first web app (PWA), not native, unless the user says otherwise.
- Stack: Vite + React + TypeScript + Tailwind + Supabase client, same family as this repo.
- **Ask before creating it:** separate repo, or `apps/customer` inside this repo? Not decided yet.
- Sign-in with mobile OTP, direct Supabase access. A customer sees **only their own data** (RLS). Needed tables are listed under the database section of `TASKS.md` (customers, invoices, payments, fines, offers, emergency_calls). Write them as new migrations in `supabase/migrations/`; never edit old migrations; never run anything against the production database without the user's OK.
- Build pixel-close to the approved images in `ui/`, with large, accessible text.
- Future domain: `app.drivex…`. **Do not touch the drivex.ae website.**

## Ask the user before you start if
- the Figma export fails (token or access),
- `AI_GATEWAY_API_KEY` or `FIGMA_TOKEN` is missing from `.env.local`,
- you reach Task 3 (where the code should live).

## Order
Task 1 (UI) + Task 2 (roadmap) today → send to the user → approval in the group → Task 3.
After each step, tick `docs/customer-app/TASKS.md`. Do not commit or push unless the user asks.

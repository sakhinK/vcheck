# IAD Visa Desk — KKU visa extension request system

A server-rendered web app for the Faculty of International Affairs, Khon Kaen
University, to manage international-student visa extension requests end to end:
submission → faculty review → advisor approval → IAD → director → official
letter to the Immigration Bureau.

Built from the specification, with **correctness of identity data over
convenience** as the guiding rule.

## Tech stack

- **SvelteKit** (`@sveltejs/kit` 2.8) + **`@sveltejs/adapter-node`** — real
  server-side form actions (not an SPA)
- **MariaDB / MySQL** (via `mysql2`, transactional)
- **Node 20+**
- **Docker** (MariaDB + app)
- **pdf-lib** (offline PDF generation), **sharp + tesseract.js** (offline OCR)
- Default language: **English**

## Run it (Docker)

```bash
docker compose up --build
```

Then open http://localhost:3000. The app runs migrations on startup
(idempotent), seeds dev users, and the homepage has the mocked **KKU SSO**
button plus a **Dev login** role switcher.

> The MariaDB container's host port is mapped to **3307** (not 3306) so it does
> not clash with a locally running MySQL/MariaDB; the app still connects to the
> DB internally over `db:3306`. `ORIGIN=http://localhost:3000` is set so
> adapter-node accepts browser form POSTs over plain HTTP.

Dev users (one per role):

| Email | Role |
| --- | --- |
| `student@kkufa.dev` | international_student |
| `faculty@kkufa.dev` | faculty_officer |
| `advisor@kkufa.dev` | advisor |
| `iad@kkufa.dev` | iad_officer |
| `director@kkufa.dev` | iad_director |

A sample student (`KKU-INT-0001`, email `student@kkufa.dev`) is seeded and links
to the student user on first login (SSO or dev login).

## Run locally (without Docker)

```bash
npm install
# start MariaDB/MySQL, then:
npm run db:migrate   # applies src/lib/server/db/migrations/*.sql
npm run dev          # or: npm run build && node build/index.js
```

## Tests

```bash
npm test
```

- `tests/mrz.test.js` — MRZ check-digit algorithm (ICAO 9303-4 §4.2.2.2),
  TD3 parsing, tamper rejection, `<` handling, truncated-name flagging,
  incomplete-date flagging, positional OCR repair.
- `tests/workflow.test.js` — the state machine (normal path, advisor skip,
  signed-document requirements, role permissions, termination, milestones).

## Layout

- `src/lib/server/business/mrz.js` — MRZ decoder + check digits (the only path
  that derives passport identity data).
- `src/lib/server/business/ocr-engine.js` — offline Tesseract OCR engine.
- `src/lib/server/business/ocr-typhoon.js` — optional OpenTyphoon cloud OCR
  engine (same `runOcr` contract; select via `OCR_PROVIDER=typhoon`).
- `src/lib/server/business/workflow.js` — pure state machine.
- `src/lib/server/business/*.js` — SQL is in the DB layer (`db/`), business
  rules live here, route handlers only orchestrate.
- `src/lib/server/db/migrations/` — idempotent SQL migrations.
- `src/routes/` — pages + server actions per role.

## Design

Implements the **Genesis** design system (`genesis-DESIGN.md`, from
designmd.ai/chef/genesis): indigo `#6366F1`, near-black text `#0A0A0A`, warm
gray background `#FAFAFA`, 4px spacing grid, 6px inputs/buttons, 12px cards,
General Sans / DM Sans / JetBrains Mono type stack. Fonts fall back to system
fonts at runtime (no CDN) — commit the font files under `static/fonts/` and add
`@font-face` to match the spec exactly.

## What is verified vs. not yet verified (honest report)

Verified by automated tests:

- MRZ check-digit vectors from the standard (`checkDigit('520727') === '3'`,
  `checkDigit('AB2134<<<') === '5'`).
- Full specimen TD3 parses to Anna Maria Eriksson / 1974-08-12 / 2012-04-15.
- A tampered check digit is rejected with the failing field named.
- Illegal characters and non-MRZ input are rejected.
- Workflow transitions, advisor skip, signed-doc gates, termination.

Not yet end-to-end verified (needs a running DB / real OCR model):

- **Real OCR-B reading.** The OCR pipeline (`ocr-engine.js`) is wired to
  Tesseract with an MRZ character whitelist, and the MRZ decoder is fully
  tested, but no OCR-B-trained model is committed yet — generic English models
  are weak on the mandated OCR-B font. `TESSDATA_PATH` points at `./tessdata`;
  commit the trained data there. The dev UI exposes a **“Scan ICAO specimen”**
  button that runs the published specimen through the real server-side
  parse/verify path so the flow can be exercised offline without OCR.
  Alternatively set `OCR_PROVIDER=typhoon` + `OPENTYPHOON_API_KEY` to read the
  MRZ with the OpenTyphoon AI cloud OCR (`ocr-typhoon.js`) instead of Tesseract;
  the same MRZ check-digit verification still runs server-side either way.
- **DB-backed acceptance tests** (fake passport injection, one-pending-application
  row lock, server-side name certification) — the logic is implemented. The full
  happy path was exercised manually against a live Docker stack (dev login →
  student linked → create data version → “Scan ICAO specimen” → certify name →
  upload 5 required docs → submit → `VISA-2026-00001` pending → faculty
  transition to `faculty_ack` → second submission correctly rejected by the
  one-pending-application rule). Automated `mysql`-backed tests are still TODO.
- **Email / expiry notifications** (milestone 7) — schema table exists, dispatch
  not implemented.

## Key rules enforced in code

1. Passport number / DOB / expiry / nationality are written **only** by the
   server MRZ scan path (`applyScanToVersion`) — never read from a form.
2. A scan is accepted only when **every** check digit passes; on failure the
   uploaded file is never persisted.
3. Name / nationality / sex are shown as **not integrity-protected** (the
   composite check digit skips them).
4. Name confirmation is enforced **server-side** (checkbox is a business rule,
   not HTML `required`).
5. Name source (`mrz` / `applicant_edited` / `officer_edited`) is recorded and
   reviewers see a warning + the original machine-read value.
6. Faculty/IAD name corrections are appended to `name_edits` (old, new, who,
   role, when, why) and shown to the applicant too.
7. One open application per applicant — enforced in a transaction with
   `SELECT … FOR UPDATE` on the student row.
8. A returned application is resubmitted under the **same number** with an
   incrementing round; audit history is continuous, progress resets per round.
9. Everything runs offline at runtime (no CDN, no external API).

# TD EasyWeb sync

Scripts for `implementation-plans/td-easyweb-sync.md`.

## Setup (once)

Add two lines to `.env.local` in the repo root. The file is gitignored; don't
commit it, and don't give either key a `VITE_` prefix.

```
SUPABASE_SECRET_KEY=...   # Supabase dashboard → Project Settings → API Keys → Secret keys (sb_secret_…)
FINSIGHT_USER_ID=...      # Supabase dashboard → Authentication → Users → your user's UID
```

A legacy `service_role` key (API Keys → "Legacy API Keys" tab) also works, as
`SUPABASE_SERVICE_ROLE_KEY=`.

Optional: `FINSIGHT_DASHBOARD_URL=https://…` opens the app when a sync imports something.
The Supabase URL comes from the existing `VITE_SUPABASE_URL`.

Accounts are mapped in `accounts.json` (EasyWeb name → Finsight name → kind).
To override it locally, create `accounts.local.json` (gitignored).

## Running a sync

```bash
npm run sync-td -- --dry-run     # first time: download + check duplicates, import nothing
npm run sync-td                  # the real thing
```

1. Chrome opens on EasyWeb. **You log in.** The script waits on My Accounts and never touches the login page.
2. For each account it downloads from (latest date already in Finsight − 7 days) to today:
   - **Chequing:** Custom date range → CSV.
   - **Visa:** every statement period overlapping that range, usually just "Since last statement".
3. It signs out, closes the browser, skips rows already in Finsight, imports the
   rest into bronze (as upload "EasyWeb sync YYYY-MM-DD"), and runs AI categorisation.

If a step can't find what it expects (EasyWeb changed), it tells you what to
download yourself in the window and waits for you to press Enter, so the run still finishes.

Flags: `--since YYYY-MM-DD` · `--account "TD Debit"` · `--keep-files` · `--no-open`.
Downloads go to `~/.finsight/sync/<timestamp>/` and are deleted after import unless `--keep-files`.

## Files

| File | Purpose |
|---|---|
| `sync.mjs` | The sync (`npm run sync-td`) |
| `easyweb.mjs` | EasyWeb steps: login wait, chequing range download, Visa periods, logout, manual fallback |
| `dates.mjs` | Date range and Visa-period logic (tested in `dates.test.mjs`) |
| `ingest.mjs` | Parse → remove duplicates → bronze rows |
| `db.mjs` | Supabase: account check, latest date, insert, run `process-transactions` |
| `config.mjs` | Reads `.env.local` and the account map |
| `accounts.json` | EasyWeb account → Finsight account |
| `browser.mjs` | Launches your installed Chrome with a persistent profile at `~/.finsight/td-profile` |
| `recorder-page.js` | Injected into pages during discovery; records clicks, never typed text |
| `recorder.mjs` | Writes clicks, page loads and downloads to `events.jsonl`; saves downloads |
| `discover.mjs` | Phase 0 discovery run (`npm run td-discover`) |

## Phase 0: discovery run

```bash
npm run td-discover
```

1. A Chrome window opens on EasyWeb. Log in yourself.
2. Download a CSV from **TD STUDENT CHEQUING ACCOUNT**, then from **TD CASH BACK VISA\* CARD**.
3. Optionally, download the chequing CSV a second time with the same dates (stability check).
4. Sign out, go back to the terminal, and press Enter.

Output goes to `~/.finsight/discovery/<timestamp>/`, outside the repo:
`events.jsonl` (what you clicked), `downloads/` (the CSVs), and `summary.json`
(whether each CSV parses with `parseBankCSV`).

**What's recorded:** element labels, button and link text, CSS paths, page
URLs without query strings (those can hold session tokens), dropdown choices,
and values that look like dates.
**What's never recorded:** anything typed into text fields, so no username,
password or verification codes.

Button and link text can include account names and numbers as EasyWeb shows
them, and the CSVs contain your transactions. Everything stays on this machine.

## Discovery findings (run 2026-11-12)

TD showed no bot warning or extra challenge with Playwright + installed Chrome.
EasyWeb is an Angular Material app. Many element ids are generated
(`mat-option-10`, `td-uf-button-3`) and change between visits, so the sync
targets the **stable ids** below and otherwise uses role + visible text.

### Login
- Starts at `https://authentication.td.com/uap-ui/` (title "EasyWeb Login"):
  `#username`, `#uapPassword`, then a **Login** button. The sync never touches these.
- About 85 s passed between clicking Login and reaching EasyWeb, which includes
  two-step verification.
- **Logged-in signal:** URL `https://easyweb.td.com/ui/ew/fs` (My Accounts) with
  account links `a.uf-account-name-and-link` present.

### My Accounts (`/ui/ew/fs`)
- Chequing link: `#pfsTableCA_BANKBanking a.uf-account-name-and-link`, text
  `TD STUDENT CHEQUING ACCOUNT`
- Visa link: `#pfsTableCA_BANKCreditCards a.uf-account-name-and-link`, text
  `TD CASH BACK VISA* CARD`
- Left nav **My Accounts** (`#td-nav-left a`, text "My Accounts") returns here.
- **Logout:** top nav link with text "Logout".

### Chequing activity (`/ui/ew/da`): custom date range
1. Open the date filter chip → option **Custom**.
2. **From** `#input-daDtTransFrom` / **To** `#input-daDtTransTo` (text inputs; on
   this run the dates were picked with the calendar). Calendar day cells have
   `aria-label` like `"February 4, 2026"`; the month/year view cells have `"February 2026"`.
3. **Apply filters** button.
4. Download icon `#daTransactionDownloadButton button` → format
   `#matselect-daDownloadPanelFormatDropdown` → option **Spreadsheet (.CSV)** →
   **Download** (submit) button. Close with `#daDownloadPanelCloseBtn`.
5. The download contains the filtered range. For Feb 4 → Apr 2 it gave Feb 5 → Mar 31 rows.

CSV format: headerless, quoted, `YYYY-MM-DD`, oldest first:
`"date","description","debit","credit","balance"`.

### Visa activity (`/waw/webui/acct/`): statement periods only
A different app (reached through `TransferInFromNorthStarServlet`).
1. Download icon `#paymentPlanTransactionDownloadButton button`.
2. **Period** `#matselect-paymentPlanDownloadCycleSelect` (aria "Select Period").
   The options are **statement cycles**, e.g. `Aug 21, 2026 - Sep 21, 2026`.
   There's **no custom date range**.
3. Format `#matselect-ccDownloadPanelFormatDropdown` → **Spreadsheet (.CSV)** →
   **Download** button. Close with `#ccDownloadPanelCloseBtn`.
4. A cycle's CSV can include transactions dated just before the cycle starts.
   For the Aug 21 – Sep 21 cycle it gave Aug 19 → Sep 19. Duplicate matching
   handles the overlap between cycles.

CSV format: headerless, **unquoted**, `MM/DD/YYYY`, **newest first**, no
trailing newline: `date,description,charge,payment,balance`. `parseBankCSV`
handles it: charges are negative, and payments (`PAYMENT - THANK YOU`) are positive.

**Period option formats** (from a screenshot, newest first):
```
Oct 21, 2026 to today (Since last statement)    ← current, unbilled cycle
Sep 22, 2026 - Oct 20, 2026 (Last statement)
Aug 21, 2026 - Sep 21, 2026
Jul 21, 2026 - Aug 20, 2026
…
```
The sync parses each option into a `[start, end]` range (with `to today` meaning
today) and downloads **every option that overlaps the missing range**, so the
current cycle is always included. Ignore the `(…)` suffix when matching.

### Still unknown
- What text format `#input-daDtTransFrom` accepts when typed into, instead of
  picking from the calendar. To test while building Phase 5.
- How far back chequing history goes. This only matters for a first-ever sync.
- Download stability: this run didn't re-download. Chequing descriptions did
  match an earlier upload exactly in the duplicate test on 2026-11-12.

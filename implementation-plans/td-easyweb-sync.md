# TD EasyWeb Sync — Implementation Plan

## Summary

A local command, `npm run sync-td`, that replaces the manual "download CSVs from
EasyWeb, upload them to Finsight" routine:

1. It opens EasyWeb in a real browser window, and **you log in yourself**.
2. It works out which dates are missing for each TD account, using the latest
   date already in bronze.
3. It downloads each account's CSV for that range, starting a week early to be safe.
4. It removes rows already in bronze, inserts the rest, runs AI processing, and
   opens the dashboard.

There's no Plaid, no saved bank password and no cost. All the dashboard code
stays the same.

---

## Architecture Decisions

| Decision | Choice | Why |
|---|---|---|
| Where it runs | Local Node script on your Mac | The Vercel web app can't control another site, because browsers block it. |
| Browser automation | Playwright, `launchPersistentContext`, `channel: 'chrome'`, visible window | Uses your installed Chrome with a profile that persists, so TD remembers the device and asks for verification less often. A real Chrome is also less likely to be flagged than Playwright's bundled Chromium. |
| Login | Done by you. The script never touches the login fields | No stored password, and verification codes are answered by you. |
| Date range | `latest bronze date − 7 days` → today | Downloads extra so late-posting and same-day transactions aren't missed. |
| Duplicates | Removed **before** bronze, using the count-aware fingerprint from `duplicate-transaction-detection.md` | Duplicates never reach Gemini (no wasted tokens) or silver. Two identical same-day purchases are kept. |
| Parsing | Reuse `parseBankCSV` from `src/utils/csvParser.js` | It already handles TD's headerless format. |
| Database access | Service-role key in gitignored `.env.local` | Simplest option for a personal tool on your own machine. |
| AI step | `process-transactions`, unchanged, called in a loop | Same path as `processTransactionsInternal` in `Processing.jsx`. |

---

## Flow

```
npm run sync-td
  │
  ├─ 1. Load config (.env.local + scripts/td-sync/accounts.local.json)
  ├─ 2. For each mapped account: SELECT max(raw_data->>'Date') from bronze
  │       → start = max − 7 days (or --since / default 90 days if none), end = today
  ├─ 3. Launch Chrome (persistent profile at ~/.finsight/td-profile)
  │       → open EasyWeb → wait (up to 5 min) until signed in
  ├─ 4. For each account:
  │       → open activity → Download → CSV + date range → catch download
  │       → if any step can't be found: "Click Download yourself" and wait for the file
  ├─ 5. Sign out of EasyWeb, close the browser
  ├─ 6. For each CSV: parseBankCSV → deduplicateTransactions → insert into bronze
  ├─ 7. Call process-transactions until nothing is pending (handle token limit)
  ├─ 8. Delete the downloaded CSVs
  └─ 9. Print a summary, open the dashboard
```

---

## Phase 0: EasyWeb discovery run (with you, ~1 hr)

The plan depends on EasyWeb's pages, so the first step is one run where you're
watching. Record:

- [ ] Login URL, and a reliable sign of being logged in (a URL pattern or a page element)
- [ ] How to get from the accounts list to each account's activity page
- [ ] Where Download is, which formats it offers, and how the date range is entered
- [ ] **How far back the download can go** (sets the default for a first run)
- [ ] CSV layout for **chequing vs. credit card**. Confirm `parseBankCSV` handles both.
- [ ] **Stability check:** download the same range twice and diff the files. The
      descriptions must be byte-identical between downloads, or duplicate matching fails.
- [ ] Whether TD shows any bot warning or extra challenge with Playwright + Chrome

Output: notes and selectors in `scripts/td-sync/README.md`.

---

## Phase 1: Shared duplicate check (~2 hrs): ✅ built 2026-11-12

`src/utils/deduplicateTransactions.js` + tests (`npm test`), wired into
`Processing.jsx`. `TransactionUploads.jsx` also inserts into bronze but isn't
imported anywhere, so it was left alone.

Already planned in `duplicate-transaction-detection.md` but not built yet. Build
it here so both manual uploads and the sync use it.

- **[NEW] `src/utils/deduplicateTransactions.js`:** as specified in that plan.
  Fingerprint is `Date|Description|Amount`, using the `transaction_account` given,
  with counts so identical rows are matched one-for-one.
  - Normalise before matching: `Description.trim()`, `Amount.toFixed(2)`.
  - Take the Supabase client as an argument (it does in the existing design), so
    the browser passes its anon client and the script passes its service-role client.
- **[MODIFY] `src/components/dashboard/Processing.jsx`:** call it between parsing
  and the bronze insert, and show "N duplicates skipped".
- **[NEW] tests** using Node's built-in `node:test`, no new dependency:
  same-day identical rows, overlapping ranges, an exact re-upload, a different account.

---

## Phase 2: Fix in `process-transactions` (~30 min): ✅ release fix built 2026-11-12 (atomic claim not done)

There's an existing bug the sync would run into. The function marks pending rows
as `processing` **before** checking the token limit (`index.ts:169` vs `:219`).
On a 429 it returns without releasing them, so they stay in `processing` forever
and never get categorized.

- [ ] Before returning `TOKEN_LIMIT_EXCEEDED`, set that user's claimed rows back
      to `pending`. Alternatively, check the limit before claiming.
- [ ] *(Optional)* Make claiming atomic (an RPC using `FOR UPDATE SKIP LOCKED`).
      The risk is low for a single user, but the sync and an open browser tab
      could both trigger processing at once.

---

## Phase 3: Script setup (~1 hr)

- [ ] `scripts/td-sync/index.mjs`, the entry point. Add `"sync-td": "node scripts/td-sync/index.mjs"` to `package.json`.
- [ ] Dev dependency: `playwright` (no browser download needed with `channel: 'chrome'`).
- [ ] `.env.local`, already gitignored by `*.local`:
  ```
  SUPABASE_URL=...
  SUPABASE_SERVICE_ROLE_KEY=...   # NO "VITE_" prefix, or Vite would ship it to the browser
  FINSIGHT_USER_ID=...
  FINSIGHT_DASHBOARD_URL=...
  ```
- [ ] `scripts/td-sync/accounts.local.json`, mapping EasyWeb account labels to
      Finsight account names from `user_accounts`. Add it to `.gitignore`
      explicitly: the existing `*.local` rule doesn't match `.local.json`.
  ```json
  [{ "easyweb": "TD STUDENT CHEQUING ACCOUNT", "finsight": "TD Debit" },
   { "easyweb": "TD CASH BACK VISA* CARD",     "finsight": "TD Credit Card" }]
  ```
  - Match on the account **name** shown in EasyWeb, not the account or card
    number. Numbers stay out of the repo and out of config. If both ever appear on
    one line, match by "label starts with".
  - The script stops with a clear message if a `finsight` name isn't in `user_accounts`.
- [ ] Flags: `--since YYYY-MM-DD` (override the start date), `--dry-run` (download
      and check duplicates, but insert nothing), `--account <name>`.
- [ ] Confirm `parseBankCSV` accepts a CSV **string** in Node. Papa.parse supports
      strings, so it should work as is. If not, add a small adapter rather than changing the browser code.

---

## Phase 4: Date range (~30 min)

- [ ] For each account, find the latest `raw_data->>'Date'` in `bronze.transactions`
      for that user and `transaction_account`.
- [ ] `start = latest − 7 days`, `end = today` (local date, calculated without
      timezone conversions, the same way `normalizeDate` works).
- [ ] No rows yet: use `--since`, or default to EasyWeb's maximum history (from Phase 0).
- [ ] Print the plan before opening the browser: `TD Chequing: 2026-10-24 → 2026-11-12`.

---

## Phase 5: Browser automation (~3–4 hrs, mostly selector work)

- [ ] Launch a persistent context. The profile lives at `~/.finsight/td-profile`,
      **outside the repo**, because it holds TD session cookies.
- [ ] Open EasyWeb and wait for the logged-in signal (5 min timeout, with a
      "Log in to EasyWeb in the window that opened…" message).
- [ ] For each account: go to activity → Download → choose CSV → enter the range →
      `page.waitForEvent('download')` → save to `~/.finsight/downloads/`.
- [ ] **Manual fallback** for every automated step: if an element isn't found
      within ~10 s, print what to click and keep waiting for the download. When
      EasyWeb changes, the sync becomes partly manual instead of failing.
- [ ] Sign out and close the browser, even when an error occurs (`try/finally`).
- [ ] Never read or fill login or verification fields. Never try to get past a
      challenge TD shows; if one appears, stop and tell you.

---

## Phase 6: Ingest (~1 hr)

- [ ] Read the CSV → `parseBankCSV` → report rows skipped as blank.
- [ ] `deduplicateTransactions(rows, userId, account, supabase)`.
- [ ] Insert the remaining rows into `bronze.transactions` with the same row shape as
      `Processing.jsx` (`file_id` = a new UUID per account per run,
      `file_name` = `EasyWeb sync 2026-11-12`, `transaction_account`, `raw_data`,
      `status: 'pending'`). They then appear in the Transaction Uploads view as usual.
- [ ] Per-account summary: `downloaded 34 · duplicates 21 · new 13`.
- [ ] With `--dry-run`, stop here and list the new rows.

---

## Phase 7: Processing and finish (~1 hr)

- [ ] Call `process-transactions` in a loop (max 20 iterations, like
      `processTransactionsInternal`) until it returns "No pending transactions".
- [ ] On `TOKEN_LIMIT_EXCEEDED`: show the reset date and leave the rows pending
      (the Phase 2 fix makes them retry next time).
- [ ] Delete the downloaded CSVs, print the summary, and open
      `FINSIGHT_DASHBOARD_URL` with `open <url>`.

---

## Phase 8 (optional): One-click start

- [ ] A macOS Shortcut or Automator app that runs `npm run sync-td` in Terminal,
      kept in the Dock.

---

## Verification

1. `--dry-run` on a fresh range: the new-row count matches what EasyWeb shows.
2. A real run: rows land in bronze → silver, and the dashboard shows them categorized.
3. **Run it again immediately:** 0 new rows, all counted as duplicates, no Gemini call.
4. A range with two identical same-day purchases: both kept on the first run, both
   counted as duplicates on the second.
5. Hide or rename a selector on purpose: the manual fallback prompt appears, and
   clicking Download yourself finishes the run.
6. Token limit reached: a clear message, and rows are still `pending` afterwards (not stuck in `processing`).
7. Manual CSV upload in the app still works and now skips duplicates.

---

## Risks

| Risk | Mitigation |
|---|---|
| EasyWeb layout changes break the clicking | Manual fallback at every step; selectors kept in one file |
| TD flags the automated browser | Real Chrome, persistent profile, you log in. If TD still blocks it, switch to a small Chrome extension in your normal browser |
| TD's terms on automated access | The script only clicks within a session you started yourself, and never touches credentials or security challenges |
| Descriptions differ between downloads | Checked in Phase 0. If they differ, match on Date + Amount and the closest description |
| A transaction posts more than 7 days late | Overlap is configurable; `--since` for a one-off wider window |
| Service-role key on your laptop | Gitignored `.env.local`, no `VITE_` prefix, used by this script only |
| Browser profile holds bank cookies | Stored outside the repo in `~/.finsight/`; the script signs out every run |

---

## Effort

| Phase | Estimate |
|---|---|
| 0. Discovery run | ~1 hr (with you) |
| 1. Shared duplicate check + tests | ~2 hrs |
| 2. Token-limit fix | ~30 min |
| 3–4. Setup + date range | ~1.5 hrs |
| 5. Browser automation | ~3–4 hrs |
| 6–7. Ingest + processing | ~2 hrs |
| **Total** | **about 1–1.5 days** |

Phases 1 and 2 are worth doing first. They help manual uploads right away and
don't depend on how EasyWeb works.

## Decisions

- **Accounts to sync:** two.
  - EasyWeb "TD STUDENT CHEQUING ACCOUNT" → Finsight **TD Debit**
  - EasyWeb "TD CASH BACK VISA* CARD" → Finsight **TD Credit Card**

  Phase 0 should confirm that the chequing and Visa CSVs both parse with
  `parseBankCSV`, since they come from different download pages.
- **Database:** the existing (production) Supabase project, the same one the
  deployed app uses. There's no local copy. Use `--dry-run` for safe testing:
  it downloads and checks duplicates but inserts nothing.

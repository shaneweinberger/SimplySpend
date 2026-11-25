# Plaid TD Sync

New transactions on TD Student Chequing and the TD Cash Back Visa arrive in
bronze automatically, run through the same rules, categories and AI step as a
CSV upload, and show up in the dashboard a few hours after you spend.

Plan artifact: https://claude.ai/artifact/X33WMvMnFHopYnWgmyxBGz

```
TD → Plaid ──SYNC_UPDATES_AVAILABLE──▶ plaid-webhook ─┐
pg_cron (every 4h) / Sync now ───────▶ plaid-sync ────┤
                                                      ▼
                          /transactions/sync from saved cursor
                                                      ▼
            bronze.transactions (status 'pending', source 'plaid')
                                                      ▼
            process-transactions (your rules + categories + Gemini)
                                                      ▼
                               silver_transactions → dashboard
```

## What was built (branch `feature/plaid-sync`)

| File | What it does |
|---|---|
| `supabase/migrations/20261119120000_plaid_sync.sql` | `plaid_items` (token; no client access), `plaid_accounts` (mapping, cutover), bronze `source` + `plaid_transaction_id` (unique), silver `is_pending`, `get_plaid_connections()`, `latest_non_plaid_bronze_date()` |
| `supabase/migrations/20261119120100_plaid_sync_schedule.sql` | `pg_cron` job every 4 hours → `plaid-sync` (needs two Vault secrets, below) |
| `supabase/functions/plaid-link` | Create link token (new / update mode), exchange, reconnected, remove. Refuses a 2nd production connection unless confirmed |
| `supabase/functions/plaid-sync` | Schedule (`x-cron-secret`) or Sync now (user session). Syncs, then categorizes in the background |
| `supabase/functions/plaid-webhook` | Verifies Plaid's ES256 signature; syncs on `SYNC_UPDATES_AVAILABLE`; tracks reconnect-needed states |
| `supabase/functions/_shared/plaidMapping.js` | Pure logic + tests (`npm test`): sign flip, description, cutover, pending → posted, removals, silver patch |
| `supabase/functions/_shared/plaidSync.ts` | Applies a sync to the database; cursor saved last, every step idempotent |
| `supabase/functions/process-transactions` | One change: writes `is_pending` to silver |
| `src/components/dashboard/ConnectedBanks.jsx` | Settings → Connected banks: connect, map accounts, import-from date, Sync now, Reconnect, Disconnect |
| `src/components/dashboard/TransactionTable.jsx` | "Pending" chip |

### Behaviour worth knowing

- **Description** is Plaid's `original_description` (TD's own text), so your
  rules keep matching. Falls back to Plaid's `name`.
- **Amount** is negated: Plaid's positive = money out; bronze's negative = money out.
- **Cutover:** only transactions on/after each account's "Import from" date are
  imported. It defaults to the day after the latest CSV/EasyWeb row for that
  account, so Plaid's 90-day backfill doesn't duplicate what's already there.
- **Unmapped accounts:** sync waits (cursor not advanced) until every enabled
  account has a SimplySpend account or is set to "Don't import". Nothing is lost.
- **Pending → posted:** the existing bronze and silver rows are re-keyed and
  updated in place. Category, description and your edits stay; Gemini isn't
  called again. Amount follows the bank unless you edited or split the row.
- **Removed by Plaid:** silver row deleted, bronze row kept as `status = 'deleted'`
  (so it can come back if its posted version arrives later).
- **Processing screen:** Plaid rows show as one "upload" per bank per month
  (`Plaid · TD Canada Trust · Nov 2026`). Deleting one there deletes those rows,
  and sync won't bring them back.
- **Costs:** products are `transactions` only. `/transactions/refresh` runs only
  when `PLAID_REFRESH_ENABLED=true` (free on Trial; turn off if you ever upgrade).
  `/accounts/balance/get` and Auth are never used.

## Who can use it

Only emails listed in `public.plaid_access` (migration
`20261126120000_plaid_access.sql`) can connect a bank or press Sync now: each
connection permanently uses one of the Trial plan's 10 slots. Everyone else
doesn't see the Connected banks card, and `plaid-link` / `plaid-sync` answer
`403 NO_PLAID_ACCESS` if called directly.

To change it, add or delete a row in the Supabase Table Editor
(`plaid_access`, lowercase email). No deploy needed. Removing someone doesn't
stop a connection they already made (the schedule keeps syncing it, and the slot
stays used); they can still Disconnect it.

## Setup: Sandbox

1. **Plaid:** create a Dashboard account (team created on/after 2026-04-15 for the
   Trial plan). Copy `client_id` and the Sandbox secret.
2. **Test login:** create a second SimplySpend user with accounts like
   "Sandbox Chequing" and "Sandbox Visa", and copy a few rules over. Do all
   Sandbox testing there.
3. **Secrets** (Supabase dashboard → Edge Functions → Secrets, or CLI):
   ```bash
   supabase secrets set PLAID_CLIENT_ID=... PLAID_SECRET_SANDBOX=... PLAID_ENV=sandbox PLAID_REFRESH_ENABLED=true PLAID_DAYS_REQUESTED=730 PLAID_CRON_SECRET=<openssl rand -hex 32>
   ```
   Optional: `PLAID_COUNTRY_CODES` (default `CA`), `PLAID_DAYS_REQUESTED`
   (default 90), `PLAID_REDIRECT_URI` (only if Plaid asks for one for OAuth).
4. **Migrations first, then functions.** `process-transactions` now writes
   `is_pending`, so deploying it before the migration would break CSV processing.
   Don't use `supabase db push`: the remote migration history is empty (earlier
   migrations were run by hand), so it would try to re-run everything since 2024.
   Paste `20261119120000_plaid_sync.sql`, then `20261119120100_plaid_sync_schedule.sql`,
   into the SQL editor and run each. Both are safe to run twice.
   ```bash
   supabase functions deploy plaid-link plaid-sync plaid-webhook process-transactions
   ```
5. **Schedule secrets** (SQL editor, once):
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<same value as PLAID_CRON_SECRET>', 'plaid_cron_secret');
   ```
6. `npm run dev`, sign in as the test user → Settings → Connect bank. In Plaid's
   Sandbox, pick any bank and use `user_transactions_dynamic` (any password) for
   transactions that change on refresh, or `user_good` / `pass_good`.

### Sandbox test checklist

Sandbox API calls (curl with your client_id/secret against `https://sandbox.plaid.com`):
`/sandbox/item/fire_webhook` (`webhook_code: SYNC_UPDATES_AVAILABLE`),
`/sandbox/item/reset_login`, `/transactions/refresh`.

- [ ] Connect → both accounts listed and mapped → Save and sync → rows in bronze (`source = 'plaid'`) → categorized in silver with your rules
- [ ] Fire `SYNC_UPDATES_AVAILABLE` → new rows arrive with no clicks
- [ ] With `user_transactions_dynamic`, pending → posted updates the same silver row (category and edits kept)
- [ ] A removed transaction disappears from Analysis; its bronze row is `deleted`
- [ ] Sync now twice in a row → nothing new the second time
- [ ] Rows before "Import from" aren't imported
- [ ] A "delete" rule still removes Plaid rows
- [ ] `/sandbox/item/reset_login` → "Reconnect needed" → Reconnect fixes it **without a new connection**
- [ ] Forged webhook (no signature) → 401 in `plaid-webhook` logs
- [ ] After the first scheduled run (`select * from cron.job_run_details order by start_time desc limit 5;`), `last_synced_at` moves

## Go live with TD (uses 1 of 10 Trial slots)

1. Apply for the Trial plan at `dashboard.plaid.com/trial-plan`, **Transactions only**.
2. Do the Link setup steps in Plaid's launch checklist. Check the dashboard's
   **OAuth institutions** page for whether TD Canada Trust needs approval.
3. Plans page: confirm no expiry. Then:
   ```bash
   supabase secrets set PLAID_SECRET_PRODUCTION=... PLAID_ENV=production
   ```
4. Run `npm run sync-td` one last time so bronze is current.
5. In **your real login**: Settings → Connect bank → TD, once. Check both
   accounts map to TD Debit / TD Credit Card and the "Import from" dates are the
   day after your latest rows. Save and sync.
6. For the first week, compare with EasyWeb: descriptions match your rules,
   signs right, dates line up, nothing missing or doubled. If `authorized_date`
   matches TD better than `date`, change `toBronzeRaw` in `plaidMapping.js`.
7. Stop running `sync-td` routinely; keep it as a fallback (don't run both over
   the same dates).

## Open questions (production only)

- Does Plaid return `original_description` for TD Canada, matching the CSV text?
- Does TD Canada send pending transactions?
- Does TD need OAuth approval before the first link?
- `date` vs `authorized_date`: which lines up with TD's CSV dates?

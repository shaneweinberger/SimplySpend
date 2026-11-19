-- Plaid sync: TD chequing and Visa transactions arrive in bronze automatically.
--
-- Plan: implementation-plans/plaid-sync.md
--
-- Plaid is a new way for rows to enter bronze. Everything from bronze onward
-- (process-transactions, rules, categories, silver) is unchanged: a Plaid row
-- carries the same raw_data shape as a CSV row ({ Date, Description, Amount }).
--
-- Idempotent: safe to run more than once.

-- ── 1. Connected banks ───────────────────────────────────────────────────────
-- One row per Plaid Item (one bank login). The access token lives here and is
-- only ever read by edge functions using the service role: RLS is on and there
-- are no policies, so the anon and authenticated roles can't read the table.
-- The dashboard reads connections through get_plaid_connections() below.
CREATE TABLE IF NOT EXISTS public.plaid_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    env              TEXT NOT NULL CHECK (env IN ('sandbox', 'production')),
    item_id          TEXT NOT NULL UNIQUE,
    access_token     TEXT NOT NULL,
    institution_id   TEXT,
    institution_name TEXT,
    cursor           TEXT,          -- /transactions/sync position; NULL = never synced
    status           TEXT NOT NULL DEFAULT 'ok'
                     CHECK (status IN ('ok', 'needs_reauth', 'error', 'removed')),
    error_code       TEXT,
    last_synced_at   TIMESTAMPTZ,
    last_sync_summary JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plaid_items FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_plaid_items_user ON public.plaid_items (user_id);

DROP TRIGGER IF EXISTS update_plaid_items_modtime ON public.plaid_items;
CREATE TRIGGER update_plaid_items_modtime
    BEFORE UPDATE ON public.plaid_items
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ── 2. Accounts inside each connection ───────────────────────────────────────
-- Maps a Plaid account to one of the user's accounts (user_accounts.account_name,
-- the same text bronze stores in transaction_account, e.g. 'TD Debit').
--
--   transaction_account NULL → not mapped yet. Sync waits (and doesn't advance
--                              its cursor) until every enabled account is mapped,
--                              so no transactions are lost while you decide.
--   cutover_date             → only transactions on or after this date are
--                              imported, so Plaid's history backfill doesn't
--                              overlap rows you already uploaded from CSVs.
--                              Filled in on first sync if left empty.
--   enabled = false          → this account's transactions are skipped.
CREATE TABLE IF NOT EXISTS public.plaid_accounts (
    plaid_account_id    TEXT PRIMARY KEY,
    plaid_item_id       UUID NOT NULL REFERENCES public.plaid_items(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                TEXT,
    official_name       TEXT,
    mask                TEXT,
    type                TEXT,
    subtype             TEXT,
    transaction_account TEXT,
    cutover_date        DATE,
    enabled             BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.plaid_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item ON public.plaid_accounts (plaid_item_id);

DROP POLICY IF EXISTS "Users can view their own Plaid accounts" ON public.plaid_accounts;
CREATE POLICY "Users can view their own Plaid accounts"
    ON public.plaid_accounts FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own Plaid account mapping" ON public.plaid_accounts;
CREATE POLICY "Users can update their own Plaid account mapping"
    ON public.plaid_accounts FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users may only change the mapping fields; everything else comes from Plaid.
REVOKE ALL ON public.plaid_accounts FROM anon, authenticated;
GRANT SELECT ON public.plaid_accounts TO authenticated;
GRANT UPDATE (transaction_account, cutover_date, enabled) ON public.plaid_accounts TO authenticated;

DROP TRIGGER IF EXISTS update_plaid_accounts_modtime ON public.plaid_accounts;
CREATE TRIGGER update_plaid_accounts_modtime
    BEFORE UPDATE ON public.plaid_accounts
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ── 3. Bronze: where a row came from ─────────────────────────────────────────
-- plaid_transaction_id is Plaid's stable ID, so re-syncs never double-insert.
-- A plain UNIQUE constraint (not a partial index) so ON CONFLICT can target it;
-- NULLs never conflict, so CSV rows are unaffected.
ALTER TABLE bronze.transactions
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'csv',
    ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bronze.transactions'::regclass
          AND conname = 'transactions_plaid_transaction_id_key'
    ) THEN
        ALTER TABLE bronze.transactions
            ADD CONSTRAINT transactions_plaid_transaction_id_key UNIQUE (plaid_transaction_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bronze.transactions'::regclass
          AND conname = 'transactions_source_check'
    ) THEN
        ALTER TABLE bronze.transactions
            ADD CONSTRAINT transactions_source_check CHECK (source IN ('csv', 'plaid'));
    END IF;
END $$;

-- ── 4. Silver: pending purchases ─────────────────────────────────────────────
-- A card purchase can arrive while still pending. When it posts, plaid-sync
-- updates the same silver row in place (keeping its category and your edits)
-- and clears this flag.
ALTER TABLE public.silver_transactions
    ADD COLUMN IF NOT EXISTS is_pending BOOLEAN NOT NULL DEFAULT false;

-- ── 5. Dashboard read path ───────────────────────────────────────────────────
-- Everything about the caller's connections except the access token and cursor.
CREATE OR REPLACE FUNCTION public.get_plaid_connections()
RETURNS TABLE (
    id                UUID,
    env               TEXT,
    institution_name  TEXT,
    status            TEXT,
    error_code        TEXT,
    last_synced_at    TIMESTAMPTZ,
    last_sync_summary JSONB,
    created_at        TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, env, institution_name, status, error_code, last_synced_at, last_sync_summary, created_at
    FROM public.plaid_items
    WHERE user_id = auth.uid() AND status <> 'removed'
    ORDER BY created_at;
$$;

REVOKE ALL ON FUNCTION public.get_plaid_connections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_plaid_connections() TO authenticated;

-- ── 6. Suggested cutover date ────────────────────────────────────────────────
-- The latest date already in bronze for one account, from CSV uploads or the
-- EasyWeb sync (not Plaid). The suggested cutover is the day after it.
-- Handles both ISO and legacy MM/DD/YYYY dates in raw_data.
CREATE OR REPLACE FUNCTION public.latest_non_plaid_bronze_date(p_user_id UUID, p_account TEXT)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, bronze
AS $$
DECLARE
    v_date DATE;
BEGIN
    -- The service role (auth.uid() IS NULL) may ask about anyone; users only about themselves.
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Not allowed.';
    END IF;

    SELECT MAX(
        CASE
            WHEN raw_data->>'Date' ~ '^\d{4}-\d{2}-\d{2}' THEN substr(raw_data->>'Date', 1, 10)::date
            WHEN raw_data->>'Date' ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN to_date(raw_data->>'Date', 'MM/DD/YYYY')
        END
    )
    INTO v_date
    FROM bronze.transactions
    WHERE user_id = p_user_id
      AND transaction_account = p_account
      AND source <> 'plaid';

    RETURN v_date;
END;
$$;

REVOKE ALL ON FUNCTION public.latest_non_plaid_bronze_date(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.latest_non_plaid_bronze_date(UUID, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Bank sync activity: a history of Plaid syncs, and the schedule they run on.
--
-- Shown on Transaction Uploads → Bank sync. plaid-sync, plaid-webhook and
-- plaid-link write one row per sync of one connection.
--
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS public.plaid_sync_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plaid_item_id UUID NOT NULL REFERENCES public.plaid_items(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trigger       TEXT NOT NULL CHECK (trigger IN ('schedule', 'webhook', 'manual', 'reconnect')),
    ok            BOOLEAN NOT NULL,
    inserted      INT NOT NULL DEFAULT 0,
    updated       INT NOT NULL DEFAULT 0,
    removed       INT NOT NULL DEFAULT 0,
    summary       JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plaid_sync_runs_user_time
    ON public.plaid_sync_runs (user_id, created_at DESC);

ALTER TABLE public.plaid_sync_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plaid_sync_runs FROM anon, authenticated;
GRANT SELECT ON public.plaid_sync_runs TO authenticated;

DROP POLICY IF EXISTS "Users can view their own sync history" ON public.plaid_sync_runs;
CREATE POLICY "Users can view their own sync history"
    ON public.plaid_sync_runs FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- The schedule plaid-sync runs on (pg_cron), so the page can show when the
-- next sync is. Read-only; returns NULL if the job doesn't exist.
CREATE OR REPLACE FUNCTION public.get_plaid_sync_schedule()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT schedule FROM cron.job WHERE jobname = 'plaid-sync' AND active LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_plaid_sync_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_plaid_sync_schedule() TO authenticated;

NOTIFY pgrst, 'reload schema';

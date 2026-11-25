-- Who may use Plaid bank sync.
--
-- The Trial plan allows 10 bank connections, ever (removing one doesn't give
-- the slot back), so connecting a bank is limited to the emails in this table.
--
-- To give or remove access: add or delete a row in the Supabase Table Editor
-- (public.plaid_access). No code change or deploy needed.
--
-- Enforced on the server: plaid-link refuses to create a connection token, and
-- plaid-sync refuses Sync now, for anyone not listed. The dashboard also hides
-- the Plaid UI for them, via has_plaid_access().
--
-- Nobody can add themselves: RLS is on with no client policies, so the table is
-- readable only through has_plaid_access(), which answers for the caller alone.
-- The email comes from the signed-in user's JWT; Supabase emails are unique and
-- changing one has to be confirmed from that inbox.
--
-- Removing someone stops new connections and Sync now. A connection they
-- already made keeps syncing on the schedule (and still holds its slot);
-- disconnect it from their Settings or via plaid_items if needed.
--
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS public.plaid_access (
    email      TEXT PRIMARY KEY CHECK (email = lower(email)),
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.plaid_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plaid_access FROM anon, authenticated;

INSERT INTO public.plaid_access (email, note) VALUES
    ('shanemweinberger@gmail.com', 'Owner, personal account'),
    ('dev.shanewein@gmail.com', 'Owner, development account')
ON CONFLICT (email) DO NOTHING;

-- True if the signed-in user may use Plaid. SECURITY DEFINER so it can read the
-- table the caller can't; it only ever reveals the caller's own answer.
CREATE OR REPLACE FUNCTION public.has_plaid_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.plaid_access
        WHERE email = lower(COALESCE(auth.jwt() ->> 'email', ''))
    );
$$;

REVOKE ALL ON FUNCTION public.has_plaid_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_plaid_access() TO authenticated;

NOTIFY pgrst, 'reload schema';

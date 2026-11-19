-- Keep rule-deleted rows in bronze instead of removing them.
--
-- process-transactions used to physically DELETE bronze rows that the AI put
-- in the "delete" category (via a user rule). Those rows then couldn't be
-- matched by duplicate detection, so every overlapping upload or TD sync
-- re-imported them and the rule deleted them again, costing tokens each time.
--
-- Now they're kept with status = 'deleted': duplicate detection still sees
-- them, while the upload screens and silver ignore them.
--
-- Idempotent: safe to run more than once (e.g. once in the SQL editor and
-- again later via `supabase db push`).

DO $$
DECLARE c text;
BEGIN
    -- The original inline CHECK is auto-named; drop whichever check covers status.
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'bronze.transactions'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE bronze.transactions DROP CONSTRAINT %I', c);
    END LOOP;
END $$;

ALTER TABLE bronze.transactions
    ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('pending', 'processing', 'processed', 'error', 'deleted'));

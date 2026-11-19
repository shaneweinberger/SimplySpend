-- Transaction splits: divide one bank transaction into several categorizable parts.
--
-- Motivating case: a friend reimburses you $75 in a single transfer that is really
-- $50 of dinner plus $25 of an Uber. The bank only ever shows the $75, so the money
-- lands in one category when it belongs in two.
--
-- ── Design ───────────────────────────────────────────────────────────────────
-- No new table. A split part IS a transaction — it needs a category, a secondary
-- category, a description, and it has to show up in every chart and filter the app
-- already has. Giving parts their own table would mean teaching every consumer
-- (Overview, Analysis, the breakdown panels, filters, sorting) about a second
-- source of rows. Instead parts are ordinary `silver_transactions` rows:
--
--   split_parent_id → the original row this part was carved out of (NULL = normal row)
--   split_index     → stable display order within a split
--   is_split        → TRUE on the *original* row once it has been divided
--
-- The original row is kept, not deleted: it is the lineage back to `bronze_id`
-- (which is UNIQUE, so parts must carry bronze_id = NULL) and it is what "remove
-- split" restores. It is marked `is_split = true` and every read path filters it
-- out, so the money is counted exactly once — by the parts.
--
-- The invariant "parts sum to the original" is enforced in split_transaction()
-- below, which is the only supported write path.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.silver_transactions
    ADD COLUMN IF NOT EXISTS split_parent_id UUID
        REFERENCES public.silver_transactions(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS split_index SMALLINT,
    ADD COLUMN IF NOT EXISTS is_split BOOLEAN NOT NULL DEFAULT false;

-- A part can never itself be split — splits are one level deep. split_transaction()
-- enforces this by always resolving to the root, this makes it structural.
ALTER TABLE public.silver_transactions
    DROP CONSTRAINT IF EXISTS silver_transactions_split_depth_check;
ALTER TABLE public.silver_transactions
    ADD CONSTRAINT silver_transactions_split_depth_check
    CHECK (NOT (is_split AND split_parent_id IS NOT NULL));

-- Parts are always fetched by parent; originals are always filtered out by is_split.
CREATE INDEX IF NOT EXISTS idx_silver_split_parent
    ON public.silver_transactions (split_parent_id)
    WHERE split_parent_id IS NOT NULL;

-- ── 2. Split a transaction ───────────────────────────────────────────────────
-- p_parts: [{ "amount": 50.00, "description": "Dinner", "category": "Dining Out" }, …]
--
-- Amounts are signed and must sum EXACTLY to the original, and every part must run
-- in the same direction as the original (you cannot turn part of an expense into
-- income). Re-running this on an already-split transaction replaces its parts, so
-- the same call powers both "split" and "edit split".
--
-- SECURITY INVOKER: RLS scopes every statement to the caller's own rows.
CREATE OR REPLACE FUNCTION public.split_transaction(p_transaction_id UUID, p_parts JSONB)
RETURNS SETOF public.silver_transactions
LANGUAGE plpgsql
AS $$
DECLARE
    v_root_id UUID;
    v_parent  public.silver_transactions%ROWTYPE;
    v_count   INT;
    v_sum     NUMERIC;
BEGIN
    IF p_parts IS NULL OR jsonb_typeof(p_parts) <> 'array' THEN
        RAISE EXCEPTION 'Split parts must be a JSON array.';
    END IF;

    -- Splitting a part means re-splitting the transaction it came from.
    SELECT COALESCE(split_parent_id, id) INTO v_root_id
    FROM public.silver_transactions
    WHERE id = p_transaction_id;

    IF v_root_id IS NULL THEN
        RAISE EXCEPTION 'Transaction not found.';
    END IF;

    SELECT * INTO v_parent
    FROM public.silver_transactions
    WHERE id = v_root_id
    FOR UPDATE;

    IF v_parent.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Transaction not found.';
    END IF;

    v_count := jsonb_array_length(p_parts);
    IF v_count < 2 THEN
        RAISE EXCEPTION 'A split needs at least 2 parts.';
    END IF;
    IF v_count > 50 THEN
        RAISE EXCEPTION 'A transaction can be split into at most 50 parts.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_parts) AS part
        WHERE part->>'amount' IS NULL
           OR ROUND((part->>'amount')::NUMERIC, 2) = 0
    ) THEN
        RAISE EXCEPTION 'Every part of a split needs a non-zero amount.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_parts) AS part
        WHERE SIGN(ROUND((part->>'amount')::NUMERIC, 2)) <> SIGN(ROUND(v_parent.amount, 2))
    ) THEN
        RAISE EXCEPTION 'Every part must run the same direction as the original transaction.';
    END IF;

    SELECT SUM(ROUND((part->>'amount')::NUMERIC, 2)) INTO v_sum
    FROM jsonb_array_elements(p_parts) AS part;

    IF v_sum <> ROUND(v_parent.amount, 2) THEN
        RAISE EXCEPTION 'Split parts total % but the transaction is %.', v_sum, ROUND(v_parent.amount, 2);
    END IF;

    -- Replace any previous parts, then mark the original as split before inserting
    -- so the row is never briefly visible alongside its own parts.
    DELETE FROM public.silver_transactions WHERE split_parent_id = v_parent.id;

    UPDATE public.silver_transactions
    SET is_split = true, is_edited = true
    WHERE id = v_parent.id;

    RETURN QUERY
    INSERT INTO public.silver_transactions (
        bronze_id,
        user_id,
        transaction_date,
        recognized_date,
        description,
        amount,
        category,
        transaction_type,
        transaction_account,
        secondary_categories,
        is_edited,
        split_parent_id,
        split_index
    )
    SELECT
        NULL,                                   -- lineage to bronze lives on the original
        v_parent.user_id,
        v_parent.transaction_date,
        v_parent.recognized_date,
        COALESCE(NULLIF(TRIM(part->>'description'), ''), v_parent.description),
        ROUND((part->>'amount')::NUMERIC, 2),
        NULLIF(TRIM(COALESCE(part->>'category', '')), ''),
        v_parent.transaction_type,              -- same direction, enforced above
        v_parent.transaction_account,
        CASE
            WHEN jsonb_typeof(part->'secondary_categories') = 'array'
                THEN part->'secondary_categories'
            ELSE v_parent.secondary_categories  -- parts inherit the original's tags
        END,
        true,
        v_parent.id,
        (idx - 1)::SMALLINT
    FROM jsonb_array_elements(p_parts) WITH ORDINALITY AS t(part, idx)
    RETURNING *;
END;
$$;

-- ── 3. Undo a split ──────────────────────────────────────────────────────────
-- Drops every part and restores the original row to visibility. Accepts either the
-- original's id or any of its parts' ids.
CREATE OR REPLACE FUNCTION public.unsplit_transaction(p_transaction_id UUID)
RETURNS public.silver_transactions
LANGUAGE plpgsql
AS $$
DECLARE
    v_root_id UUID;
    v_parent  public.silver_transactions%ROWTYPE;
BEGIN
    SELECT COALESCE(split_parent_id, id) INTO v_root_id
    FROM public.silver_transactions
    WHERE id = p_transaction_id;

    IF v_root_id IS NULL THEN
        RAISE EXCEPTION 'Transaction not found.';
    END IF;

    DELETE FROM public.silver_transactions WHERE split_parent_id = v_root_id;

    UPDATE public.silver_transactions
    SET is_split = false
    WHERE id = v_root_id
    RETURNING * INTO v_parent;

    IF v_parent.id IS NULL THEN
        RAISE EXCEPTION 'Transaction not found.';
    END IF;

    RETURN v_parent;
END;
$$;

GRANT EXECUTE ON FUNCTION public.split_transaction(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unsplit_transaction(UUID) TO authenticated;

-- ── 4. Refresh PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

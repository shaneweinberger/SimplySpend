-- Split parts can each carry their own date.
--
-- Motivating case: a single reimbursement deposit covers expenses spread over
-- several days (flight Monday, hotel Tuesday, dinner Wednesday). Each part should
-- land on the day the money was actually spent.
--
-- ── Design ───────────────────────────────────────────────────────────────────
-- A part's date is stored as its `recognized_date` — the same override the
-- transaction table's date column already writes — so `effective_date` (and with
-- it every chart, filter and month bucket) follows it, while `transaction_date`
-- keeps the bank's date as lineage. The table's "Original / Recognized" tooltip
-- then shows both for free.
--
--   part.date omitted              → inherit the original's recognized_date (old behaviour)
--   part.date = original bank date → recognized_date NULL (no override to show)
--   part.date = anything else      → recognized_date = part.date
--
-- Only split_transaction() changes; this replaces the version from
-- 20260727120000_add_transaction_splits.sql with the date handling added.

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

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_parts) AS part
        WHERE NULLIF(TRIM(COALESCE(part->>'date', '')), '') IS NOT NULL
          AND TRIM(part->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
    ) THEN
        RAISE EXCEPTION 'Split part dates must be in YYYY-MM-DD format.';
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
        v_parent.transaction_date,              -- the bank's date, kept as lineage
        CASE
            WHEN part_date IS NULL THEN v_parent.recognized_date
            WHEN part_date = v_parent.transaction_date THEN NULL
            ELSE part_date
        END,
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
    FROM jsonb_array_elements(p_parts) WITH ORDINALITY AS t(part, idx),
         LATERAL (SELECT NULLIF(TRIM(COALESCE(part->>'date', '')), '')::DATE AS part_date) AS d
    RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.split_transaction(UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';

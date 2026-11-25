-- Budgets: a monthly spending plan, built from what you already spend.
--
-- ── Design ───────────────────────────────────────────────────────────────────
-- The plan starts from spending, not income. Many users (students especially)
-- have no income for months at a time, so a plan rooted in income would not
-- work for them. A plan is simply: which categories you budget, how much per
-- month, and whether each is a Need or a Want.
--
--   budget_categories → one row per budgeted category. Keyed by category_id so a
--                       category rename carries through; transactions still match
--                       by the category's current name.
--   budget_settings   → one row per user: the money that comes in each month
--                       (income, family, loans) and an optional savings balance.
--                       Whatever the inflows don't cover is drawn from savings,
--                       which is how the app works out a savings runway.
--
-- Amounts are always monthly. A category tracked weekly still stores its monthly
-- amount; the weekly allowance is derived (monthly × 12 ÷ 52), so the plan always
-- adds up to one monthly total.
--
-- Safe to run twice.

-- ── 1. Budgeted categories ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_categories (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id  UUID NOT NULL REFERENCES public.user_categories(id) ON DELETE CASCADE,
    amount       NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    bucket       TEXT NOT NULL DEFAULT 'wants' CHECK (bucket IN ('needs', 'wants')),
    cadence      TEXT NOT NULL DEFAULT 'month' CHECK (cadence IN ('month', 'week')),
    is_fixed     BOOLEAN NOT NULL DEFAULT false,   -- a bill: shown as Paid / Due, not a bar
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, category_id)
);

ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own budget categories" ON public.budget_categories;
CREATE POLICY "Users can manage their own budget categories"
    ON public.budget_categories
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
        -- You can only budget a category you own.
        AND EXISTS (
            SELECT 1 FROM public.user_categories uc
            WHERE uc.id = category_id AND uc.user_id = auth.uid()
        )
    );

DROP TRIGGER IF EXISTS update_budget_categories_updated_at ON public.budget_categories;
CREATE TRIGGER update_budget_categories_updated_at
    BEFORE UPDATE ON public.budget_categories
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ── 2. Per-user settings ─────────────────────────────────────────────────────
-- inflows: [{ "label": "Family", "amount": 420 }, …] — monthly, all optional.
CREATE TABLE IF NOT EXISTS public.budget_settings (
    user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    inflows                 JSONB NOT NULL DEFAULT '[]'::jsonb
                            CHECK (jsonb_typeof(inflows) = 'array'),
    savings_balance         NUMERIC(12, 2) CHECK (savings_balance IS NULL OR savings_balance >= 0),
    savings_balance_as_of   DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.budget_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own budget settings" ON public.budget_settings;
CREATE POLICY "Users can manage their own budget settings"
    ON public.budget_settings
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_budget_settings_updated_at ON public.budget_settings;
CREATE TRIGGER update_budget_settings_updated_at
    BEFORE UPDATE ON public.budget_settings
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

NOTIFY pgrst, 'reload schema';

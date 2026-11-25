import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useSessionState } from '../../hooks/useSessionState';
import {
    funding, guessBucket, isExcludedCategory, monthPeriod, spendInRange,
    spendingHistory, suggestAmount, weekPeriod,
} from '../../utils/budget';
import ThisMonth from './budgeting/ThisMonth';
import PlanView from './budgeting/PlanView';
import SetupPlan from './budgeting/SetupPlan';
import { SegmentedControl } from './budgeting/parts';

const HISTORY_MONTHS = 3;
const PAGE_SIZE = 1000; // PostgREST's max rows per request

function isMissingTable(error) {
    if (!error) return false;
    if (error.code === '42P01' || error.code === 'PGRST205') return true;
    return /budget_(categories|settings)/.test(error.message || '') && /does not exist|schema cache/.test(error.message || '');
}

async function fetchTransactionsSince(start) {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
            .from('silver_transactions')
            .select('id, effective_date, description, amount, category, is_split')
            .gte('effective_date', start)
            .order('effective_date', { ascending: false })
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) return rows;
    }
}

export default function Budgeting() {
    const [view, setView] = useSessionState('budgeting.view', 'month');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [needsMigration, setNeedsMigration] = useState(false);

    const [userId, setUserId] = useState(null);
    const [categories, setCategories] = useState([]);
    const [budgetRows, setBudgetRows] = useState([]);
    const [settings, setSettings] = useState(null); // null = no plan yet
    const [transactions, setTransactions] = useState([]);

    // Fixed for the life of the page so every number agrees on what "today" is.
    const [today] = useState(() => new Date());
    const month = useMemo(() => monthPeriod(today), [today]);
    const week = useMemo(() => weekPeriod(today), [today]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('You need to be signed in.');
            setUserId(user.id);

            const historyStart = new Date(today.getFullYear(), today.getMonth() - HISTORY_MONTHS, 1, 12);
            const since = `${historyStart.getFullYear()}-${String(historyStart.getMonth() + 1).padStart(2, '0')}-01`;

            const [cats, budgets, prefs, txs] = await Promise.all([
                supabase.from('user_categories').select('id, name, color, order_index').order('order_index'),
                supabase.from('budget_categories').select('*'),
                supabase.from('budget_settings').select('*').maybeSingle(),
                fetchTransactionsSince(since),
            ]);
            if (isMissingTable(budgets.error) || isMissingTable(prefs.error)) {
                setNeedsMigration(true);
                return;
            }
            for (const r of [cats, budgets, prefs]) if (r.error) throw r.error;

            setCategories(cats.data || []);
            setBudgetRows(budgets.data || []);
            setSettings(prefs.data || (budgets.data?.length ? { inflows: [], savings_balance: null } : null));
            setTransactions(txs);
        } catch (err) {
            console.error('Error loading budget:', err);
            setError(err.message || 'Something went wrong loading your budget.');
        } finally {
            setLoading(false);
        }
    }, [today]);

    useEffect(() => { load(); }, [load]);

    // ── Derived numbers ──────────────────────────────────────────────────────
    const categoriesById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
    const categoriesByName = useMemo(() => new Map(categories.map(c => [c.name, c])), [categories]);

    const history = useMemo(() => spendingHistory(transactions, today, HISTORY_MONTHS), [transactions, today]);
    const thisMonth = useMemo(() => spendInRange(transactions, month.start, month.end), [transactions, month]);
    const thisWeek = useMemo(() => spendInRange(transactions, week.start, week.end), [transactions, week]);

    // Budget rows joined to their category's current name and color.
    const budgets = useMemo(() => (
        budgetRows
            .filter(b => categoriesById.has(b.category_id))
            .map(b => ({ ...b, amount: Number(b.amount), name: categoriesById.get(b.category_id).name, color: categoriesById.get(b.category_id).color }))
            .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    ), [budgetRows, categoriesById]);

    const plannedTotal = useMemo(() => budgets.reduce((s, b) => s + b.amount, 0), [budgets]);
    const fund = useMemo(() => funding({
        planTotal: plannedTotal,
        inflows: settings?.inflows,
        savingsBalance: settings?.savings_balance,
        today,
    }), [plannedTotal, settings, today]);

    const unbudgeted = useMemo(() => {
        const planned = new Set(budgets.map(b => b.category_id));
        return categories
            .filter(c => !planned.has(c.id) && !isExcludedCategory(c.name))
            .map(c => ({ ...c, usual: history.byCategory.get(c.name)?.usual || 0 }))
            .sort((a, b) => b.usual - a.usual || a.name.localeCompare(b.name));
    }, [categories, budgets, history]);

    // ── Writes (optimistic, rolled back on failure) ──────────────────────────
    const fail = (err) => {
        console.error('Budget save failed:', err);
        setError(err.message || "Couldn't save that change. Try again.");
    };

    const saveSettings = async (patch) => {
        const prev = settings;
        const next = { inflows: [], savings_balance: null, ...settings, ...patch };
        setSettings(next);
        const { error: err } = await supabase
            .from('budget_settings')
            .upsert({ user_id: userId, inflows: next.inflows, savings_balance: next.savings_balance, savings_balance_as_of: next.savings_balance_as_of ?? null }, { onConflict: 'user_id' });
        if (err) { setSettings(prev); fail(err); }
    };

    const insertBudgets = async (rows) => {
        if (!rows.length) return [];
        const { data, error: err } = await supabase
            .from('budget_categories')
            .insert(rows.map(r => ({ user_id: userId, category_id: r.id, amount: r.amount, bucket: r.bucket })))
            .select();
        if (err) throw err;
        return data || [];
    };

    const createPlan = async (rows) => {
        try {
            const inserted = await insertBudgets(rows);
            const { error: err } = await supabase
                .from('budget_settings')
                .upsert({ user_id: userId }, { onConflict: 'user_id' });
            if (err) throw err;
            setBudgetRows(inserted);
            setSettings({ inflows: [], savings_balance: null });
            setView('plan');
        } catch (err) { fail(err); }
    };

    const addBudget = async (category) => {
        const usual = history.byCategory.get(category.name)?.usual || 0;
        const spentNow = Math.max(0, thisMonth.byCategory.get(category.name) || 0);
        const amount = suggestAmount(usual) || suggestAmount(spentNow);
        try {
            const inserted = await insertBudgets([{ id: category.id, amount, bucket: guessBucket(category.name) }]);
            setBudgetRows(prev => [...prev, ...inserted]);
        } catch (err) { fail(err); }
    };

    const updateBudget = async (id, patch) => {
        const prev = budgetRows;
        setBudgetRows(rows => rows.map(r => (r.id === id ? { ...r, ...patch } : r)));
        const { error: err } = await supabase.from('budget_categories').update(patch).eq('id', id);
        if (err) { setBudgetRows(prev); fail(err); }
    };

    const removeBudget = async (id) => {
        const prev = budgetRows;
        setBudgetRows(rows => rows.filter(r => r.id !== id));
        const { error: err } = await supabase.from('budget_categories').delete().eq('id', id);
        if (err) { setBudgetRows(prev); fail(err); }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    const hasPlan = settings !== null;

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Budgeting</h1>
                    <p className="text-slate-500 mt-1">Your monthly plan, and how this month is going.</p>
                </div>
                {hasPlan && !loading && !needsMigration && (
                    <SegmentedControl
                        value={view}
                        onChange={setView}
                        options={[{ id: 'month', label: 'This month' }, { id: 'plan', label: 'Plan' }]}
                    />
                )}
            </header>

            {error && (
                <div className="flex items-center gap-3 px-4 py-3 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl">
                    <AlertCircle size={16} className="shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-rose-400 hover:text-rose-600"><X size={14} /></button>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-64 text-slate-400">
                    <Loader2 className="animate-spin" size={22} />
                </div>
            ) : needsMigration ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-7 py-6 max-w-2xl">
                    <h2 className="text-lg font-semibold text-slate-900">Budgets need a database update</h2>
                    <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                        Run <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-700">supabase/migrations/20261125120000_budgets.sql</code> in the Supabase SQL editor, then reload this page.
                    </p>
                </div>
            ) : !hasPlan ? (
                <SetupPlan
                    categories={categories.filter(c => !isExcludedCategory(c.name))}
                    history={history}
                    onCreate={createPlan}
                />
            ) : view === 'plan' ? (
                <PlanView
                    budgets={budgets}
                    history={history}
                    plannedTotal={plannedTotal}
                    settings={settings}
                    fund={fund}
                    unbudgeted={unbudgeted}
                    onUpdateBudget={updateBudget}
                    onRemoveBudget={removeBudget}
                    onAddBudget={addBudget}
                    onSaveSettings={saveSettings}
                />
            ) : budgets.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-7 py-6">
                    <h2 className="text-lg font-semibold text-slate-900">Add your first budget</h2>
                    <p className="text-sm text-slate-500 mt-1.5">Pick the categories you want to keep an eye on, and this view will show how each one is tracking.</p>
                    <button type="button" onClick={() => setView('plan')} className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-accent rounded-xl hover:opacity-90">
                        Open plan
                    </button>
                </div>
            ) : (
                <ThisMonth
                    budgets={budgets}
                    month={month}
                    week={week}
                    monthSpend={thisMonth.byCategory}
                    weekSpend={thisWeek.byCategory}
                    monthTotal={thisMonth.total}
                    plannedTotal={plannedTotal}
                    history={history}
                    fund={fund}
                    transactions={transactions}
                    categoriesByName={categoriesByName}
                    onAddToPlan={(name) => { const c = categoriesByName.get(name); if (c) addBudget(c); }}
                />
            )}
        </div>
    );
}

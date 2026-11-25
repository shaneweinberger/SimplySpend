import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Landmark, RefreshCw, Loader2, CheckCircle2, AlertCircle, Clock, History, Inbox, RotateCcw, Settings as SettingsIcon, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useProcessing } from '../../lib/ProcessingContext';
import { planReprocess, runReprocess } from '../../lib/reprocessRange';

// Transaction Uploads → Bank sync: what Plaid has pulled in, what's being
// categorized right now, and re-categorizing a date range after rule changes.
// Connecting and mapping banks stays in Settings → Connected banks.

const STATUS = {
    ok: { label: 'Syncing', cls: 'bg-emerald-50 text-emerald-700' },
    needs_reauth: { label: 'Reconnect needed', cls: 'bg-amber-50 text-amber-700' },
    error: { label: 'Not syncing', cls: 'bg-rose-50 text-rose-600' },
};

const TRIGGER = {
    schedule: 'Scheduled',
    webhook: 'From bank',
    manual: 'Sync now',
    reconnect: 'Reconnect',
};

const HISTORY_PAGE = 20;

function timeAgo(iso) {
    if (!iso) return 'never';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'yesterday' : `${days} days ago`;
}

function fullTime(iso) {
    return iso ? new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

/** "Nov 25, 3:07 p.m." */
function shortTime(iso) {
    return new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function money(amount) {
    const n = Number(amount);
    return `${n > 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`;
}

function shortDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

/** Next run of a pg_cron schedule like "7 *\/4 * * *" (UTC). Null if it's another shape. */
function nextScheduledRun(schedule, now = new Date()) {
    const m = schedule?.trim().match(/^(\d{1,2})\s+(\*|\*\/(\d{1,2}))\s+\*\s+\*\s+\*$/);
    if (!m) return null;
    const minute = Number(m[1]);
    const step = m[3] ? Number(m[3]) : 1;
    const start = new Date(now);
    start.setUTCMinutes(0, 0, 0);
    for (let h = 0; h <= 48; h++) {
        const c = new Date(start.getTime() + h * 3600 * 1000);
        c.setUTCMinutes(minute);
        if (c > now && c.getUTCHours() % step === 0) return { at: c, everyHours: step };
    }
    return null;
}

function Card({ icon, title, action, children }) {
    const Icon = icon;
    return (
        <section className="bg-surface-card rounded-xl border border-divider shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-divider flex items-center gap-2">
                <Icon size={15} className="text-slate-400" />
                <h2 className="text-sm font-bold text-slate-800">{title}</h2>
                {action && <div className="ml-auto">{action}</div>}
            </div>
            {children}
        </section>
    );
}

export default function BankSyncActivity() {
    const { startProcessing, stopProcessing, getAbortSignal } = useProcessing();
    const [userId, setUserId] = useState(null);
    const [connections, setConnections] = useState([]);
    const [schedule, setSchedule] = useState(null);
    const [queue, setQueue] = useState({ pending: 0, processing: 0 });
    const [runs, setRuns] = useState([]);
    const [runsMissing, setRunsMissing] = useState(false);
    const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);
    const [recent, setRecent] = useState([]);
    const [accountNames, setAccountNames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const fastUntil = useRef(0);

    // Reprocess form
    const today = new Date().toISOString().slice(0, 10);
    const [rp, setRp] = useState({ from: '', to: today, account: '', skipEdited: true });
    const [plan, setPlan] = useState(null);
    const [planning, setPlanning] = useState(false);

    const load = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const bronzeCount = (status) => supabase.schema('bronze').from('transactions')
            .select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', status);

        const [conn, sched, pending, processing, history, arrivals, names] = await Promise.all([
            supabase.rpc('get_plaid_connections'),
            supabase.rpc('get_plaid_sync_schedule'),
            bronzeCount('pending'),
            bronzeCount('processing'),
            supabase.from('plaid_sync_runs')
                .select('id, plaid_item_id, trigger, ok, inserted, updated, removed, summary, created_at')
                .order('created_at', { ascending: false }).limit(historyLimit),
            supabase.schema('bronze').from('transactions')
                .select('id, transaction_account, status, raw_data, created_at')
                .eq('user_id', user.id).eq('source', 'plaid')
                .order('created_at', { ascending: false }).limit(25),
            supabase.from('user_accounts').select('account_name').eq('user_id', user.id),
        ]);

        setConnections(conn.data || []);
        setSchedule(sched.error ? null : sched.data);
        setQueue({ pending: pending.count || 0, processing: processing.count || 0 });
        setRunsMissing(Boolean(history.error));
        setRuns(history.data || []);
        setAccountNames((names.data || []).map((r) => r.account_name).sort());

        const rows = arrivals.data || [];
        const silver = new Map();
        if (rows.length) {
            const { data } = await supabase.from('silver_transactions')
                .select('bronze_id, description, category, is_pending')
                .in('bronze_id', rows.map((r) => r.id));
            for (const s of data || []) silver.set(s.bronze_id, s);
        }
        setRecent(rows.map((r) => ({ ...r, silver: silver.get(r.id) || null })));
    }, [historyLimit]);

    // Refresh every 30 s, or every 5 s while something is being categorized or
    // just after Sync now (new rows can take a few minutes to arrive).
    useEffect(() => {
        let alive = true;
        let timer;
        const tick = async () => {
            try { await load(); } catch (err) { console.error('Bank sync load failed', err); }
            if (!alive) return;
            setLoading(false);
            const busy = Date.now() < fastUntil.current;
            timer = setTimeout(tick, busy ? 5000 : 30000);
        };
        tick();
        return () => { alive = false; clearTimeout(timer); };
    }, [load]);

    const inFlight = queue.pending + queue.processing;
    useEffect(() => {
        if (inFlight > 0) fastUntil.current = Math.max(fastUntil.current, Date.now() + 10000);
    }, [inFlight]);

    const syncNow = async (itemId) => {
        setSyncing(itemId);
        setMessage({ type: '', text: '' });
        try {
            const { data, error } = await supabase.functions.invoke('plaid-sync', { body: { plaid_item_id: itemId, refresh: true } });
            if (error) {
                let body = null;
                try { body = await error.context?.json(); } catch { /* not JSON */ }
                throw new Error(body?.error || error.message);
            }
            const s = data?.summaries?.[0];
            if (s && !s.ok) setMessage({ type: 'error', text: s.message || 'Sync failed.' });
            else if (data?.new_transactions) setMessage({ type: 'success', text: `${data.new_transactions} new transaction${data.new_transactions === 1 ? '' : 's'}. Categorizing now.` });
            else setMessage({ type: 'success', text: 'Up to date. Your bank was asked to check again; anything new usually arrives within a few minutes.' });
            fastUntil.current = Date.now() + 3 * 60 * 1000;
            await load();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSyncing(null);
        }
    };

    const preview = async () => {
        setPlanning(true);
        setPlan(null);
        setMessage({ type: '', text: '' });
        try {
            const p = await planReprocess({ userId, from: rp.from, to: rp.to, account: rp.account || undefined, skipEdited: rp.skipEdited });
            setPlan(p);
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setPlanning(false);
        }
    };

    const reprocess = async () => {
        const n = plan.toRun.length;
        startProcessing(`Re-categorizing ${n} transaction${n === 1 ? '' : 's'} with your current categories and rules…`);
        const signal = getAbortSignal();
        try {
            const res = await runReprocess(plan, { userId, signal });
            if (res.tokenLimit) {
                setMessage({ type: 'error', text: `Stopped at your AI processing limit after ${res.processed} transactions. The rest stay queued and are categorized after the limit resets.` });
            } else if (signal.cancelled) {
                setMessage({ type: 'error', text: `Cancelled after ${res.processed} transactions. The rest stay queued and are categorized on the next sync.` });
            } else {
                setMessage({ type: 'success', text: `Re-categorized ${res.processed} transaction${res.processed === 1 ? '' : 's'}.${res.restoreFailures ? ` ${res.restoreFailures} secondary categories couldn't be restored.` : ''}` });
            }
            setPlan(null);
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            stopProcessing();
            await load().catch(() => {});
        }
    };

    const itemName = useMemo(() => Object.fromEntries(connections.map((c) => [c.id, c.institution_name || 'Bank'])), [connections]);
    const next = nextScheduledRun(schedule);
    const rangeValid = rp.from && rp.to && rp.from <= rp.to;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Loading bank sync…</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {message.text && (
                <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${message.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                    {message.type === 'success' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
                    <span>{message.text}</span>
                    <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto opacity-60 hover:opacity-100" title="Dismiss"><X size={14} /></button>
                </div>
            )}

            {/* ── Connections + live status ─────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
                <Card icon={Landmark} title="Connected banks" action={
                    <Link to="/dashboard/settings" className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
                        <SettingsIcon size={12} /> Manage
                    </Link>
                }>
                    {connections.length === 0 ? (
                        <div className="px-5 py-8 text-center">
                            <p className="text-sm font-medium text-slate-700">No banks connected</p>
                            <p className="text-sm text-slate-400 mt-1">Connect one in <Link to="/dashboard/settings" className="text-accent font-semibold">Settings → Connected banks</Link>.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-divider">
                            {connections.map((c) => {
                                const st = STATUS[c.status] || STATUS.error;
                                return (
                                    <li key={c.id} className="px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                                                {c.institution_name || 'Bank'}
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                                                {c.env === 'sandbox' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-600">SANDBOX</span>}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5" title={fullTime(c.last_synced_at)}>
                                                Last synced {timeAgo(c.last_synced_at)}
                                                {c.last_sync_summary?.message && !c.last_sync_summary?.ok ? ` · ${c.last_sync_summary.message}` : ''}
                                            </p>
                                        </div>
                                        <div className="ml-auto">
                                            {c.status === 'ok' ? (
                                                <button onClick={() => syncNow(c.id)} disabled={syncing !== null}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-divider text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                                                    <RefreshCw size={12} className={syncing === c.id ? 'animate-spin' : ''} /> Sync now
                                                </button>
                                            ) : (
                                                <Link to="/dashboard/settings" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                    Reconnect in Settings
                                                </Link>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>

                <Card icon={Clock} title="Right now">
                    <div className="px-5 py-4 space-y-3">
                        {inFlight > 0 ? (
                            <div className="flex items-center gap-2.5">
                                <Loader2 size={16} className="animate-spin text-accent shrink-0" />
                                <p className="text-sm text-slate-700">
                                    <span className="font-semibold">{inFlight}</span> transaction{inFlight === 1 ? '' : 's'} being categorized
                                    {queue.processing > 0 && queue.pending > 0 ? <span className="text-slate-400"> ({queue.processing} in this batch, {queue.pending} waiting)</span> : null}
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5">
                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                <p className="text-sm text-slate-700">Everything is categorized.</p>
                            </div>
                        )}
                        <p className="text-xs text-slate-500">
                            {next
                                ? <>Next scheduled sync <span className="font-semibold text-slate-700">{next.at.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}</span> · every {next.everyHours === 1 ? 'hour' : `${next.everyHours} hours`}, plus whenever your bank reports something new.</>
                                : schedule ? `Scheduled syncs: ${schedule} (UTC)` : 'Syncs whenever your bank reports something new.'}
                        </p>
                    </div>
                </Card>
            </div>

            {/* ── Recently arrived ─────────────────────────────────────── */}
            <Card icon={Inbox} title="Recently arrived">
                {recent.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-slate-400">Nothing has arrived from a bank yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-divider">
                                    <th className="px-5 py-2.5 font-semibold">Date</th>
                                    <th className="px-3 py-2.5 font-semibold">Description</th>
                                    <th className="px-3 py-2.5 font-semibold">Account</th>
                                    <th className="px-3 py-2.5 font-semibold">State</th>
                                    <th className="px-3 py-2.5 font-semibold text-right">Amount</th>
                                    <th className="px-5 py-2.5 font-semibold text-right">Arrived</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-divider">
                                {recent.map((r) => {
                                    const raw = r.raw_data || {};
                                    let state;
                                    if (raw.Plaid?.removed) state = <span className="text-xs text-slate-400">Removed by bank</span>;
                                    else if (r.status === 'deleted') state = <span className="text-xs text-slate-400">Removed by a rule</span>;
                                    else if (r.status === 'pending' || r.status === 'processing') state = <span className="inline-flex items-center gap-1 text-xs text-accent font-medium"><Loader2 size={11} className="animate-spin" /> Categorizing</span>;
                                    else if (r.status === 'error') state = <span className="text-xs text-rose-500 font-medium">Error</span>;
                                    else state = (
                                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{r.silver?.category || 'Uncategorized'}</span>
                                            {(r.silver?.is_pending ?? raw.Plaid?.pending) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">Pending</span>}
                                        </span>
                                    );
                                    return (
                                        <tr key={r.id} className={raw.Plaid?.removed || r.status === 'deleted' ? 'opacity-60' : ''}>
                                            <td className="px-5 py-2.5 text-slate-500 whitespace-nowrap">{shortDate(raw.Date)}</td>
                                            <td className="px-3 py-2.5 text-slate-900 font-medium max-w-[260px] truncate" title={raw.Description}>{r.silver?.description || raw.Description}</td>
                                            <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{r.transaction_account}</td>
                                            <td className="px-3 py-2.5">{state}</td>
                                            <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums ${Number(raw.Amount) > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>{money(raw.Amount)}</td>
                                            <td className="px-5 py-2.5 text-right text-xs text-slate-400 whitespace-nowrap" title={fullTime(r.created_at)}>{timeAgo(r.created_at)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* ── Sync history ─────────────────────────────────────────── */}
            <Card icon={History} title="Sync history">
                {runsMissing ? (
                    <p className="px-5 py-6 text-sm text-slate-400">Sync history isn&rsquo;t set up yet. Run the <code className="text-xs">20261125130000_plaid_sync_runs.sql</code> migration.</p>
                ) : runs.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-slate-400">No syncs recorded yet. The next one appears here.</p>
                ) : (
                    <>
                        <ul className="divide-y divide-divider">
                            {runs.map((run) => {
                                const s = run.summary || {};
                                const parts = [];
                                if (run.inserted) parts.push(`${run.inserted} new`);
                                if (run.updated) parts.push(`${run.updated} updated`);
                                if (run.removed) parts.push(`${run.removed} removed`);
                                const result = !run.ok
                                    ? <span className="text-rose-600">{s.waiting_for_mapping?.length ? s.message : `Failed${s.message ? `: ${s.message}` : ''}`}</span>
                                    : parts.length ? <span className="text-slate-800 font-medium">{parts.join(' · ')}</span>
                                    : <span className="text-slate-400">Nothing new</span>;
                                return (
                                    <li key={run.id} className="px-5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                        <span className="w-32 shrink-0 text-slate-500 tabular-nums" title={fullTime(run.created_at)}>{shortTime(run.created_at)}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{TRIGGER[run.trigger] || run.trigger}</span>
                                        <span className="text-xs text-slate-400 shrink-0">{itemName[run.plaid_item_id] || 'Bank'}</span>
                                        <span className="min-w-0 flex-1">{result}</span>
                                    </li>
                                );
                            })}
                        </ul>
                        {runs.length >= historyLimit && (
                            <div className="px-5 py-3 border-t border-divider">
                                <button onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE)} className="text-xs font-semibold text-accent hover:underline">Show older syncs</button>
                            </div>
                        )}
                    </>
                )}
            </Card>

            {/* ── Reprocess a date range ───────────────────────────────── */}
            <Card icon={RotateCcw} title="Re-categorize a date range">
                <div className="px-5 py-4 space-y-4">
                    <p className="text-sm text-slate-500">
                        Runs your current categories and rules again over every transaction in a range, from any source. Useful after you change a rule.
                        Split transactions are always left as they are.
                    </p>
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label htmlFor="rp-from" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">From</label>
                            <input id="rp-from" type="date" value={rp.from} max={rp.to || undefined}
                                onChange={(e) => { setRp((p) => ({ ...p, from: e.target.value })); setPlan(null); }}
                                className="px-3 py-2 rounded-lg border border-divider bg-white text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-accent-ring" />
                        </div>
                        <div>
                            <label htmlFor="rp-to" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">To</label>
                            <input id="rp-to" type="date" value={rp.to} min={rp.from || undefined}
                                onChange={(e) => { setRp((p) => ({ ...p, to: e.target.value })); setPlan(null); }}
                                className="px-3 py-2 rounded-lg border border-divider bg-white text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-accent-ring" />
                        </div>
                        <div>
                            <label htmlFor="rp-account" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Account</label>
                            <select id="rp-account" value={rp.account}
                                onChange={(e) => { setRp((p) => ({ ...p, account: e.target.value })); setPlan(null); }}
                                className="px-3 py-2 rounded-lg border border-divider bg-white text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-accent-ring">
                                <option value="">All accounts</option>
                                {accountNames.map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <label htmlFor="rp-skip" className="flex items-center gap-2 text-sm text-slate-700 pb-2 cursor-pointer">
                            <input id="rp-skip" type="checkbox" checked={rp.skipEdited}
                                onChange={(e) => { setRp((p) => ({ ...p, skipEdited: e.target.checked })); setPlan(null); }}
                                className="accent-accent" />
                            Skip transactions I&rsquo;ve edited
                        </label>
                        <button onClick={preview} disabled={!rangeValid || planning}
                            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-divider text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                            {planning && <Loader2 size={14} className="animate-spin" />} Preview
                        </button>
                    </div>

                    {plan && (
                        <div className="rounded-lg border border-divider bg-slate-50 px-4 py-3 flex flex-wrap items-center gap-3">
                            <p className="text-sm text-slate-700 flex-1 min-w-[240px]">
                                {plan.toRun.length === 0
                                    ? 'Nothing to re-categorize in this range.'
                                    : <><span className="font-semibold">{plan.toRun.length}</span> transaction{plan.toRun.length === 1 ? '' : 's'} will be re-categorized.</>}
                                {(plan.skippedEdited > 0 || plan.skippedSplit > 0 || plan.inFlight > 0) && (
                                    <span className="text-slate-500">
                                        {' '}Skipping {[
                                            plan.skippedEdited ? `${plan.skippedEdited} you edited` : null,
                                            plan.skippedSplit ? `${plan.skippedSplit} split` : null,
                                            plan.inFlight ? `${plan.inFlight} already being categorized` : null,
                                        ].filter(Boolean).join(', ')}.
                                    </span>
                                )}
                                {!rp.skipEdited && plan.toRun.length > 0 && <span className="block text-amber-700 mt-1">Your manual edits in this range will be replaced.</span>}
                            </p>
                            {plan.toRun.length > 0 && (
                                <button onClick={reprocess}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover">
                                    <RotateCcw size={14} /> Re-categorize {plan.toRun.length}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

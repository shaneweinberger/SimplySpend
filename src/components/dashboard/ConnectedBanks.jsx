import React, { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import {
    Landmark, Plus, RefreshCw, Loader2, CheckCircle2, AlertCircle, AlertTriangle, Link2, Unplug, Save,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// Connected banks: link TD through Plaid, map each bank account to a SimplySpend
// account, and watch syncs. New transactions then flow through the same
// pipeline as a CSV upload (bronze → your rules and categories → silver).
// Plan: implementation-plans/plaid-sync.md

const card = { backgroundColor: '#2a2a2a', border: '1px solid #333' };
const inputStyle = { backgroundColor: '#1e1e1e', border: '1px solid #3a3a3a', color: '#e2e8f0' };
const labelClass = 'text-xs font-semibold uppercase tracking-wider block';

const STATUS = {
    ok: { label: 'Syncing', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    needs_reauth: { label: 'Reconnect needed', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    error: { label: 'Not syncing', color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
};

function nextDay(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function timeAgo(iso) {
    if (!iso) return 'never';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    return new Date(iso).toLocaleDateString();
}

function describeSummary(s) {
    if (!s) return null;
    if (s.waiting_for_mapping?.length) return s.message;
    if (!s.ok) return s.message ? `Last sync failed: ${s.message}` : 'Last sync failed.';
    const parts = [];
    if (s.inserted) parts.push(`${s.inserted} new`);
    if (s.updated) parts.push(`${s.updated} updated`);
    if (s.removed) parts.push(`${s.removed} removed`);
    return parts.length ? `Last sync: ${parts.join(', ')}.` : 'Last sync: nothing new.';
}

/** Readable message from a supabase.functions.invoke error. */
async function invokeError(error) {
    try {
        const body = await error.context?.json();
        return { code: body?.error, message: body?.message || body?.error || error.message };
    } catch {
        return { code: null, message: error.message };
    }
}

async function callLink(action, payload = {}) {
    const { data, error } = await supabase.functions.invoke('plaid-link', { body: { action, ...payload } });
    if (error) throw Object.assign(new Error('plaid-link failed'), await invokeError(error));
    return data;
}

export default function ConnectedBanks() {
    const [userId, setUserId] = useState(null);
    const [connections, setConnections] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [drafts, setDrafts] = useState({}); // plaid_account_id → { transaction_account, cutover_date, enabled }
    const [accountNames, setAccountNames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null); // what's running, e.g. 'connect', 'sync:<id>'
    const [status, setStatus] = useState({ type: '', message: '' });
    const [confirmExtra, setConfirmExtra] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(null);

    // Plaid Link: a token is fetched first, then Link opens once the script is ready.
    const [link, setLink] = useState({ token: null, mode: null, itemId: null });

    const load = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        const [conn, accts, names] = await Promise.all([
            supabase.rpc('get_plaid_connections'),
            supabase.from('plaid_accounts').select('*').order('created_at'),
            supabase.from('user_accounts').select('account_name').eq('user_id', user.id),
        ]);
        if (conn.error) throw conn.error;
        if (accts.error) throw accts.error;
        setConnections(conn.data || []);
        setAccounts(accts.data || []);
        setAccountNames((names.data || []).map((r) => r.account_name));
        setDrafts(Object.fromEntries((accts.data || []).map((a) => [a.plaid_account_id, {
            transaction_account: a.transaction_account || '',
            cutover_date: a.cutover_date || '',
            enabled: a.enabled,
        }])));
    }, []);

    useEffect(() => {
        load()
            .catch((err) => {
                console.error('Error loading connected banks:', err);
                setStatus({ type: 'error', message: 'Couldn’t load connected banks. Has the Plaid migration been applied?' });
            })
            .finally(() => setLoading(false));
    }, [load]);

    const say = (type, message) => setStatus({ type, message });

    const onSuccess = useCallback(async (publicToken, metadata) => {
        const { mode, itemId } = link;
        setLink({ token: null, mode: null, itemId: null });
        setBusy(mode === 'update' ? `sync:${itemId}` : 'connect');
        try {
            if (mode === 'update') {
                await callLink('reconnected', { plaid_item_id: itemId });
                say('success', 'Reconnected. New transactions are syncing.');
            } else {
                await callLink('exchange', { public_token: publicToken, institution: metadata?.institution });
                say('success', 'Connected. Check each account below, then press Save and sync.');
            }
            await load();
        } catch (err) {
            say('error', err.message);
        } finally {
            setBusy(null);
        }
    }, [link, load]);

    const onExit = useCallback((err) => {
        setLink({ token: null, mode: null, itemId: null });
        setBusy(null);
        if (err) say('error', err.display_message || err.error_message || 'The bank connection was closed before it finished.');
    }, []);

    const { open, ready } = usePlaidLink({ token: link.token, onSuccess, onExit });
    useEffect(() => { if (link.token && ready) open(); }, [link.token, ready, open]);

    const startLink = async ({ itemId = null, allowAdditional = false } = {}) => {
        setStatus({ type: '', message: '' });
        setBusy(itemId ? `sync:${itemId}` : 'connect');
        try {
            const res = await callLink('create_link_token', { plaid_item_id: itemId, allow_additional: allowAdditional });
            setConfirmExtra(false);
            setLink({ token: res.link_token, mode: res.mode, itemId });
        } catch (err) {
            setBusy(null);
            if (err.code === 'ALREADY_CONNECTED') { setConfirmExtra(true); return; }
            say('error', err.message);
        }
    };

    const syncNow = async (itemId) => {
        setBusy(`sync:${itemId}`);
        setStatus({ type: '', message: '' });
        try {
            const { data, error } = await supabase.functions.invoke('plaid-sync', { body: { plaid_item_id: itemId, refresh: true } });
            if (error) throw new Error((await invokeError(error)).message);
            const s = data?.summaries?.[0];
            if (s && !s.ok) say(s.waiting_for_mapping ? 'warn' : 'error', describeSummary(s));
            else if (data?.new_transactions) say('success', `${data.new_transactions} new transaction${data.new_transactions === 1 ? '' : 's'}. Categorizing now; they’ll appear in Analysis shortly.`);
            else say('success', 'Up to date. Plaid was also asked to check TD again; anything new arrives within a few minutes.');
            await load();
        } catch (err) {
            say('error', err.message);
        } finally {
            setBusy(null);
        }
    };

    const setDraft = async (accountId, patch) => {
        setDrafts((prev) => ({ ...prev, [accountId]: { ...prev[accountId], ...patch } }));
        // Picking an account for the first time suggests a cutover: the day after
        // the latest row you already have for it from CSV uploads or EasyWeb.
        if (patch.transaction_account && !drafts[accountId]?.cutover_date && userId) {
            const { data } = await supabase.rpc('latest_non_plaid_bronze_date', { p_user_id: userId, p_account: patch.transaction_account });
            if (data) setDrafts((prev) => ({ ...prev, [accountId]: { ...prev[accountId], cutover_date: nextDay(data) } }));
        }
    };

    const saveMapping = async (itemId) => {
        setBusy(`save:${itemId}`);
        setStatus({ type: '', message: '' });
        try {
            for (const a of accounts.filter((x) => x.plaid_item_id === itemId)) {
                const d = drafts[a.plaid_account_id];
                if (d.enabled && !d.transaction_account) throw new Error(`Choose an account for ${a.name}, or set it to Don’t import.`);
                const { error } = await supabase.from('plaid_accounts').update({
                    transaction_account: d.transaction_account || null,
                    cutover_date: d.cutover_date || null,
                    enabled: d.enabled,
                }).eq('plaid_account_id', a.plaid_account_id);
                if (error) throw error;
            }
        } catch (err) {
            setBusy(null);
            say('error', err.message);
            return;
        }
        await syncNow(itemId);
    };

    const remove = async (itemId) => {
        setBusy(`remove:${itemId}`);
        try {
            await callLink('remove', { plaid_item_id: itemId });
            setConfirmRemove(null);
            say('success', 'Disconnected. Transactions already imported stay in SimplySpend.');
            await load();
        } catch (err) {
            say('error', err.message);
        } finally {
            setBusy(null);
        }
    };

    const statusBox = status.message && (
        <div
            style={{
                backgroundColor: status.type === 'success' ? 'rgba(16,185,129,0.1)' : status.type === 'warn' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${status.type === 'success' ? 'rgba(16,185,129,0.25)' : status.type === 'warn' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.25)'}`,
                color: status.type === 'success' ? '#10b981' : status.type === 'warn' ? '#f59e0b' : '#f87171',
            }}
            className="flex items-start gap-2 px-3 py-2 rounded-lg text-sm"
        >
            {status.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
            <span>{status.message}</span>
        </div>
    );

    return (
        <div style={card} className="rounded-xl overflow-hidden mt-6">
            <div className="px-6 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: '#333' }}>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Landmark size={16} style={{ color: '#6b7280' }} />
                    Connected banks
                </h2>
                <button
                    type="button"
                    onClick={() => startLink()}
                    disabled={busy !== null || loading}
                    style={{ backgroundColor: '#034638', color: '#fff' }}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                    {busy === 'connect' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Connect bank
                </button>
            </div>

            <div className="p-6 space-y-5">
                <p style={{ color: '#9ca3af' }} className="text-sm">
                    New transactions are pulled from your bank through Plaid several times a day, then categorized with your rules, just like a CSV upload.
                </p>

                {confirmExtra && (
                    <div style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }} className="rounded-lg p-4 space-y-3">
                        <p className="text-sm flex items-start gap-2" style={{ color: '#fbbf24' }}>
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                            You already have a bank connected. Each new connection permanently uses one of your 10 free Plaid slots, even if you disconnect it later. To fix a broken connection, use Reconnect instead.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setConfirmExtra(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: '#d1d5db', border: '1px solid #3a3a3a' }}>Cancel</button>
                            <button type="button" onClick={() => startLink({ allowAdditional: true })} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#92400e', color: '#fff' }}>Use another slot</button>
                        </div>
                    </div>
                )}

                {statusBox}

                {loading ? (
                    <div className="flex items-center justify-center py-8 gap-3">
                        <Loader2 size={20} className="animate-spin" style={{ color: '#4b5563' }} />
                        <span style={{ color: '#6b7280' }} className="text-sm">Loading connections…</span>
                    </div>
                ) : connections.length === 0 ? (
                    <div className="rounded-lg py-8 px-4 text-center" style={{ border: '1px dashed #3a3a3a' }}>
                        <p className="text-sm text-white font-medium">No banks connected yet</p>
                        <p style={{ color: '#6b7280' }} className="text-sm mt-1">Press Connect bank and sign in to TD. Your chequing and Visa come through together.</p>
                    </div>
                ) : connections.map((c) => {
                    const st = STATUS[c.status] || STATUS.error;
                    const itemAccounts = accounts.filter((a) => a.plaid_item_id === c.id);
                    const summaryText = describeSummary(c.last_sync_summary);
                    const isBusy = busy?.endsWith(c.id);
                    return (
                        <div key={c.id} className="rounded-lg" style={{ border: '1px solid #3a3a3a' }}>
                            <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b" style={{ borderColor: '#333' }}>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                                        {c.institution_name || 'Bank'}
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: st.color, backgroundColor: st.bg }}>{st.label}</span>
                                        {c.env === 'sandbox' && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.12)' }}>SANDBOX · test data</span>
                                        )}
                                    </p>
                                    <p style={{ color: '#6b7280' }} className="text-xs mt-0.5">
                                        Last synced {timeAgo(c.last_synced_at)}{summaryText ? ` · ${summaryText}` : ''}
                                    </p>
                                </div>
                                <div className="ml-auto flex gap-2">
                                    {c.status === 'needs_reauth' || c.status === 'error' ? (
                                        <button type="button" disabled={busy !== null} onClick={() => startLink({ itemId: c.id })}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                                            style={{ backgroundColor: '#92400e', color: '#fff' }}>
                                            {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />} Reconnect
                                        </button>
                                    ) : (
                                        <button type="button" disabled={busy !== null} onClick={() => syncNow(c.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                                            style={{ color: '#d1d5db', border: '1px solid #3a3a3a' }}>
                                            <RefreshCw size={12} className={busy === `sync:${c.id}` ? 'animate-spin' : ''} /> Sync now
                                        </button>
                                    )}
                                    <button type="button" disabled={busy !== null} onClick={() => setConfirmRemove(c.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs disabled:opacity-60"
                                        style={{ color: '#9ca3af', border: '1px solid #3a3a3a' }} title="Disconnect">
                                        <Unplug size={12} />
                                    </button>
                                </div>
                            </div>

                            {confirmRemove === c.id && (
                                <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b" style={{ borderColor: '#333', backgroundColor: 'rgba(239,68,68,0.06)' }}>
                                    <p className="text-sm" style={{ color: '#fca5a5' }}>
                                        Disconnect {c.institution_name || 'this bank'}? Syncing stops; imported transactions stay.{c.env === 'production' ? ' This does not give back the free Plaid slot.' : ''}
                                    </p>
                                    <div className="ml-auto flex gap-2">
                                        <button type="button" onClick={() => setConfirmRemove(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: '#d1d5db', border: '1px solid #3a3a3a' }}>Cancel</button>
                                        <button type="button" disabled={busy !== null} onClick={() => remove(c.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                                            {busy === `remove:${c.id}` ? 'Disconnecting…' : 'Disconnect'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 space-y-3">
                                {itemAccounts.length === 0 && <p style={{ color: '#6b7280' }} className="text-sm">No accounts yet. Press Sync now to fetch them.</p>}
                                {itemAccounts.map((a) => {
                                    const d = drafts[a.plaid_account_id] || {};
                                    const selectValue = d.enabled ? d.transaction_account : '__skip__';
                                    return (
                                        <div key={a.plaid_account_id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
                                            <div className="min-w-0">
                                                <p className="text-sm text-white truncate">{a.name}{a.mask ? <span style={{ color: '#6b7280' }}> ••{a.mask}</span> : null}</p>
                                                <p style={{ color: '#6b7280' }} className="text-xs capitalize">{a.subtype || a.type}</p>
                                            </div>
                                            <div>
                                                <label htmlFor={`map-${a.plaid_account_id}`} style={{ color: '#9ca3af' }} className={`${labelClass} mb-1.5`}>Import into</label>
                                                <select
                                                    id={`map-${a.plaid_account_id}`}
                                                    value={selectValue || ''}
                                                    onChange={(e) => e.target.value === '__skip__'
                                                        ? setDraft(a.plaid_account_id, { enabled: false })
                                                        : setDraft(a.plaid_account_id, { enabled: true, transaction_account: e.target.value })}
                                                    style={inputStyle}
                                                    className="w-full sm:w-48 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
                                                >
                                                    <option value="" disabled>Choose an account…</option>
                                                    {accountNames.map((n) => <option key={n} value={n}>{n}</option>)}
                                                    <option value="__skip__">Don&rsquo;t import</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor={`cut-${a.plaid_account_id}`} style={{ color: '#9ca3af' }} className={`${labelClass} mb-1.5`} title="Only transactions on or after this date are imported, so nothing you already uploaded from CSVs is duplicated.">Import from</label>
                                                <input
                                                    id={`cut-${a.plaid_account_id}`}
                                                    type="date"
                                                    value={d.cutover_date || ''}
                                                    onChange={(e) => setDraft(a.plaid_account_id, { cutover_date: e.target.value })}
                                                    disabled={!d.enabled}
                                                    style={inputStyle}
                                                    className="w-full sm:w-40 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:opacity-50"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {itemAccounts.length > 0 && (
                                    <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                                        <p style={{ color: '#6b7280' }} className="text-xs">
                                            &ldquo;Import from&rdquo; defaults to the day after your latest uploaded transaction, so nothing is imported twice.
                                        </p>
                                        <button type="button" disabled={busy !== null} onClick={() => saveMapping(c.id)}
                                            style={{ backgroundColor: '#034638', color: '#fff' }}
                                            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
                                            {busy === `save:${c.id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                            Save and sync
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

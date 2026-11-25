// Re-categorize every transaction in a date range with your current categories
// and rules: e.g. after changing a rule, run it again over October.
//
// Same mechanism as "Reprocess Transactions" on the AI Rules page (delete the
// silver row, set bronze back to 'pending', run process-transactions), but
// selected by date instead of by file, and careful with your own work:
//   - transactions you've edited by hand are skipped unless you say otherwise
//   - split transactions are always skipped (rebuilding one would drop its parts)
//   - secondary categories are restored afterwards (the AI never sets them)
//   - transactions the bank removed (Plaid) are left alone

import { supabase } from './supabaseClient';

const PAGE = 1000; // PostgREST's default max rows per request
const CHUNK = 200; // IDs per .in() filter, to keep URLs short

function chunks(items, size = CHUNK) {
    const out = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

/**
 * Works out what a reprocess would touch. Nothing is changed.
 *
 * @param {{ userId: string, from: string, to: string, account?: string, skipEdited?: boolean }} opts
 *        from / to are "YYYY-MM-DD", inclusive. account omitted = all accounts.
 */
export async function planReprocess({ userId, from, to, account, skipEdited = true }) {
    const bronze = [];
    for (let offset = 0; ; offset += PAGE) {
        let q = supabase.schema('bronze').from('transactions')
            .select('id, status, raw_data')
            .eq('user_id', userId)
            .gte('raw_data->>Date', from)
            .lte('raw_data->>Date', to) // dates are stored as "YYYY-MM-DD", so text order is date order
            .order('id')
            .range(offset, offset + PAGE - 1);
        if (account) q = q.eq('transaction_account', account);
        const { data, error } = await q;
        if (error) throw new Error(`Couldn't read transactions: ${error.message}`);
        bronze.push(...data);
        if (data.length < PAGE) break;
    }

    // Already queued, or removed by the bank: not ours to touch.
    const candidates = bronze.filter((r) =>
        r.status !== 'pending' && r.status !== 'processing' && r.raw_data?.Plaid?.removed !== true);
    const inFlight = bronze.filter((r) => r.status === 'pending' || r.status === 'processing').length;

    const silverByBronze = new Map();
    for (const ids of chunks(candidates.map((r) => r.id))) {
        const { data, error } = await supabase.from('silver_transactions')
            .select('bronze_id, is_edited, is_split, secondary_categories')
            .eq('user_id', userId)
            .in('bronze_id', ids);
        if (error) throw new Error(`Couldn't read categorized transactions: ${error.message}`);
        for (const row of data) silverByBronze.set(row.bronze_id, row);
    }

    const toRun = [];
    let skippedEdited = 0;
    let skippedSplit = 0;
    for (const r of candidates) {
        const s = silverByBronze.get(r.id);
        if (s?.is_split) { skippedSplit++; continue; }
        if (skipEdited && s?.is_edited) { skippedEdited++; continue; }
        toRun.push({
            bronzeId: r.id,
            tags: Array.isArray(s?.secondary_categories) ? s.secondary_categories : [],
        });
    }

    return { toRun, skippedEdited, skippedSplit, inFlight, total: bronze.length };
}

/**
 * Runs a plan from planReprocess. `onProgress(processedSoFar)` is called after
 * each batch. `signal.cancelled` stops between batches (rows already reset
 * stay pending and are picked up by the next sync or reprocess).
 *
 * @returns {Promise<{ processed: number, tokenLimit: object|null, restoreFailures: number }>}
 */
export async function runReprocess(plan, { userId, onProgress, signal } = {}) {
    const ids = plan.toRun.map((t) => t.bronzeId);

    for (const batch of chunks(ids)) {
        const { error } = await supabase.from('silver_transactions')
            .delete().eq('user_id', userId).in('bronze_id', batch);
        if (error) throw new Error(`Couldn't clear old categories: ${error.message}`);
    }
    for (const batch of chunks(ids)) {
        const { error } = await supabase.schema('bronze').from('transactions')
            .update({ status: 'pending' }).eq('user_id', userId).in('id', batch);
        if (error) throw new Error(`Couldn't queue transactions: ${error.message}`);
    }

    let processed = 0;
    let tokenLimit = null;
    for (let loop = 0; loop < 30; loop++) {
        if (signal?.cancelled) break;
        const { data, error } = await supabase.functions.invoke('process-transactions');
        if (error) {
            let body = null;
            try { body = await error.context?.json(); } catch { /* not JSON */ }
            if (body?.error === 'TOKEN_LIMIT_EXCEEDED') { tokenLimit = body; break; }
            throw new Error(`Categorizing failed: ${body?.error || error.message}`);
        }
        if (!Array.isArray(data)) break; // "No pending transactions found."
        const n = data.reduce((sum, r) => sum + (r.processedCount || 0), 0);
        processed += n;
        onProgress?.(processed);
        if (n === 0) break;
    }

    let restoreFailures = 0;
    for (const t of plan.toRun) {
        if (!t.tags.length) continue;
        const { error } = await supabase.from('silver_transactions')
            .update({ secondary_categories: t.tags })
            .eq('user_id', userId).eq('bronze_id', t.bronzeId);
        if (error) restoreFailures++;
    }

    return { processed, tokenLimit, restoreFailures };
}

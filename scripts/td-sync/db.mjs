// Supabase access for the sync: account checks, latest-date lookup, bronze
// inserts, and running process-transactions until nothing is pending.

import { createClient } from '@supabase/supabase-js';
import { normalizeDate } from '../../src/utils/deduplicateTransactions.js';

export function createDb({ supabaseUrl, serviceKey }) {
    return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Throws if any Finsight account name isn't one of the user's accounts. */
export async function assertAccountsExist(db, userId, names) {
    const { data, error } = await db.from('user_accounts').select('account_name').eq('user_id', userId);
    if (error) throw new Error(`Couldn't read user_accounts: ${error.message}`);
    const have = new Set(data.map((r) => r.account_name));
    const missing = names.filter((n) => !have.has(n));
    if (missing.length) {
        throw new Error(`Not found in your Finsight accounts: ${missing.join(', ')}. Existing: ${[...have].join(', ') || '(none)'}`);
    }
}

/** Latest transaction date ("YYYY-MM-DD") in bronze for this account, or null. */
export async function latestBronzeDate(db, userId, account) {
    const base = () => db.schema('bronze').from('transactions').select('raw_data')
        .eq('user_id', userId).eq('transaction_account', account);

    // Current rows store ISO dates, which sort correctly as text.
    const { data, error } = await base()
        .not('raw_data->>Date', 'like', '%/%')
        .order('raw_data->>Date', { ascending: false })
        .limit(1);
    if (error) throw new Error(`Couldn't read bronze: ${error.message}`);
    const iso = data[0] ? normalizeDate(data[0].raw_data.Date) : null;
    if (iso) return iso;

    // Only legacy MM/DD/YYYY rows (or none): find the max in JS.
    const { data: legacy, error: legacyError } = await base().like('raw_data->>Date', '%/%').limit(5000);
    if (legacyError) throw new Error(`Couldn't read bronze: ${legacyError.message}`);
    const dates = legacy.map((r) => normalizeDate(r.raw_data.Date)).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
}

export async function insertBronze(db, rows) {
    if (rows.length === 0) return;
    const { error } = await db.schema('bronze').from('transactions').insert(rows);
    if (error) throw new Error(`Bronze insert failed: ${error.message}`);
}

/**
 * Calls process-transactions until it reports nothing left, like
 * processTransactionsInternal in Processing.jsx.
 * @returns {{ processed: number, limit: object|null }}
 */
export async function runProcessing({ supabaseUrl, serviceKey }, { maxLoops = 20 } = {}) {
    let processed = 0;
    for (let i = 0; i < maxLoops; i++) {
        const res = await fetch(`${supabaseUrl}/functions/v1/process-transactions`, {
            method: 'POST',
            // New-style secret keys (sb_secret_…) are read from `apikey`;
            // legacy service_role JWTs from Authorization. Send both.
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: '{}',
        });
        const text = await res.text();
        let body = null;
        try { body = JSON.parse(text); } catch { /* non-JSON error page */ }

        if (res.status === 429 && body?.error === 'TOKEN_LIMIT_EXCEEDED') return { processed, limit: body };
        if (!res.ok) throw new Error(`process-transactions failed (${res.status}): ${body?.error || text.slice(0, 200)}`);
        if (!Array.isArray(body)) break; // "No pending transactions found."

        const n = body.reduce((sum, r) => sum + (r.processedCount || 0), 0);
        processed += n;
        if (n === 0) break;
    }
    return { processed, limit: null };
}

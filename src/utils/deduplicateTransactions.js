/**
 * Drops rows from a new upload that are already in bronze for the same account.
 *
 * Design: implementation-plans/duplicate-transaction-detection.md
 *
 * A duplicate is a new row that matches a row from a PREVIOUS upload on
 * Date + Description + Amount (account is fixed by the query). Matching is
 * count-aware: if bronze already holds one "$5.50 STARBUCKS on 03-15" and the
 * new file holds two, one is a duplicate and one is new. Two identical rows
 * within the same file are both kept.
 *
 * Every bronze row counts as "already there", whatever its status, including
 * rows whose silver transaction the user deleted and rows a rule removed
 * (status 'deleted'; see migration 20261112120000_bronze_deleted_status.sql).
 * Rows removed by a rule before that migration were physically deleted, so
 * they'll be re-imported once more, then kept as 'deleted' from then on.
 *
 * Used by the upload screens and by the TD EasyWeb sync script, so it takes the
 * Supabase client as an argument (anon in the browser, service role in Node).
 */

const PAGE_SIZE = 1000; // PostgREST's default max rows per request

// ── Normalisation ─────────────────────────────────────────────────────────────
// Mirrors how process-transactions reads raw_data, so a legacy bronze row and a
// freshly parsed row describing the same transaction produce the same key.

function normalizeDescription(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function parseNumber(value) {
    if (value === undefined || value === null || value === '') return NaN;
    if (typeof value === 'number') return value;
    return parseFloat(String(value).replace(/[^0-9.-]/g, ''));
}

function normalizeAmount(raw) {
    let amount;
    if (raw.Amount !== undefined && raw.Amount !== null && raw.Amount !== '') {
        amount = parseNumber(raw.Amount);
    } else {
        // Legacy rows stored MoneyOut / MoneyIn instead of a signed Amount.
        const out = parseNumber(raw.MoneyOut);
        const inn = parseNumber(raw.MoneyIn);
        if (isFinite(out) && out !== 0) amount = -Math.abs(out);
        else if (isFinite(inn)) amount = Math.abs(inn);
        else amount = NaN;
    }
    return isFinite(amount) ? amount.toFixed(2) : null;
}

/** "YYYY-MM-DD" from ISO or MM/DD/YYYY, without timezone conversion. */
export function normalizeDate(value) {
    const str = String(value ?? '').trim();
    const pad = (n) => String(n).padStart(2, '0');
    let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) return `${m[3]}-${pad(m[1])}-${pad(m[2])}`;
    return null;
}

/** Fingerprint for a raw_data object, or null if it can't be keyed. */
export function fingerprint(raw) {
    if (!raw) return null;
    const date = normalizeDate(raw.Date);
    const amount = normalizeAmount(raw);
    if (!date || amount === null) return null;
    return `${date}|${normalizeDescription(raw.Description)}|${amount}`;
}

// ── Pure matching (unit-tested) ───────────────────────────────────────────────

/**
 * @param {Array<object>} newRows       parsed rows: { Date, Description, Amount }
 * @param {Array<object>} existingRaw   raw_data of bronze rows already stored
 * @returns {{ newRows: Array<object>, duplicateCount: number }}
 */
export function filterDuplicates(newRows, existingRaw) {
    const counts = new Map();
    for (const raw of existingRaw) {
        const key = fingerprint(raw);
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }

    const survivors = [];
    let duplicateCount = 0;
    for (const row of newRows) {
        const key = fingerprint(row);
        const remaining = key ? counts.get(key) || 0 : 0;
        if (remaining > 0) {
            counts.set(key, remaining - 1);
            duplicateCount++;
        } else {
            survivors.push(row);
        }
    }
    return { newRows: survivors, duplicateCount };
}

// ── Database lookup ───────────────────────────────────────────────────────────

async function fetchAll(buildQuery) {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < PAGE_SIZE) return rows;
    }
}

/**
 * Bronze raw_data for this user + account within [minDate, maxDate].
 *
 * Two queries because dates are compared as text: current rows store
 * "YYYY-MM-DD" (range-filterable in SQL), but legacy rows may store
 * "MM/DD/YYYY", which is fetched separately and range-filtered here.
 */
async function fetchExistingRaw(supabase, userId, account, minDate, maxDate) {
    const base = () => supabase
        .schema('bronze')
        .from('transactions')
        .select('raw_data')
        .eq('user_id', userId)
        .eq('transaction_account', account)
        .order('id');

    const [isoRows, legacyRows] = await Promise.all([
        fetchAll(() => base().gte('raw_data->>Date', minDate).lte('raw_data->>Date', maxDate)),
        fetchAll(() => base().like('raw_data->>Date', '%/%')),
    ]);

    const legacyInRange = legacyRows.filter((r) => {
        const d = normalizeDate(r.raw_data?.Date);
        return d && d >= minDate && d <= maxDate;
    });

    return [...isoRows, ...legacyInRange].map((r) => r.raw_data);
}

/**
 * @param {Array<{Date: string, Description: string, Amount: number}>} parsedRows
 * @param {string} userId
 * @param {string} account   transaction_account the rows will be stored under
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ newRows: Array<object>, duplicateCount: number }>}
 */
export async function deduplicateTransactions(parsedRows, userId, account, supabase) {
    const dates = parsedRows.map((r) => normalizeDate(r.Date)).filter(Boolean).sort();
    if (dates.length === 0) return { newRows: parsedRows, duplicateCount: 0 };

    const existing = await fetchExistingRaw(supabase, userId, account, dates[0], dates[dates.length - 1]);
    return filterDuplicates(parsedRows, existing);
}

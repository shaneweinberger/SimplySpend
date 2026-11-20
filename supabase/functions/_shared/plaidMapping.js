// Pure logic for turning a Plaid /transactions/sync result into bronze and
// silver changes. No I/O, so it runs unchanged in Deno (edge functions) and in
// Node (`npm test`).
//
// Plan: implementation-plans/plaid-sync.md

/**
 * @typedef {{ Date: string, Description: string, Amount: number, Plaid: Record<string, any> }} BronzeRaw
 */

/** "YYYY-MM-DD" → the next calendar day, without timezone conversion. */
export function nextDay(isoDate) {
    if (!isoDate) return null;
    const [y, m, d] = String(isoDate).slice(0, 10).split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    return next.toISOString().slice(0, 10);
}

function cleanText(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * The bronze raw_data for one Plaid transaction: the same { Date, Description,
 * Amount } shape a CSV row has, so process-transactions and duplicate detection
 * read it unchanged. Plaid's own fields ride along under `Plaid`.
 *
 * - Description is the bank's own text (original_description), because your
 *   rules were written against TD's wording, not Plaid's cleaned-up `name`.
 * - Amount is negated: Plaid uses positive for money out, bronze uses negative.
 * @returns {BronzeRaw}
 */
export function toBronzeRaw(txn) {
    const amount = Math.round(-Number(txn.amount) * 100) / 100;
    return {
        Date: txn.date,
        Description: cleanText(txn.original_description) || cleanText(txn.name) || cleanText(txn.merchant_name),
        Amount: Object.is(amount, -0) ? 0 : amount,
        Plaid: {
            name: txn.name ?? null,
            merchant_name: txn.merchant_name ?? null,
            pending: txn.pending === true,
            authorized_date: txn.authorized_date ?? null,
            pfc: txn.personal_finance_category?.primary ?? null,
            currency: txn.iso_currency_code ?? txn.unofficial_currency_code ?? null,
        },
    };
}

/** True if two raw_data objects differ in anything the pipeline uses. */
export function rawChanged(a, b) {
    if (!a || !b) return true;
    return a.Date !== b.Date
        || a.Description !== b.Description
        || Number(a.Amount) !== Number(b.Amount)
        || (a.Plaid?.pending === true) !== (b.Plaid?.pending === true);
}

/**
 * Works out what one complete sync (all pages, applied together) should do.
 *
 * @param {object} input
 * @param {Array} input.added     Plaid transactions
 * @param {Array} input.modified  Plaid transactions
 * @param {Array} input.removed   [{ transaction_id, account_id }]
 * @param {Map<string, {transaction_account: string|null, cutover_date: string|null, enabled: boolean}>} input.accounts
 *        keyed by Plaid account_id
 * @param {Map<string, {id: string, status: string, raw_data: object}>} input.existing
 *        bronze rows already stored, keyed by plaid_transaction_id. Must include
 *        every ID referenced by added (and their pending_transaction_id),
 *        modified and removed.
 * @returns {{
 *   inserts: Array<{plaid_transaction_id: string, transaction_account: string, raw_data: BronzeRaw}>,
 *   updates: Array<{bronze_id: string, plaid_transaction_id: string, raw_data: BronzeRaw, resurrect: boolean}>,
 *   removals: Array<{bronze_id: string, plaid_transaction_id: string, raw_data: BronzeRaw}>,
 *   unmapped: string[],
 *   skipped: {beforeCutover: number, disabled: number, unchanged: number}
 * }}
 *
 * `unmapped` lists enabled accounts with no SimplySpend account chosen. When it
 * isn't empty the caller must not apply anything or advance the cursor.
 */
export function planSync({ added = [], modified = [], removed = [], accounts, existing }) {
    const skipped = { beforeCutover: 0, disabled: 0, unchanged: 0 };
    const unmapped = new Set();

    // Working state, keyed by Plaid transaction ID:
    //   stored  → a bronze row (possibly re-keyed by a promotion in this batch)
    //   pending → an insert planned in this batch
    const stored = new Map();
    for (const [plaidId, row] of existing) stored.set(plaidId, { ...row, plaidId });
    const inserts = new Map();
    const updates = new Map(); // bronze_id → update
    const removals = new Map(); // bronze_id → removal
    const supersededIds = new Set(); // pending IDs replaced by their posted version

    const accountFor = (txn) => {
        const acct = accounts.get(txn.account_id);
        if (!acct) { unmapped.add(txn.account_id); return null; }
        if (!acct.enabled) { skipped.disabled++; return null; }
        if (!acct.transaction_account) { unmapped.add(txn.account_id); return null; }
        return acct;
    };

    const beforeCutover = (acct, txn) => Boolean(acct.cutover_date) && txn.date < acct.cutover_date;

    const planUpdate = (row, txn, raw) => {
        const resurrect = row.status === 'deleted' && row.raw_data?.Plaid?.removed === true;
        if (!resurrect && row.plaidId === txn.transaction_id && !rawChanged(row.raw_data, raw)) {
            skipped.unchanged++;
            return;
        }
        removals.delete(row.id);
        updates.set(row.id, { bronze_id: row.id, plaid_transaction_id: txn.transaction_id, raw_data: raw, resurrect });
        stored.delete(row.plaidId);
        stored.set(txn.transaction_id, { ...row, plaidId: txn.transaction_id, raw_data: raw, status: resurrect ? 'pending' : row.status });
    };

    const upsert = (txn) => {
        const raw = toBronzeRaw(txn);

        // Already stored under this ID: an update (or a re-run of the same page).
        if (stored.has(txn.transaction_id)) {
            if (!accounts.get(txn.account_id)?.enabled) { skipped.disabled++; return; }
            planUpdate(stored.get(txn.transaction_id), txn, raw);
            return;
        }

        const acct = accountFor(txn);
        if (!acct) return;

        // A pending purchase has posted: re-key the existing row so its
        // category, silver row and any edits carry over.
        const pendingId = txn.pending_transaction_id;
        if (pendingId && stored.has(pendingId)) {
            supersededIds.add(pendingId);
            planUpdate(stored.get(pendingId), txn, raw);
            return;
        }
        if (pendingId && inserts.has(pendingId)) {
            supersededIds.add(pendingId);
            inserts.delete(pendingId);
        }

        if (beforeCutover(acct, txn)) { skipped.beforeCutover++; return; }

        inserts.set(txn.transaction_id, {
            plaid_transaction_id: txn.transaction_id,
            transaction_account: acct.transaction_account,
            raw_data: raw,
        });
    };

    for (const txn of added) upsert(txn);
    for (const txn of modified) upsert(txn);

    for (const { transaction_id: plaidId } of removed) {
        if (supersededIds.has(plaidId)) continue; // replaced by its posted version above
        if (inserts.delete(plaidId)) continue; // added and removed within this batch
        const row = stored.get(plaidId);
        if (!row || row.status === 'deleted') continue;
        updates.delete(row.id);
        // Flag it, so a posted version that arrives in a later sync can bring it back.
        const raw = { ...row.raw_data, Plaid: { ...row.raw_data?.Plaid, removed: true } };
        removals.set(row.id, { bronze_id: row.id, plaid_transaction_id: plaidId, raw_data: raw });
        stored.delete(plaidId);
    }

    return {
        inserts: [...inserts.values()],
        updates: [...updates.values()],
        removals: [...removals.values()],
        unmapped: [...unmapped],
        skipped,
    };
}

/** Every bronze plaid_transaction_id planSync needs to know about. */
export function referencedIds({ added = [], modified = [], removed = [] }) {
    const ids = new Set();
    for (const t of added) {
        ids.add(t.transaction_id);
        if (t.pending_transaction_id) ids.add(t.pending_transaction_id);
    }
    for (const t of modified) ids.add(t.transaction_id);
    for (const t of removed) ids.add(t.transaction_id);
    return [...ids];
}

/**
 * The change to make to a silver row after its bronze row was updated.
 *
 * The category and description (which the AI or you may have rewritten) are
 * always kept. The date and pending flag follow the bank. The amount follows
 * the bank too, unless you edited the row or split it (a split's parts must
 * keep summing to the original).
 *
 * @returns {object|null} a patch, or null if nothing changes
 */
export function silverPatch(silverRow, raw) {
    if (!silverRow) return null;
    const patch = {};
    const pending = raw.Plaid?.pending === true;
    if (silverRow.is_pending !== pending) patch.is_pending = pending;
    if (raw.Date && silverRow.transaction_date !== raw.Date) patch.transaction_date = raw.Date;
    const amount = Number(raw.Amount);
    if (!silverRow.is_edited && !silverRow.is_split && Number(silverRow.amount) !== amount) {
        patch.amount = amount;
        patch.transaction_type = amount < 0 ? 'Expenditure' : 'Income';
    }
    return Object.keys(patch).length ? patch : null;
}

/**
 * Suggests which SimplySpend account a Plaid account maps to, by name.
 * Returns a name only when exactly one account fits, otherwise null.
 */
export function suggestAccountMapping(plaidAccount, accountNames) {
    const isCredit = plaidAccount.type === 'credit';
    const words = isCredit
        ? ['credit', 'visa', 'mastercard', 'amex']
        : ['debit', 'chequing', 'checking', 'savings'];
    const matches = accountNames.filter((n) => words.some((w) => n.toLowerCase().includes(w)));
    if (matches.length === 1) return matches[0];

    // Several fit: prefer one that also names the account's subtype.
    const subtype = String(plaidAccount.subtype || '').toLowerCase();
    const narrowed = matches.filter((n) => subtype && n.toLowerCase().includes(subtype));
    return narrowed.length === 1 ? narrowed[0] : null;
}

/**
 * A stable UUID for "this connection, this account, this month", so the
 * Processing screen shows Plaid rows as one upload per account per month
 * instead of one per sync. (The upload list labels each file with a single
 * account, so a file must never mix accounts.)
 */
export async function monthlyFileId(plaidItemId, account, isoDate) {
    const key = `plaid:${plaidItemId}:${account}:${String(isoDate).slice(0, 7)}`;
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
    const b = digest.slice(0, 16);
    b[6] = (b[6] & 0x0f) | 0x50; // version 5-style
    b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
    const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** "Plaid · TD Canada Trust · Nov 2026" */
export function monthlyFileName(institutionName, isoDate) {
    const [y, m] = String(isoDate).slice(0, 7).split('-').map(Number);
    const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-CA', { month: 'short', timeZone: 'UTC' });
    return `Plaid · ${institutionName || 'Bank'} · ${month} ${y}`;
}

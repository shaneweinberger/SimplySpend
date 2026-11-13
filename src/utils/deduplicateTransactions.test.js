// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterDuplicates, fingerprint, deduplicateTransactions } from './deduplicateTransactions.js';

const coffee = { Date: '2026-03-15', Description: 'STARBUCKS', Amount: -5.5 };
const lunch = { Date: '2026-03-15', Description: 'SUBWAY', Amount: -12 };
const pay = { Date: '2026-03-16', Description: 'PAYROLL', Amount: 2000 };

test('keeps every row when nothing exists yet', () => {
    const r = filterDuplicates([coffee, lunch], []);
    assert.equal(r.newRows.length, 2);
    assert.equal(r.duplicateCount, 0);
});

test('identical rows within one upload are both kept', () => {
    const r = filterDuplicates([coffee, { ...coffee }], []);
    assert.equal(r.newRows.length, 2);
});

test('exact re-upload inserts nothing', () => {
    const r = filterDuplicates([coffee, coffee, lunch], [coffee, coffee, lunch]);
    assert.equal(r.newRows.length, 0);
    assert.equal(r.duplicateCount, 3);
});

test('count-aware: one stored, two uploaded → one new', () => {
    const r = filterDuplicates([coffee, coffee], [coffee]);
    assert.equal(r.newRows.length, 1);
    assert.equal(r.duplicateCount, 1);
});

test('overlapping range keeps only the new rows', () => {
    const r = filterDuplicates([coffee, lunch, pay], [coffee, lunch]);
    assert.deepEqual(r.newRows, [pay]);
});

test('different amount, date, or description is not a duplicate', () => {
    const r = filterDuplicates(
        [{ ...coffee, Amount: -5.51 }, { ...coffee, Date: '2026-03-14' }, { ...coffee, Description: 'STARBUCKS 2' }],
        [coffee],
    );
    assert.equal(r.newRows.length, 3);
});

test('normalises whitespace, number formatting, and legacy shapes', () => {
    assert.equal(fingerprint({ Date: '2026-03-15', Description: '  STARBUCKS  ', Amount: '-5.50' }), fingerprint(coffee));
    assert.equal(fingerprint({ Date: '03/15/2026', Description: 'STARBUCKS', MoneyOut: '5.50', MoneyIn: '' }), fingerprint(coffee));
    assert.equal(fingerprint({ Date: '2026-03-16', Description: 'PAYROLL', MoneyOut: '', MoneyIn: '2,000.00' }), fingerprint(pay));
});

test('unkeyable stored rows never swallow new rows', () => {
    const r = filterDuplicates([coffee], [{ Date: '', Description: '', Amount: '' }]);
    assert.equal(r.newRows.length, 1);
});

// ── deduplicateTransactions with a fake Supabase client ──────────────────────

function fakeSupabase(rows) {
    const calls = [];
    const builder = () => {
        const filters = { eq: {}, gte: null, lte: null, like: null };
        const q = {
            schema: () => q, from: () => q, select: () => q, order: () => q,
            eq: (col, v) => { filters.eq[col] = v; return q; },
            gte: (_c, v) => { filters.gte = v; return q; },
            lte: (_c, v) => { filters.lte = v; return q; },
            like: (_c, v) => { filters.like = v; return q; },
            range: async (from, to) => {
                calls.push({ ...filters, eq: { ...filters.eq } });
                const match = rows.filter((r) => {
                    if (r.user_id !== filters.eq.user_id || r.transaction_account !== filters.eq.transaction_account) return false;
                    const d = r.raw_data.Date;
                    if (filters.like) return d.includes('/');
                    return d >= filters.gte && d <= filters.lte;
                });
                return { data: match.slice(from, to + 1), error: null };
            },
        };
        return q;
    };
    return { schema: () => builder(), calls };
}

test('queries only this user + account + date range, including legacy dates', async () => {
    const stored = [
        { user_id: 'u1', transaction_account: 'TD Debit', raw_data: coffee },
        { user_id: 'u1', transaction_account: 'TD Debit', raw_data: { Date: '03/16/2026', Description: 'PAYROLL', MoneyIn: '2000' } },
        { user_id: 'u1', transaction_account: 'TD Credit Card', raw_data: lunch },   // other account
        { user_id: 'u2', transaction_account: 'TD Debit', raw_data: lunch },         // other user
        { user_id: 'u1', transaction_account: 'TD Debit', raw_data: { ...lunch, Date: '2025-01-01' } }, // out of range
    ];
    const sb = fakeSupabase(stored);
    const r = await deduplicateTransactions([coffee, lunch, pay], 'u1', 'TD Debit', sb);
    assert.deepEqual(r.newRows, [lunch]);
    assert.equal(r.duplicateCount, 2);
    assert.equal(sb.calls.find((c) => c.gte).gte, '2026-03-15');
    assert.equal(sb.calls.find((c) => c.lte).lte, '2026-03-16');
});

test('empty input makes no queries', async () => {
    const sb = fakeSupabase([]);
    const r = await deduplicateTransactions([], 'u1', 'TD Debit', sb);
    assert.equal(r.newRows.length, 0);
    assert.equal(sb.calls.length, 0);
});

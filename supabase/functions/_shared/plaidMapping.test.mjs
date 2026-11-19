import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    nextDay, toBronzeRaw, planSync, referencedIds, silverPatch,
    suggestAccountMapping, monthlyFileId, monthlyFileName,
} from './plaidMapping.js';

const CHQ = 'acc-chq';
const VISA = 'acc-visa';

const accounts = (over = {}) => new Map([
    [CHQ, { transaction_account: 'TD Debit', cutover_date: null, enabled: true, ...over[CHQ] }],
    [VISA, { transaction_account: 'TD Credit Card', cutover_date: null, enabled: true, ...over[VISA] }],
]);

const txn = (id, extra = {}) => ({
    transaction_id: id,
    account_id: VISA,
    date: '2026-11-17',
    amount: 18.42,
    name: 'Uber',
    merchant_name: 'Uber',
    original_description: 'UBER CANADA/UBERTRIP   TORONTO',
    pending: false,
    pending_transaction_id: null,
    ...extra,
});

const stored = (plaidId, extra = {}) => [plaidId, {
    id: `bronze-${plaidId}`,
    status: 'processed',
    raw_data: toBronzeRaw(txn(plaidId)),
    ...extra,
}];

// ── toBronzeRaw ──────────────────────────────────────────────────────────────

test('money out becomes negative, money in positive', () => {
    assert.equal(toBronzeRaw(txn('a', { amount: 12.5 })).Amount, -12.5);
    assert.equal(toBronzeRaw(txn('a', { amount: -500 })).Amount, 500);
    assert.equal(toBronzeRaw(txn('a', { amount: 0 })).Amount, 0);
    assert.ok(!Object.is(toBronzeRaw(txn('a', { amount: 0 })).Amount, -0));
    assert.equal(toBronzeRaw(txn('a', { amount: 0.1 + 0.2 })).Amount, -0.3);
});

test('description is the bank text, whitespace collapsed, falling back to name', () => {
    assert.equal(toBronzeRaw(txn('a')).Description, 'UBER CANADA/UBERTRIP TORONTO');
    assert.equal(toBronzeRaw(txn('a', { original_description: null })).Description, 'Uber');
    assert.equal(toBronzeRaw(txn('a', { original_description: '  ', name: null })).Description, 'Uber');
});

test('raw_data keeps the CSV shape plus Plaid details', () => {
    const raw = toBronzeRaw(txn('a', { pending: true, personal_finance_category: { primary: 'TRANSPORTATION' }, iso_currency_code: 'CAD' }));
    assert.equal(raw.Date, '2026-11-17');
    assert.equal(raw.Plaid.pending, true);
    assert.equal(raw.Plaid.pfc, 'TRANSPORTATION');
    assert.equal(raw.Plaid.currency, 'CAD');
});

// ── planSync: inserts ────────────────────────────────────────────────────────

test('new transactions are inserted on the mapped account', () => {
    const plan = planSync({ added: [txn('t1'), txn('t2', { account_id: CHQ })], accounts: accounts(), existing: new Map() });
    assert.equal(plan.inserts.length, 2);
    assert.deepEqual(plan.inserts.map((i) => i.transaction_account), ['TD Credit Card', 'TD Debit']);
    assert.equal(plan.inserts[0].plaid_transaction_id, 't1');
});

test('running the same page again changes nothing', () => {
    const plan = planSync({ added: [txn('t1')], accounts: accounts(), existing: new Map([stored('t1')]) });
    assert.equal(plan.inserts.length, 0);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.skipped.unchanged, 1);
});

test('transactions before the cutover date are skipped', () => {
    const plan = planSync({
        added: [txn('old', { date: '2026-11-01' }), txn('new', { date: '2026-11-05' })],
        accounts: accounts({ [VISA]: { cutover_date: '2026-11-05' } }),
        existing: new Map(),
    });
    assert.deepEqual(plan.inserts.map((i) => i.plaid_transaction_id), ['new']);
    assert.equal(plan.skipped.beforeCutover, 1);
});

test('disabled accounts are skipped', () => {
    const plan = planSync({ added: [txn('t1')], accounts: accounts({ [VISA]: { enabled: false } }), existing: new Map() });
    assert.equal(plan.inserts.length, 0);
    assert.equal(plan.skipped.disabled, 1);
    assert.deepEqual(plan.unmapped, []);
});

test('unmapped or unknown accounts are reported, not silently dropped', () => {
    const plan = planSync({
        added: [txn('t1'), txn('t2', { account_id: 'acc-new' })],
        accounts: accounts({ [VISA]: { transaction_account: null } }),
        existing: new Map(),
    });
    assert.deepEqual(plan.unmapped.sort(), ['acc-new', VISA].sort());
});

// ── planSync: pending → posted ───────────────────────────────────────────────

test('a posted transaction re-keys its stored pending row instead of inserting', () => {
    const pendingRow = stored('p1', { raw_data: toBronzeRaw(txn('p1', { pending: true, amount: 18 })) });
    const plan = planSync({
        added: [txn('posted1', { pending_transaction_id: 'p1', amount: 21.6 })],
        removed: [{ transaction_id: 'p1', account_id: VISA }],
        accounts: accounts(),
        existing: new Map([pendingRow]),
    });
    assert.equal(plan.inserts.length, 0);
    assert.equal(plan.removals.length, 0, 'the pending ID is replaced, not removed');
    assert.equal(plan.updates.length, 1);
    const [u] = plan.updates;
    assert.equal(u.bronze_id, 'bronze-p1');
    assert.equal(u.plaid_transaction_id, 'posted1');
    assert.equal(u.raw_data.Amount, -21.6);
    assert.equal(u.raw_data.Plaid.pending, false);
    assert.equal(u.resurrect, false);
});

test('pending and posted in the same batch insert only the posted one', () => {
    const plan = planSync({
        added: [txn('p1', { pending: true }), txn('posted1', { pending_transaction_id: 'p1' })],
        removed: [{ transaction_id: 'p1' }],
        accounts: accounts(),
        existing: new Map(),
    });
    assert.deepEqual(plan.inserts.map((i) => i.plaid_transaction_id), ['posted1']);
    assert.equal(plan.removals.length, 0);
});

test('a posted version arriving after its pending was removed brings the row back', () => {
    const removedRow = stored('p1', {
        status: 'deleted',
        raw_data: { ...toBronzeRaw(txn('p1', { pending: true })), Plaid: { pending: true, removed: true } },
    });
    const plan = planSync({
        added: [txn('posted1', { pending_transaction_id: 'p1' })],
        accounts: accounts(),
        existing: new Map([removedRow]),
    });
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].resurrect, true);
});

test('a row a delete rule removed stays deleted when it posts', () => {
    const ruleDeleted = stored('p1', { status: 'deleted', raw_data: toBronzeRaw(txn('p1', { pending: true })) });
    const plan = planSync({
        added: [txn('posted1', { pending_transaction_id: 'p1' })],
        accounts: accounts(),
        existing: new Map([ruleDeleted]),
    });
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].resurrect, false);
});

test('a posted transaction whose pending was never imported (before cutover) is inserted', () => {
    const plan = planSync({
        added: [txn('posted1', { pending_transaction_id: 'p-unknown', date: '2026-11-10' })],
        accounts: accounts({ [VISA]: { cutover_date: '2026-11-09' } }),
        existing: new Map(),
    });
    assert.deepEqual(plan.inserts.map((i) => i.plaid_transaction_id), ['posted1']);
});

// ── planSync: modified and removed ───────────────────────────────────────────

test('a modified transaction updates its row', () => {
    const plan = planSync({ modified: [txn('t1', { amount: 20 })], accounts: accounts(), existing: new Map([stored('t1')]) });
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].raw_data.Amount, -20);
});

test('a modified transaction we never stored is inserted if it passes the filters', () => {
    const plan = planSync({ modified: [txn('t9')], accounts: accounts(), existing: new Map() });
    assert.equal(plan.inserts.length, 1);
});

test('a removed transaction is flagged for removal with a marker', () => {
    const plan = planSync({ removed: [{ transaction_id: 't1' }], accounts: accounts(), existing: new Map([stored('t1')]) });
    assert.equal(plan.removals.length, 1);
    assert.equal(plan.removals[0].bronze_id, 'bronze-t1');
    assert.equal(plan.removals[0].raw_data.Plaid.removed, true);
});

test('removing something unknown or already deleted does nothing', () => {
    const plan = planSync({
        removed: [{ transaction_id: 'nope' }, { transaction_id: 't1' }],
        accounts: accounts(),
        existing: new Map([stored('t1', { status: 'deleted' })]),
    });
    assert.equal(plan.removals.length, 0);
});

test('referencedIds covers pending IDs too', () => {
    const ids = referencedIds({
        added: [txn('a', { pending_transaction_id: 'p' })],
        modified: [txn('m')],
        removed: [{ transaction_id: 'r' }],
    });
    assert.deepEqual(ids.sort(), ['a', 'm', 'p', 'r']);
});

// ── silverPatch ──────────────────────────────────────────────────────────────

const silver = (extra = {}) => ({ amount: -18, transaction_date: '2026-11-16', is_pending: true, is_edited: false, is_split: false, ...extra });
const postedRaw = toBronzeRaw(txn('x', { amount: 21.6, date: '2026-11-17' }));

test('posting updates date, amount and pending flag', () => {
    assert.deepEqual(silverPatch(silver(), postedRaw), {
        is_pending: false, transaction_date: '2026-11-17', amount: -21.6, transaction_type: 'Expenditure',
    });
});

test('an edited or split row keeps its amount', () => {
    assert.equal(silverPatch(silver({ is_edited: true }), postedRaw).amount, undefined);
    assert.equal(silverPatch(silver({ is_split: true }), postedRaw).amount, undefined);
    assert.equal(silverPatch(silver({ is_split: true }), postedRaw).is_pending, false);
});

test('no patch when nothing changed', () => {
    assert.equal(silverPatch(silver({ amount: -21.6, transaction_date: '2026-11-17', is_pending: false }), postedRaw), null);
    assert.equal(silverPatch(null, postedRaw), null);
});

// ── helpers ──────────────────────────────────────────────────────────────────

test('nextDay crosses month and year ends', () => {
    assert.equal(nextDay('2026-11-30'), '2026-12-01');
    assert.equal(nextDay('2026-12-31'), '2027-01-01');
    assert.equal(nextDay('2028-02-28'), '2028-02-29');
    assert.equal(nextDay(null), null);
});

test('account suggestions match by kind, only when unambiguous', () => {
    const names = ['TD Debit', 'TD Credit Card'];
    assert.equal(suggestAccountMapping({ type: 'depository', subtype: 'checking' }, names), 'TD Debit');
    assert.equal(suggestAccountMapping({ type: 'credit', subtype: 'credit card' }, names), 'TD Credit Card');
    assert.equal(suggestAccountMapping({ type: 'credit' }, ['Visa A', 'Visa B']), null);
    assert.equal(suggestAccountMapping({ type: 'credit' }, []), null);
});

test('monthly file IDs are stable per connection and month', async () => {
    const a = await monthlyFileId('item-1', '2026-11-02');
    assert.equal(a, await monthlyFileId('item-1', '2026-11-29'));
    assert.notEqual(a, await monthlyFileId('item-1', '2026-12-01'));
    assert.notEqual(a, await monthlyFileId('item-2', '2026-11-02'));
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(monthlyFileName('TD Canada Trust', '2026-11-18'), 'Plaid · TD Canada Trust · Nov 2026');
});

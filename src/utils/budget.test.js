// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    monthPeriod, weekPeriod, previousMonths, spendInRange, spendingHistory,
    median, suggestAmount, guessBucket, weeklyAllowance, paceState, billState,
    isAboveUsual, funding, layoutFlow, isExcludedCategory,
} from './budget.js';

const day = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const tx = (effective_date, category, amount, extra = {}) => ({ effective_date, category, amount, ...extra });

test('monthPeriod counts today as elapsed and in the days left', () => {
    const p = monthPeriod(day('2026-11-25'));
    assert.equal(p.start, '2026-11-01');
    assert.equal(p.end, '2026-11-30');
    assert.equal(p.daysLeft, 6);
    assert.equal(p.elapsed, 25 / 30);
});

test('weekPeriod starts on Monday, including when today is Sunday', () => {
    assert.deepEqual(
        [weekPeriod(day('2026-11-25')).start, weekPeriod(day('2026-11-25')).end],
        ['2026-11-23', '2026-11-29'],
    );
    const sunday = weekPeriod(day('2026-11-29'));
    assert.equal(sunday.start, '2026-11-23');
    assert.equal(sunday.daysLeft, 1);
    assert.equal(weekPeriod(day('2026-11-23')).dayIndex, 1);
});

test('previousMonths crosses a year boundary', () => {
    const months = previousMonths(day('2026-02-10'), 3);
    assert.deepEqual(months.map(m => m.key), ['2025-11', '2025-12', '2026-01']);
    assert.equal(months[2].end, '2026-01-31');
});

test('spendInRange nets refunds, skips split originals, income and transfers', () => {
    const rows = [
        tx('2026-11-02', 'Groceries', -80),
        tx('2026-11-03', 'Groceries', 15),            // refund
        tx('2026-11-04', 'Income', 500),
        tx('2026-11-04', 'Transfers', -300),
        tx('2026-11-05', 'Dining Out', -60, { is_split: true }),
        tx('2026-11-05', 'Dining Out', -40),           // a part of that split
        tx('2026-11-06', null, -12),
        tx('2026-10-31', 'Groceries', -999),           // outside range
    ];
    const { byCategory, total } = spendInRange(rows, '2026-11-01', '2026-11-30');
    assert.equal(byCategory.get('Groceries'), 65);
    assert.equal(byCategory.get('Dining Out'), 40);
    assert.equal(byCategory.get('Uncategorized'), 12);
    assert.equal(byCategory.has('Income'), false);
    assert.equal(byCategory.has('Transfers'), false);
    assert.equal(total, 117);
});

test('a category that is net refunded does not reduce the total', () => {
    const { byCategory, total } = spendInRange(
        [tx('2026-11-02', 'Shopping', 50), tx('2026-11-02', 'Groceries', -30)],
        '2026-11-01', '2026-11-30',
    );
    assert.equal(byCategory.get('Shopping'), -50);
    assert.equal(total, 30);
});

test('spendingHistory takes the median and ignores months with no data', () => {
    const rows = [
        // August: nothing (user hadn't uploaded yet)
        tx('2026-09-10', 'Dining Out', -300),
        tx('2026-10-10', 'Dining Out', -500),
        tx('2026-10-11', 'Groceries', -200),
    ];
    const h = spendingHistory(rows, day('2026-11-25'), 3);
    assert.equal(h.monthsWithData, 2);
    assert.equal(h.byCategory.get('Dining Out').usual, 400);
    assert.deepEqual(h.byCategory.get('Dining Out').history, [0, 300, 500]);
    // Groceries had no spend in September, which is a real $0 month
    assert.equal(h.byCategory.get('Groceries').usual, 100);
    assert.equal(h.usualTotal, 500);
});

test('median handles even, odd and empty lists', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([]), 0);
});

test('suggestAmount rounds up to tidy numbers', () => {
    assert.equal(suggestAmount(0), 0);
    assert.equal(suggestAmount(42.1), 45);
    assert.equal(suggestAmount(95), 95);
    assert.equal(suggestAmount(341), 350);
});

test('guessBucket recognises common needs', () => {
    assert.equal(guessBucket('Rent/Mortgage'), 'needs');
    assert.equal(guessBucket('Groceries'), 'needs');
    assert.equal(guessBucket('Transportation'), 'needs');
    assert.equal(guessBucket('Health & Wellness'), 'needs');
    assert.equal(guessBucket('Dining Out'), 'wants');
    assert.equal(guessBucket('Entertainment'), 'wants');
});

test('isExcludedCategory is case-insensitive', () => {
    assert.ok(isExcludedCategory(' income '));
    assert.ok(isExcludedCategory('Transfer'));
    assert.ok(!isExcludedCategory('Groceries'));
});

test('weeklyAllowance spreads a month over 52/12 weeks', () => {
    assert.equal(Math.round(weeklyAllowance(300) * 100) / 100, 69.23);
});

test('paceState allows some slack before flagging', () => {
    assert.equal(paceState(150, 300, 0.5), 'ontrack');
    assert.equal(paceState(190, 300, 0.5), 'ontrack');   // 63% vs 50% + 15%
    assert.equal(paceState(200, 300, 0.5), 'ahead');     // 67%
    assert.equal(paceState(301, 300, 0.9), 'over');
    assert.equal(paceState(300, 300, 0.9), 'ontrack');
    assert.equal(paceState(10, 0, 0.5), 'over');
});

test('billState', () => {
    assert.equal(billState(0, 800), 'due');
    assert.equal(billState(400, 800), 'partial');
    assert.equal(billState(800, 800), 'paid');
    assert.equal(billState(950, 800), 'over');
});

test('isAboveUsual stays quiet early in the month', () => {
    assert.equal(isAboveUsual(100, 200, 0.2), false);
    assert.equal(isAboveUsual(200, 200, 0.5), true);
    assert.equal(isAboveUsual(100, 200, 0.5), false);
    assert.equal(isAboveUsual(50, 0, 0.5), false);
});

test('funding with no income draws everything from savings', () => {
    const f = funding({ planTotal: 1920, inflows: [{ label: 'Family', amount: 420 }], savingsBalance: 7800, today: day('2026-11-25') });
    assert.equal(f.fromSavings, 1500);
    assert.equal(f.toSavings, 0);
    assert.equal(f.runwayMonths, 5.2);
    assert.equal(f.runwayUntil.getMonth(), 3); // April 2027
    assert.equal(f.runwayUntil.getFullYear(), 2027);
});

test('funding with income above the plan saves the difference', () => {
    const f = funding({ planTotal: 1920, inflows: [{ label: 'Job', amount: 3000 }], savingsBalance: null, today: day('2027-06-01') });
    assert.equal(f.fromSavings, 0);
    assert.equal(f.toSavings, 1080);
    assert.equal(f.runwayMonths, null);
});

test('layoutFlow pours sources into buckets without losing money', () => {
    const flow = layoutFlow({
        sources: [{ id: 'savings', value: 1500 }, { id: 'family', value: 420 }],
        buckets: [
            { id: 'needs', value: 1200, children: [{ id: 'rent', value: 800 }, { id: 'groc', value: 400 }] },
            { id: 'wants', value: 720, children: [{ id: 'fun', value: 720 }] },
        ],
        height: 240,
    });
    // savings → needs (1200), savings → wants (300), family → wants (420)
    assert.equal(flow.leftBands.length, 3);
    assert.deepEqual(flow.leftBands.map(b => `${b.from}>${b.to}`), ['savings>needs', 'savings>wants', 'family>wants']);
    const heightOf = (bands) => bands.reduce((s, b) => s + (b.y1 - b.y0), 0);
    const midHeight = flow.mid.reduce((s, n) => s + n.h, 0);
    assert.ok(Math.abs(heightOf(flow.rightBands) - midHeight) < 1e-6);
    // Each band's height matches on both ends of the right column
    flow.rightBands.forEach(b => assert.ok(Math.abs((b.y1 - b.y0) - (b.t1 - b.t0)) < 1e-6));
    assert.equal(layoutFlow({ sources: [], buckets: [] }), null);
});

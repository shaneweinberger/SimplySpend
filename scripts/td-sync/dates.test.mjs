// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, parseVisaPeriod, selectVisaPeriods, syncStart, parts, parseMonthDayYear } from './dates.mjs';

const TODAY = '2026-11-12';
// Exactly what EasyWeb showed on 2026-11-12.
const OPTIONS = [
    'Oct 21, 2026 to today (Since last statement)',
    'Sep 22, 2026 - Oct 20, 2026 (Last statement)',
    'Aug 21, 2026 - Sep 21, 2026',
    'Jul 21, 2026 - Aug 20, 2026',
    'Jun 23, 2026 - Jul 20, 2026',
    'May 21, 2026 - Jun 22, 2026',
];

test('addDays crosses month and year boundaries', () => {
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(addDays('2026-01-03', -7), '2025-12-27');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('parseMonthDayYear', () => {
    assert.equal(parseMonthDayYear('Oct 21, 2026'), '2026-10-21');
    assert.equal(parseMonthDayYear('Sep 2, 2026'), '2026-09-02');
    assert.equal(parseMonthDayYear('nonsense'), null);
});

test('parses the current-cycle option', () => {
    assert.deepEqual(parseVisaPeriod(OPTIONS[0], TODAY), { start: '2026-10-21', end: TODAY });
});

test('parses closed-cycle options with and without a suffix', () => {
    assert.deepEqual(parseVisaPeriod(OPTIONS[1], TODAY), { start: '2026-09-22', end: '2026-10-20' });
    assert.deepEqual(parseVisaPeriod(OPTIONS[2], TODAY), { start: '2026-08-21', end: '2026-09-21' });
});

test('a recent sync only needs the current cycle', () => {
    const { selected } = selectVisaPeriods(OPTIONS, '2026-11-01', TODAY, TODAY);
    assert.deepEqual(selected.map((s) => s.text), [OPTIONS[0]]);
});

test('a range spanning a statement close takes both cycles', () => {
    const { selected } = selectVisaPeriods(OPTIONS, '2026-10-13', TODAY, TODAY);
    assert.deepEqual(selected.map((s) => s.text), [OPTIONS[0], OPTIONS[1]]);
});

test('boundary days count as overlap', () => {
    const { selected } = selectVisaPeriods(OPTIONS, '2026-10-20', '2026-10-20', TODAY);
    assert.deepEqual(selected.map((s) => s.text), [OPTIONS[1]]);
});

test('unrecognised options are reported, not guessed', () => {
    const { selected, unparsed } = selectVisaPeriods(['Something new', ...OPTIONS], '2026-11-01', TODAY, TODAY);
    assert.deepEqual(unparsed, ['Something new']);
    assert.equal(selected.length, 1);
});

test('syncStart: overlap, override, first run', () => {
    assert.equal(syncStart({ latest: '2026-11-10', since: null, today: TODAY }), '2026-11-03');
    assert.equal(syncStart({ latest: '2026-11-10', since: '2026-01-01', today: TODAY }), '2026-01-01');
    assert.equal(syncStart({ latest: null, since: null, today: TODAY }), '2026-08-14');
});

test('parts builds EasyWeb calendar labels', () => {
    const p = parts('2026-02-04');
    assert.equal(`${p.monthName} ${p.day}, ${p.year}`, 'February 4, 2026');
});

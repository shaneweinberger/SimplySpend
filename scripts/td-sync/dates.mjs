// Calendar-date helpers for the sync. All dates are "YYYY-MM-DD" strings in
// local time; nothing round-trips through toISOString(), which would shift the
// day by the UTC offset (same rule as csvParser.js normalizeDate).

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map((m) => m.slice(0, 3).toLowerCase());

const pad = (n) => String(n).padStart(2, '0');

export function toYmd(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayYmd(now = new Date()) {
    return toYmd(now);
}

export function parseYmd(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function addDays(ymd, days) {
    const d = parseYmd(ymd);
    d.setDate(d.getDate() + days);
    return toYmd(d);
}

/** { year, month (1-12), day, monthName } for building EasyWeb calendar labels. */
export function parts(ymd) {
    const [year, month, day] = ymd.split('-').map(Number);
    return { year, month, day, monthName: MONTHS[month - 1] };
}

/** "Oct 21, 2026" → "2026-10-21", or null. */
export function parseMonthDayYear(text) {
    const m = String(text).trim().match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})$/);
    if (!m) return null;
    const month = SHORT.indexOf(m[1].toLowerCase()) + 1;
    if (month === 0) return null;
    return `${m[3]}-${pad(month)}-${pad(Number(m[2]))}`;
}

/**
 * Parses a Visa "Select Period" option into a date range.
 *   "Oct 21, 2026 to today (Since last statement)" → { start: '2026-10-21', end: today }
 *   "Sep 22, 2026 - Oct 20, 2026 (Last statement)"  → { start: '2026-09-22', end: '2026-10-20' }
 * Returns null for anything unrecognised.
 */
export function parseVisaPeriod(text, today = todayYmd()) {
    const body = String(text).replace(/\(.*?\)/g, '').trim();
    let m = body.match(/^(.+?)\s+to\s+today$/i);
    if (m) {
        const start = parseMonthDayYear(m[1]);
        return start ? { start, end: today } : null;
    }
    m = body.match(/^(.+?)\s+[-–]\s+(.+)$/);
    if (m) {
        const start = parseMonthDayYear(m[1]);
        const end = parseMonthDayYear(m[2]);
        return start && end ? { start, end } : null;
    }
    return null;
}

/**
 * Which Visa periods to download for [from, to]: every option whose range
 * overlaps it. Order is preserved (EasyWeb lists newest first).
 * @returns {{ selected: Array<{text, start, end}>, unparsed: string[] }}
 */
export function selectVisaPeriods(optionTexts, from, to, today = todayYmd()) {
    const selected = [];
    const unparsed = [];
    for (const text of optionTexts) {
        const range = parseVisaPeriod(text, today);
        if (!range) { unparsed.push(text); continue; }
        if (range.start <= to && range.end >= from) selected.push({ text, ...range });
    }
    return { selected, unparsed };
}

/**
 * Start of the range to download for one account.
 * @param latest   latest transaction date already in bronze, or null
 * @param since    --since override, or null
 * @param overlapDays  how far before `latest` to start (catches late postings)
 * @param firstRunDays default lookback when the account has no rows yet
 */
export function syncStart({ latest, since, today = todayYmd(), overlapDays = 7, firstRunDays = 90 }) {
    if (since) return since;
    if (latest) return addDays(latest, -overlapDays);
    return addDays(today, -firstRunDays);
}

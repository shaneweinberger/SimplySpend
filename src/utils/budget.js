/**
 * Budget math, kept free of React and Supabase so it can be unit tested.
 *
 * Conventions:
 *   - Dates are local 'YYYY-MM-DD' strings, matching silver_transactions.effective_date.
 *   - "Spend" is net and positive: outflows (negative amounts) add to it, refunds
 *     (positive amounts in a spending category) reduce it.
 *   - Budget amounts are monthly. Weekly allowances are derived from them.
 */

export const UNCATEGORIZED = 'Uncategorized';

/** "$1,234" (or "$1,234.50" with cents). Negative values keep their sign. */
export function formatMoney(value, { cents = false } = {}) {
    const n = Number(value) || 0;
    const abs = Math.abs(n).toLocaleString(undefined, {
        minimumFractionDigits: cents ? 2 : 0,
        maximumFractionDigits: cents ? 2 : 0,
    });
    return `${n < 0 ? '−' : ''}$${abs}`;
}

// Money moving between your own accounts, or coming in, is never spending.
const EXCLUDED_CATEGORIES = new Set(['income', 'transfer', 'transfers']);

export function isExcludedCategory(name) {
    return EXCLUDED_CATEGORIES.has(String(name || '').trim().toLowerCase());
}

// ── Dates ────────────────────────────────────────────────────────────────────

export function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Parses 'YYYY-MM-DD' as a local date at noon (immune to DST edges). */
export function parseISODate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
}

export function monthPeriod(today) {
    const y = today.getFullYear();
    const m = today.getMonth();
    const daysInPeriod = new Date(y, m + 1, 0).getDate();
    const dayIndex = today.getDate(); // 1-based: today counts as a day already in play
    return {
        start: toISODate(new Date(y, m, 1)),
        end: toISODate(new Date(y, m, daysInPeriod)),
        daysInPeriod,
        dayIndex,
        elapsed: dayIndex / daysInPeriod,
        daysLeft: daysInPeriod - dayIndex + 1, // including today
    };
}

/** Weeks start on Monday. */
export function weekPeriod(today) {
    const offset = (today.getDay() + 6) % 7; // Mon → 0 … Sun → 6
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset, 12);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 12);
    return {
        start: toISODate(start),
        end: toISODate(end),
        daysInPeriod: 7,
        dayIndex: offset + 1,
        elapsed: (offset + 1) / 7,
        daysLeft: 7 - offset,
    };
}

/** The N full calendar months before `today`'s month, oldest first. */
export function previousMonths(today, count) {
    const months = [];
    for (let i = count; i >= 1; i--) {
        const first = new Date(today.getFullYear(), today.getMonth() - i, 1, 12);
        const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
        months.push({
            key: toISODate(first).slice(0, 7),
            label: first.toLocaleDateString(undefined, { month: 'short' }),
            start: toISODate(first),
            end: toISODate(last),
        });
    }
    return months;
}

// ── Spending ─────────────────────────────────────────────────────────────────

/**
 * Net spend per category for transactions whose effective_date is in [start, end].
 * Returns { byCategory: Map<name, number>, total: number }. Categories whose net
 * is a refund (negative) count as 0 toward the total.
 */
export function spendInRange(transactions, start, end) {
    const byCategory = new Map();
    for (const tx of transactions) {
        if (tx.is_split) continue; // its parts carry the money
        const date = tx.effective_date;
        if (!date || date < start || date > end) continue;
        const category = tx.category || UNCATEGORIZED;
        if (isExcludedCategory(category)) continue;
        const amount = Number(tx.amount);
        if (!Number.isFinite(amount)) continue;
        byCategory.set(category, (byCategory.get(category) || 0) - amount);
    }
    let total = 0;
    for (const [name, value] of byCategory) {
        const rounded = Math.round(value * 100) / 100;
        byCategory.set(name, rounded);
        total += Math.max(0, rounded);
    }
    return { byCategory, total: Math.round(total * 100) / 100 };
}

export function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * What you usually spend, from the full months before `today`.
 * Returns { months, byCategory: Map<name, { usual, history: number[] }>, usualTotal }.
 * A month with no transactions at all is treated as missing data rather than
 * a $0 month, so a new user's suggestions aren't dragged down by empty months.
 */
export function spendingHistory(transactions, today, monthCount = 3) {
    const months = previousMonths(today, monthCount);
    const perMonth = months.map(m => spendInRange(transactions, m.start, m.end));
    const withData = perMonth.map(p => p.byCategory.size > 0);

    const names = new Set();
    perMonth.forEach(p => p.byCategory.forEach((_, name) => names.add(name)));

    const byCategory = new Map();
    for (const name of names) {
        const history = perMonth.map(p => Math.max(0, p.byCategory.get(name) || 0));
        const counted = history.filter((_, i) => withData[i]);
        byCategory.set(name, { usual: median(counted), history });
    }
    const usualTotal = median(perMonth.filter((_, i) => withData[i]).map(p => p.total));
    return { months, byCategory, usualTotal, monthsWithData: withData.filter(Boolean).length };
}

// ── Suggestions ──────────────────────────────────────────────────────────────

/** Round a usual amount up to a tidy budget: nearest $5 under $100, else $10. */
export function suggestAmount(usual) {
    if (!(usual > 0)) return 0;
    const step = usual < 100 ? 5 : 10;
    return Math.ceil(usual / step) * step;
}

const NEEDS_PATTERN = /rent|mortgage|housing|utilit|hydro|electric|water|grocer|transport|transit|commut|gas\b|fuel|health|medical|pharm|dental|insurance|phone|mobile|internet|tuition|textbook|education|school|childcare|loan|debt|bill/i;

export function guessBucket(categoryName) {
    return NEEDS_PATTERN.test(categoryName || '') ? 'needs' : 'wants';
}

// ── Tracking ─────────────────────────────────────────────────────────────────

export function weeklyAllowance(monthlyAmount) {
    return (Number(monthlyAmount) || 0) * 12 / 52;
}

// How far ahead of the pace line spending can run before it's flagged. Spending
// is lumpy (one big grocery run), so a little slack keeps the amber state rare.
const PACE_TOLERANCE = 0.15;

/** 'over' | 'ahead' | 'ontrack' */
export function paceState(spent, budget, elapsed) {
    if (budget <= 0) return spent > 0 ? 'over' : 'ontrack';
    if (spent > budget + 0.005) return 'over';
    if (spent / budget > elapsed + PACE_TOLERANCE) return 'ahead';
    return 'ontrack';
}

/** For fixed bills. 'paid' | 'partial' | 'due' | 'over' */
export function billState(spent, amount) {
    if (amount > 0 && spent > amount * 1.1) return 'over';
    if (spent > 0 && spent >= amount * 0.9) return 'paid';
    if (spent > 0) return 'partial';
    return 'due';
}

/**
 * Whether a category is running well above what you usually spend, projected
 * to the end of the period. Quiet in the first week to avoid early noise.
 */
export function isAboveUsual(spent, usual, elapsed) {
    if (!(usual > 0) || elapsed < 0.25 || spent < 20) return false;
    return spent / elapsed > usual * 1.25;
}

// ── Funding and runway ───────────────────────────────────────────────────────

export function sumInflows(inflows) {
    return (inflows || []).reduce((sum, i) => sum + (Number(i.amount) > 0 ? Number(i.amount) : 0), 0);
}

/**
 * How the plan is paid for. Anything the inflows don't cover comes out of
 * savings; anything they more than cover is saved.
 *   → { inflowTotal, fromSavings, toSavings, runwayMonths, runwayUntil }
 * runwayMonths/runwayUntil are null when there's no draw or no balance on file.
 */
export function funding({ planTotal, inflows, savingsBalance, today }) {
    const inflowTotal = sumInflows(inflows);
    const fromSavings = Math.max(0, planTotal - inflowTotal);
    const toSavings = Math.max(0, inflowTotal - planTotal);

    let runwayMonths = null;
    let runwayUntil = null;
    if (fromSavings > 0 && Number(savingsBalance) > 0) {
        runwayMonths = savingsBalance / fromSavings;
        const whole = Math.floor(runwayMonths);
        runwayUntil = new Date(today.getFullYear(), today.getMonth() + whole, 1, 12);
    }
    return { inflowTotal, fromSavings, toSavings, runwayMonths, runwayUntil };
}

// ── Plan flow (Sankey) layout ────────────────────────────────────────────────

/**
 * Lays out a three-column flow: sources → buckets → categories.
 *
 * sources:    [{ id, label, value }]
 * buckets:    [{ id, label, value, children: [{ id, label, value, color }] }]
 * Money from sources is poured into buckets in order (the first source fills
 * the first bucket, then spills into the next), so bands never cross.
 *
 * Node heights are proportional to value. Category nodes are spaced so each
 * label gets at least `labelGap` px, which can push the right column taller
 * than the others; bands still connect exactly because they're drawn from the
 * laid-out positions.
 */
export function layoutFlow({ sources, buckets, height = 260, gap = 12, childGap = 6, labelGap = 18 }) {
    const total = buckets.reduce((s, b) => s + b.value, 0);
    if (total <= 0) return null;
    const usable = height - gap * Math.max(0, buckets.length - 1);
    const scale = usable / total;

    // Middle column: buckets
    let y = 0;
    const mid = buckets.map(b => {
        const h = b.value * scale;
        const node = { ...b, y, h };
        y += h + gap;
        return node;
    });

    // Left column: sources, spanning the same height as the buckets. Callers pass
    // sources that sum to the bucket total (a surplus becomes a Savings bucket).
    const srcTotal = sources.reduce((s, x) => s + x.value, 0) || total;
    const srcScale = (height - gap * Math.max(0, sources.length - 1)) / srcTotal;
    y = 0;
    const left = sources.map(s => {
        const h = s.value * srcScale;
        const node = { ...s, y, h };
        y += h + gap;
        return node;
    });

    // Bands: source → bucket, pouring in order
    const leftBands = [];
    let si = 0;
    let srcUsed = 0;
    for (const b of mid) {
        let need = b.value;
        let bucketUsed = 0;
        while (need > 1e-9 && si < left.length) {
            const s = left[si];
            const take = Math.min(need, s.value - srcUsed);
            if (take > 1e-9) {
                leftBands.push({
                    from: s.id, to: b.id,
                    y0: s.y + srcUsed * srcScale, y1: s.y + (srcUsed + take) * srcScale,
                    t0: b.y + bucketUsed * scale, t1: b.y + (bucketUsed + take) * scale,
                });
            }
            need -= take;
            bucketUsed += take;
            srcUsed += take;
            if (s.value - srcUsed <= 1e-9) { si += 1; srcUsed = 0; }
        }
    }

    // Right column: categories, with room for each label
    const right = [];
    const rightBands = [];
    y = 0;
    mid.forEach((b, bi) => {
        if (bi > 0) y += gap - childGap;
        let used = 0;
        for (const c of b.children) {
            const h = c.value * scale;
            const node = { ...c, bucket: b.id, y, h };
            right.push(node);
            rightBands.push({
                from: b.id, to: c.id,
                y0: b.y + used, y1: b.y + used + h,
                t0: y, t1: y + h,
            });
            used += h;
            y += Math.max(h, labelGap - childGap) + childGap;
        }
    });
    const rightHeight = right.length ? Math.max(...right.map(n => n.y + n.h)) : 0;

    return {
        left, mid, right, leftBands, rightBands,
        height: Math.max(height, rightHeight),
    };
}

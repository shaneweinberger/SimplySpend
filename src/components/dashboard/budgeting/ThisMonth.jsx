import React, { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import {
    formatMoney, paceState, billState, isAboveUsual, weeklyAllowance,
    isExcludedCategory, parseISODate, UNCATEGORIZED,
} from '../../../utils/budget';
import { BUCKET_COLORS } from './colors';
import { CategoryDot, ListCard, Pill, SectionHeader } from './parts';

const STATE_TEXT = { ontrack: 'text-slate-900', ahead: 'text-amber-600', over: 'text-rose-600' };
const STATE_FILL = { ontrack: 'bg-accent', ahead: 'bg-amber-500', over: 'bg-rose-500' };

// One grid for every row, so names, bars and numbers line up down the page.
// Phones: name + status on top, bar under, detail under that.
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 items-center sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_8.5rem_6rem] sm:gap-x-6';
const CELL = {
    name: 'col-start-1 row-start-1 flex items-center gap-2.5 min-w-0',
    bar: 'col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1',
    amount: 'hidden sm:block sm:col-start-3 sm:row-start-1 text-right text-sm tabular-nums',
    status: 'col-start-2 row-start-1 sm:col-start-4 text-right text-sm font-medium tabular-nums whitespace-nowrap',
    detail: 'col-span-2 row-start-3 sm:hidden text-xs text-slate-400 tabular-nums -mt-0.5',
};

const shortDate = (iso) => parseISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function ProgressBar({ pct, elapsed, state, thick = false }) {
    return (
        <div className={`relative rounded-full bg-slate-100 ${thick ? 'h-2.5' : 'h-2'}`}>
            <div
                className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${STATE_FILL[state]}`}
                style={{ width: `${Math.min(100, Math.max(0, pct) * 100)}%` }}
            />
            <div
                className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded-full bg-slate-900 ring-2 ring-white"
                style={{ left: `calc(${Math.min(100, elapsed * 100)}% - 1px)` }}
                title="Today"
                aria-hidden="true"
            />
        </div>
    );
}

function TransactionList({ transactions }) {
    const [showAll, setShowAll] = useState(false);
    const shown = showAll ? transactions : transactions.slice(0, 6);
    return (
        <div className="bg-slate-50/70 border-t border-slate-100 pl-[2.6rem] pr-5 py-2">
            {transactions.length === 0 ? (
                <p className="py-2 text-xs text-slate-400">No transactions yet.</p>
            ) : (
                <ul>
                    {shown.map(tx => {
                        const amount = Number(tx.amount);
                        return (
                            <li key={tx.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] gap-4 py-1.5 text-sm">
                                <span className="text-slate-400 tabular-nums">{shortDate(tx.effective_date)}</span>
                                <span className="truncate text-slate-600">{tx.description}</span>
                                <span className={`tabular-nums ${amount > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                                    {amount > 0 ? '+' : ''}{formatMoney(Math.abs(amount), { cents: true })}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            {transactions.length > 6 && (
                <button type="button" onClick={() => setShowAll(s => !s)} className="py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800">
                    {showAll ? 'Show less' : `Show all ${transactions.length}`}
                </button>
            )}
        </div>
    );
}

function ExpandableRow({ expanded, onToggle, children, panel }) {
    return (
        <li>
            <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={onToggle}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
                className={`${ROW_GRID} px-5 py-4 cursor-pointer select-none transition-colors hover:bg-slate-50/70 focus:outline-none focus-visible:bg-slate-50`}
            >
                {children}
            </div>
            {expanded && panel}
        </li>
    );
}

function RowName({ color, name, children }) {
    return (
        <span className={CELL.name}>
            <CategoryDot color={color} />
            <span className="truncate text-sm font-medium text-slate-800">{name}</span>
            {children}
        </span>
    );
}

function BudgetRow({ row, expanded, onToggle }) {
    const { name, color, cadence, is_fixed, spent, allowance, state, elapsed, bill, transactions } = row;
    const left = allowance - spent;
    const asBill = is_fixed && bill !== 'partial';
    const lastPaid = transactions.find(t => Number(t.amount) < 0)?.effective_date;

    return (
        <ExpandableRow expanded={expanded} onToggle={onToggle} panel={<TransactionList transactions={transactions} />}>
            <RowName color={color} name={name}>
                {cadence === 'week' && <Pill>Weekly</Pill>}
            </RowName>

            {asBill ? (
                <>
                    <span className={`${CELL.bar} text-xs text-slate-400`}>
                        {bill === 'due' ? 'Not paid yet this month' : `Paid ${lastPaid ? shortDate(lastPaid) : ''}`}
                    </span>
                    <span className={CELL.amount}>
                        <span className="text-slate-900">{formatMoney(bill === 'due' ? 0 : spent)}</span>
                        <span className="text-slate-400"> of {formatMoney(allowance)}</span>
                    </span>
                    <span className={`${CELL.status} ${bill === 'over' ? 'text-rose-600' : bill === 'paid' ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {bill === 'paid' && <span className="inline-flex items-center gap-1"><Check size={14} strokeWidth={2.5} />Paid</span>}
                        {bill === 'due' && 'Due'}
                        {bill === 'over' && `${formatMoney(spent - allowance)} over`}
                    </span>
                </>
            ) : (
                <>
                    <span className={CELL.bar}>
                        <ProgressBar pct={allowance > 0 ? spent / allowance : (spent > 0 ? 1 : 0)} elapsed={elapsed} state={state} />
                    </span>
                    <span className={CELL.amount}>
                        <span className="text-slate-900">{formatMoney(spent)}</span>
                        <span className="text-slate-400"> of {formatMoney(allowance)}{cadence === 'week' ? '/wk' : ''}</span>
                    </span>
                    <span className={`${CELL.status} ${STATE_TEXT[state]}`} title={state === 'ahead' ? 'Spending faster than planned' : undefined}>
                        {state === 'over' ? `${formatMoney(-left)} over` : `${formatMoney(left)} left`}
                    </span>
                    <span className={CELL.detail}>
                        {formatMoney(spent)} of {formatMoney(allowance)}{cadence === 'week' ? ' this week' : ''}
                        {state === 'ahead' && <span className="text-amber-600"> · ahead of pace</span>}
                    </span>
                </>
            )}
        </ExpandableRow>
    );
}

function UnplannedRow({ row, expanded, onToggle, onAdd }) {
    const note = row.aboveUsual ? `Above your usual ${formatMoney(row.usual)}` : row.usual > 0 ? `Usually ${formatMoney(row.usual)}` : '';
    const noteClass = row.aboveUsual ? 'text-amber-600' : 'text-slate-400';
    const addButton = onAdd && (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="inline-flex items-center gap-1 px-2 py-1 -my-1 -mr-2 text-xs font-medium text-slate-500 rounded-lg hover:bg-slate-100 hover:text-slate-900"
        >
            <Plus size={13} />Add to plan
        </button>
    );
    return (
        <ExpandableRow expanded={expanded} onToggle={onToggle} panel={<TransactionList transactions={row.transactions} />}>
            <RowName color={row.color} name={row.name} />
            <span className={`hidden sm:block sm:col-start-2 sm:row-start-1 text-xs ${noteClass}`}>{note}</span>
            <span className={`${CELL.amount} text-slate-900`}>{formatMoney(row.spent)}</span>
            <span className={CELL.status}>
                <span className="sm:hidden text-slate-900">{formatMoney(row.spent)}</span>
                <span className="hidden sm:inline">{addButton}</span>
            </span>
            {(note || addButton) && (
                <span className="col-span-2 row-start-2 sm:hidden flex items-center justify-between gap-3 text-xs -mt-0.5">
                    <span className={noteClass}>{note}</span>
                    {addButton}
                </span>
            )}
        </ExpandableRow>
    );
}

/** A summary figure: stacked on wide screens, a label/value row on phones. */
function Stat({ label, value, sub, tone = 'text-slate-900' }) {
    return (
        <div className="min-w-0 flex items-baseline justify-between gap-4 sm:block">
            <p className="text-sm sm:text-xs font-medium text-slate-500">{label}</p>
            <p className={`sm:mt-1 text-base sm:text-lg font-semibold tracking-tight tabular-nums truncate ${tone}`}>{value}</p>
            {sub && <p className="hidden sm:block mt-0.5 text-xs text-slate-400 truncate">{sub}</p>}
        </div>
    );
}

export default function ThisMonth({
    budgets, month, week, monthSpend, weekSpend, monthTotal, plannedTotal,
    history, fund, transactions, categoriesByName, onAddToPlan,
}) {
    const [expanded, setExpanded] = useState(null);
    const toggle = (key) => setExpanded(e => (e === key ? null : key));

    const { groups, unplanned, overCount } = useMemo(() => {
        const txByCategory = new Map();
        for (const tx of transactions) {
            if (tx.is_split) continue;
            const name = tx.category || UNCATEGORIZED;
            if (!txByCategory.has(name)) txByCategory.set(name, []);
            txByCategory.get(name).push(tx);
        }
        const inRange = (list, p) => (list || []).filter(t => t.effective_date >= p.start && t.effective_date <= p.end);

        const toRow = (b) => {
            const weekly = b.cadence === 'week';
            const period = weekly ? week : month;
            const spent = Math.max(0, (weekly ? weekSpend : monthSpend).get(b.name) || 0);
            const allowance = weekly ? weeklyAllowance(b.amount) : Number(b.amount);
            return {
                ...b,
                spent,
                allowance,
                elapsed: period.elapsed,
                state: paceState(spent, allowance, period.elapsed),
                bill: billState(spent, allowance),
                transactions: inRange(txByCategory.get(b.name), period),
            };
        };

        const rows = budgets.map(toRow);
        const planned = new Set(budgets.map(b => b.name));
        const unplannedRows = [...monthSpend.entries()]
            .filter(([name, spent]) => !planned.has(name) && !isExcludedCategory(name) && spent > 0.005)
            .map(([name, spent]) => {
                const usual = history.byCategory.get(name)?.usual || 0;
                return {
                    name,
                    spent,
                    usual,
                    color: categoriesByName.get(name)?.color,
                    canAdd: categoriesByName.has(name),
                    aboveUsual: isAboveUsual(spent, usual, month.elapsed),
                    transactions: inRange(txByCategory.get(name), month),
                };
            })
            .sort((a, b) => b.spent - a.spent);

        return {
            groups: [
                { id: 'needs', label: 'Needs', rows: rows.filter(r => r.bucket === 'needs') },
                { id: 'wants', label: 'Wants', rows: rows.filter(r => r.bucket !== 'needs') },
            ].filter(g => g.rows.length),
            unplanned: unplannedRows,
            overCount: rows.filter(r => (r.is_fixed && r.bill !== 'partial' ? r.bill === 'over' : r.state === 'over')).length,
        };
    }, [budgets, month, week, monthSpend, weekSpend, history, transactions, categoriesByName]);

    const left = plannedTotal - monthTotal;
    const totalState = paceState(monthTotal, plannedTotal, month.elapsed);
    const monthName = parseISODate(month.start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const groupTotal = (rows) => {
        const spent = rows.reduce((s, r) => s + Math.max(0, monthSpend.get(r.name) || 0), 0);
        const planned = rows.reduce((s, r) => s + Number(r.amount), 0);
        return `${formatMoney(spent)} of ${formatMoney(planned)}`;
    };

    let savingsStat;
    if (fund.toSavings > 0) {
        savingsStat = { label: 'Saving each month', value: formatMoney(fund.toSavings), sub: 'Money in, minus your plan' };
    } else if (fund.runwayUntil) {
        savingsStat = { label: 'Savings last until', value: fund.runwayUntil.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }), sub: `${formatMoney(fund.fromSavings)} a month from savings` };
    } else {
        savingsStat = { label: 'From savings', value: `${formatMoney(fund.fromSavings)}/mo`, sub: 'Add your balance in Plan' };
    }

    return (
        <div className="space-y-8">
            {/* Summary */}
            <section className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-slate-500">{monthName}</p>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-600 tabular-nums">
                        {month.daysLeft === 1 ? 'Last day' : `${month.daysLeft} days left`}
                    </span>
                </div>

                <div className="mt-3 flex items-baseline gap-2.5">
                    <span className={`text-5xl font-semibold tracking-tight tabular-nums ${left < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {formatMoney(Math.abs(left))}
                    </span>
                    <span className="text-xl font-medium text-slate-400">{left < 0 ? 'over plan' : 'left to spend'}</span>
                </div>

                <div className="mt-5">
                    <ProgressBar pct={plannedTotal > 0 ? monthTotal / plannedTotal : 1} elapsed={month.elapsed} state={totalState} thick />
                    <div className="mt-2 flex justify-between text-xs text-slate-500 tabular-nums">
                        <span><span className="font-medium text-slate-700">{formatMoney(monthTotal)}</span> spent</span>
                        <span><span className="font-medium text-slate-700">{formatMoney(plannedTotal)}</span> planned</span>
                    </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
                    <Stat
                        label="Per day"
                        value={left > 0 ? formatMoney(left / month.daysLeft) : '—'}
                        sub={left > 0 ? `for ${month.daysLeft === 1 ? 'today' : `the next ${month.daysLeft} days`}` : 'Nothing left this month'}
                    />
                    <Stat
                        label="Over budget"
                        value={overCount === 0 ? 'None' : `${overCount} ${overCount === 1 ? 'category' : 'categories'}`}
                        tone={overCount ? 'text-rose-600' : 'text-slate-900'}
                        sub={`of ${budgets.length} in your plan`}
                    />
                    <Stat {...savingsStat} />
                </div>
            </section>

            {groups.map(g => (
                <section key={g.id}>
                    <SectionHeader color={BUCKET_COLORS[g.id]} title={g.label} right={groupTotal(g.rows)} />
                    <ListCard>
                        <ul className="divide-y divide-slate-100">
                            {g.rows.map(row => (
                                <BudgetRow key={row.id} row={row} expanded={expanded === row.id} onToggle={() => toggle(row.id)} />
                            ))}
                        </ul>
                    </ListCard>
                </section>
            ))}

            {unplanned.length > 0 && (
                <section>
                    <SectionHeader title="Not in your plan" right={formatMoney(unplanned.reduce((s, r) => s + r.spent, 0))} />
                    <ListCard>
                        <ul className="divide-y divide-slate-100">
                            {unplanned.map(row => (
                                <UnplannedRow
                                    key={row.name}
                                    row={row}
                                    expanded={expanded === `u:${row.name}`}
                                    onToggle={() => toggle(`u:${row.name}`)}
                                    onAdd={row.canAdd ? () => onAddToPlan(row.name) : null}
                                />
                            ))}
                        </ul>
                    </ListCard>
                </section>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5"><span className="w-[2px] h-3 rounded-full bg-slate-900" />Today</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent" />On track</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Ahead of pace</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" />Over</span>
                <span className="sm:ml-auto">Income and transfers aren't counted as spending.</span>
            </div>
        </div>
    );
}

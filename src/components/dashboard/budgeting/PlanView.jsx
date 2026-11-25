import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { formatMoney, weeklyAllowance } from '../../../utils/budget';
import PlanFlow from './PlanFlow';
import { BUCKET_COLORS } from './colors';
import { AmountInput, CategoryDot, ListCard, MiniHistory, Pill, RowMenu, SectionHeader } from './parts';

// A plan this far under what you usually spend gets a gentle "big cut" note.
const BIG_CUT = 0.75;

// Shared columns: category · usually · budget · menu
const PLAN_GRID = 'grid grid-cols-[minmax(0,1fr)_6.5rem_2rem] gap-x-3 items-center sm:grid-cols-[minmax(0,1fr)_10rem_7rem_2rem] sm:gap-x-5';

function ColumnLabels({ last = 'Monthly budget' }) {
    return (
        <div className={`${PLAN_GRID} px-5 pt-3 pb-2 text-xs font-medium text-slate-400 border-b border-slate-100`}>
            <span>Category</span>
            <span className="hidden sm:block text-right">Usually</span>
            <span className="text-right pr-2.5"><span className="sm:hidden">Budget</span><span className="hidden sm:inline">{last}</span></span>
            <span />
        </div>
    );
}

function UsualCell({ usage, months, warn }) {
    const usual = usage?.usual || 0;
    return (
        <span className={`hidden sm:flex items-center justify-end gap-2.5 text-sm tabular-nums ${warn ? 'text-amber-600' : 'text-slate-500'}`}>
            {usual > 0 ? formatMoney(usual) : <span className="text-slate-300">—</span>}
            {usage && <MiniHistory history={usage.history} months={months} />}
        </span>
    );
}

function PlanRow({ budget, usage, months, onUpdate, onRemove }) {
    const usual = usage?.usual || 0;
    const bigCut = usual > 0 && Number(budget.amount) < usual * BIG_CUT;
    const otherBucket = budget.bucket === 'needs' ? 'wants' : 'needs';

    return (
        <li className={`${PLAN_GRID} px-5 py-3.5`}>
            <span className="min-w-0">
                <span className="flex items-center gap-2.5 min-w-0">
                    <CategoryDot color={budget.color} />
                    <span className="truncate text-sm font-medium text-slate-800">{budget.name}</span>
                    <span className="hidden sm:contents">
                        {budget.cadence === 'week' && <Pill>Weekly · {formatMoney(weeklyAllowance(budget.amount))}</Pill>}
                        {budget.is_fixed && <Pill>Bill</Pill>}
                    </span>
                </span>
                {bigCut && <span className="block pl-5 mt-0.5 text-xs text-amber-600">Big cut from your usual {formatMoney(usual)}</span>}
                {/* Phones: badges and "usually" share one quiet line under the name */}
                <span className="sm:hidden block pl-5 mt-0.5 text-xs text-slate-400 truncate">
                    {[
                        budget.cadence === 'week' && `${formatMoney(weeklyAllowance(budget.amount))}/wk`,
                        budget.is_fixed && 'Bill',
                        !bigCut && usual > 0 && `Usually ${formatMoney(usual)}`,
                    ].filter(Boolean).join(' · ')}
                </span>
            </span>
            <UsualCell usage={usage} months={months} warn={bigCut} />
            <AmountInput value={Number(budget.amount)} label={`${budget.name} monthly budget`} onSave={(amount) => onUpdate({ amount })} />
            <RowMenu
                label={`Options for ${budget.name}`}
                items={[
                    { label: `Move to ${otherBucket === 'needs' ? 'Needs' : 'Wants'}`, onClick: () => onUpdate({ bucket: otherBucket }) },
                    budget.cadence === 'week'
                        ? { label: 'Track monthly', onClick: () => onUpdate({ cadence: 'month' }) }
                        : { label: 'Track weekly', onClick: () => onUpdate({ cadence: 'week' }) },
                    budget.is_fixed
                        ? { label: 'Not a fixed bill', onClick: () => onUpdate({ is_fixed: false }) }
                        : { label: 'Mark as a fixed bill', onClick: () => onUpdate({ is_fixed: true }) },
                    { label: 'Remove from plan', onClick: onRemove, danger: true },
                ]}
            />
        </li>
    );
}

function InflowRow({ inflow, onChange, onRemove }) {
    // null while not editing, so the field always shows the saved label.
    const [label, setLabel] = useState(null);
    return (
        <li className="group grid grid-cols-[minmax(0,1fr)_7rem_1.75rem] items-center gap-2 py-1">
            <input
                type="text"
                value={label ?? inflow.label}
                aria-label="Where this money comes from"
                onFocus={() => setLabel(inflow.label)}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={() => {
                    if (label === null) return;
                    const next = label.trim() || 'Income';
                    setLabel(null);
                    if (next !== inflow.label) onChange({ ...inflow, label: next });
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="w-full px-2.5 py-1.5 -ml-2.5 text-sm text-slate-800 bg-transparent rounded-lg border border-transparent hover:bg-slate-50 hover:border-slate-200 focus:bg-white focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100"
            />
            <AmountInput value={Number(inflow.amount) || 0} label={`${inflow.label} per month`} onSave={(amount) => onChange({ ...inflow, amount })} />
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${inflow.label}`}
                className="p-1 rounded-md text-slate-300 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-rose-500 hover:bg-rose-50 transition"
            >
                <X size={14} />
            </button>
        </li>
    );
}

function Panel({ title, right, children }) {
    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4 flex flex-col">
            <div className="flex items-baseline justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                {right}
            </div>
            {children}
        </div>
    );
}

export default function PlanView({
    budgets, history, plannedTotal, settings, fund, unbudgeted,
    onUpdateBudget, onRemoveBudget, onAddBudget, onSaveSettings,
}) {
    const inflows = useMemo(() => settings.inflows || [], [settings.inflows]);

    const flowData = useMemo(() => {
        const sources = inflows
            .filter(i => Number(i.amount) > 0)
            .map((i, idx) => ({ id: `in${idx}`, label: i.label, value: Number(i.amount) }));
        if (fund.fromSavings > 0) sources.push({ id: 'from-savings', label: 'From savings', value: fund.fromSavings });

        const bucketOf = (id, label) => ({
            id,
            label,
            children: budgets.filter(b => (b.bucket === 'needs') === (id === 'needs'))
                .filter(b => Number(b.amount) > 0)
                .sort((a, b) => b.amount - a.amount)
                .map(b => ({ id: b.id, label: b.name, value: Number(b.amount) })),
        });
        const buckets = [bucketOf('needs', 'Needs'), bucketOf('wants', 'Wants')]
            .map(b => ({ ...b, value: b.children.reduce((s, c) => s + c.value, 0) }))
            .filter(b => b.value > 0);
        if (fund.toSavings > 0) {
            buckets.push({ id: 'savings', label: 'Savings', value: fund.toSavings, children: [{ id: 'saved', label: 'Saved', value: fund.toSavings }] });
        }
        return { sources, buckets };
    }, [budgets, inflows, fund]);

    const usualTotal = history.usualTotal;
    const diff = plannedTotal - usualTotal;
    let comparison = null;
    if (history.monthsWithData > 0 && usualTotal > 0) {
        comparison = Math.abs(diff) < 10
            ? <>About what you usually spend ({formatMoney(usualTotal)})</>
            : diff < 0
                ? <>You usually spend {formatMoney(usualTotal)}. This plan trims <span className="font-medium text-slate-700">{formatMoney(-diff)}</span>.</>
                : <>You usually spend {formatMoney(usualTotal)}. This plan allows <span className="font-medium text-slate-700">{formatMoney(diff)}</span> more.</>;
    }

    const saveInflows = (next) => onSaveSettings({ inflows: next });
    const groups = [
        { id: 'needs', label: 'Needs', rows: budgets.filter(b => b.bucket === 'needs') },
        { id: 'wants', label: 'Wants', rows: budgets.filter(b => b.bucket !== 'needs') },
    ];

    let runwayValue = null;
    let runwayText;
    if (fund.fromSavings <= 0) {
        runwayText = fund.toSavings > 0
            ? `Money coming in covers the plan, with ${formatMoney(fund.toSavings)} a month left to save.`
            : 'Money coming in covers the plan.';
    } else if (fund.runwayUntil) {
        runwayValue = fund.runwayUntil.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        runwayText = `At ${formatMoney(fund.fromSavings)} a month from savings.`;
    } else {
        runwayText = `The plan draws ${formatMoney(fund.fromSavings)} a month from savings. Add your balance to see how long it lasts.`;
    }

    return (
        <div className="space-y-8">
            {/* Summary and flow */}
            <section className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 sm:p-7">
                <p className="text-sm font-medium text-slate-500">Monthly plan</p>
                <div className="mt-3 flex items-baseline gap-2.5">
                    <span className="text-5xl font-semibold tracking-tight tabular-nums text-slate-900">{formatMoney(plannedTotal)}</span>
                    <span className="text-xl font-medium text-slate-400">a month</span>
                </div>
                {comparison && <p className="mt-2 text-sm text-slate-500">{comparison}</p>}

                {flowData.buckets.length > 0 && (
                    <div className="mt-7 pt-6 border-t border-slate-100">
                        <PlanFlow sources={flowData.sources} buckets={flowData.buckets} />
                    </div>
                )}
            </section>

            {/* Funding */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Panel
                    title="Money coming in"
                    right={fund.inflowTotal > 0 && <span className="text-sm text-slate-500 tabular-nums">{formatMoney(fund.inflowTotal)}/mo</span>}
                >
                    {inflows.length === 0 ? (
                        <p className="text-sm text-slate-500 leading-relaxed">None right now, and that's fine. Your plan is paid from savings.</p>
                    ) : (
                        <ul>
                            {inflows.map((inflow, idx) => (
                                <InflowRow
                                    key={idx}
                                    inflow={inflow}
                                    onChange={(next) => saveInflows(inflows.map((x, i) => (i === idx ? next : x)))}
                                    onRemove={() => saveInflows(inflows.filter((_, i) => i !== idx))}
                                />
                            ))}
                        </ul>
                    )}
                    <button
                        type="button"
                        onClick={() => saveInflows([...inflows, { label: inflows.length ? 'Other' : 'Income', amount: 0 }])}
                        className="mt-auto pt-3 self-start inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
                    >
                        <Plus size={14} />Add income, family support or a loan
                    </button>
                </Panel>

                <Panel title="Savings">
                    <div className="grid grid-cols-[minmax(0,1fr)_7rem_1.75rem] items-center gap-2 py-1">
                        <span className="text-sm text-slate-600">Current balance</span>
                        <AmountInput
                            value={Number(settings.savings_balance) || 0}
                            label="Savings balance"
                            onSave={(amount) => onSaveSettings({ savings_balance: amount, savings_balance_as_of: new Date().toISOString().slice(0, 10) })}
                        />
                        <span />
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        {runwayValue && (
                            <p className="text-sm text-slate-500">Lasts until <span className="text-base font-semibold text-slate-900">{runwayValue}</span></p>
                        )}
                        <p className={`text-sm text-slate-500 ${runwayValue ? 'mt-0.5' : ''}`}>{runwayText}</p>
                    </div>
                </Panel>
            </div>

            {/* Categories */}
            {groups.map(g => (
                <section key={g.id}>
                    <SectionHeader
                        color={BUCKET_COLORS[g.id]}
                        title={g.label}
                        right={plannedTotal > 0 ? `${formatMoney(g.rows.reduce((s, b) => s + Number(b.amount), 0))} · ${Math.round((g.rows.reduce((s, b) => s + Number(b.amount), 0) / plannedTotal) * 100)}%` : null}
                    />
                    <ListCard>
                        {g.rows.length === 0 ? (
                            <p className="px-5 py-4 text-sm text-slate-400">Nothing here yet. Move a category here from its ⋯ menu.</p>
                        ) : (
                            <>
                                <ColumnLabels />
                                <ul className="divide-y divide-slate-100">
                                    {g.rows.map(b => (
                                        <PlanRow
                                            key={b.id}
                                            budget={b}
                                            usage={history.byCategory.get(b.name)}
                                            months={history.months}
                                            onUpdate={(patch) => onUpdateBudget(b.id, patch)}
                                            onRemove={() => onRemoveBudget(b.id)}
                                        />
                                    ))}
                                </ul>
                            </>
                        )}
                    </ListCard>
                </section>
            ))}

            {unbudgeted.length > 0 && (
                <section>
                    <SectionHeader title="Not in your plan" />
                    <ListCard>
                        <ul className="divide-y divide-slate-100">
                            {unbudgeted.map(c => (
                                <li key={c.id} className={`${PLAN_GRID} px-5 py-3`}>
                                    <span className="flex items-center gap-2.5 min-w-0">
                                        <CategoryDot color={c.color} />
                                        <span className="truncate text-sm text-slate-600">{c.name}</span>
                                    </span>
                                    <UsualCell usage={history.byCategory.get(c.name)} months={history.months} />
                                    <span className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => onAddBudget(c)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900"
                                        >
                                            <Plus size={13} />Add
                                        </button>
                                    </span>
                                    <span />
                                </li>
                            ))}
                        </ul>
                    </ListCard>
                </section>
            )}

            <p className="px-1 text-xs text-slate-400">
                "Usually" is the median of your last {history.months.length} full months, so one unusual month doesn't skew it. Click any amount to change it.
            </p>
        </div>
    );
}

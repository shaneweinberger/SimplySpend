import React, { useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { formatMoney, guessBucket, suggestAmount } from '../../../utils/budget';
import { BUCKET_COLORS } from './colors';
import { CategoryDot } from './parts';

const CARD = 'bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const PRIMARY = 'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold whitespace-nowrap text-white bg-accent rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity';

/**
 * First visit: start the plan from what you usually spend. One screen, one
 * decision: which categories to include. Amounts and buckets are pre-filled
 * and can be changed afterwards in Plan.
 */
export default function SetupPlan({ categories, history, onCreate }) {
    const suggestions = useMemo(() => (
        categories
            .map(c => {
                const usual = history.byCategory.get(c.name)?.usual || 0;
                return { ...c, usual, amount: suggestAmount(usual), bucket: guessBucket(c.name) };
            })
            .filter(c => c.amount > 0)
            .sort((a, b) => b.amount - a.amount)
    ), [categories, history]);

    const [included, setIncluded] = useState(() => new Set(suggestions.map(s => s.id)));
    const [saving, setSaving] = useState(false);

    const chosen = suggestions.filter(s => included.has(s.id));
    const total = chosen.reduce((s, c) => s + c.amount, 0);
    const toggle = (id) => setIncluded(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const create = async (rows) => {
        setSaving(true);
        try { await onCreate(rows); } finally { setSaving(false); }
    };

    if (suggestions.length === 0) {
        return (
            <div className={`${CARD} max-w-xl px-7 py-8`}>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Build your monthly plan</h2>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                    There isn't a full month of spending to learn from yet. Upload or sync a few months of transactions and we'll suggest amounts, or start with an empty plan and add categories yourself.
                </p>
                <button type="button" onClick={() => create([])} disabled={saving} className={`${PRIMARY} mt-6`}>
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    Start an empty plan
                </button>
            </div>
        );
    }

    return (
        <div className={`${CARD} max-w-2xl overflow-hidden`}>
            <div className="px-7 pt-7 pb-5">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Build your monthly plan</h2>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                    We started from what you usually spend over your last {history.monthsWithData === 1 ? 'month' : `${history.monthsWithData} months`}.
                    Untick anything you don't want to track. You can change every amount afterwards.
                </p>
            </div>

            <ul className="border-t border-slate-100 divide-y divide-slate-100">
                {suggestions.map(s => {
                    const on = included.has(s.id);
                    return (
                        <li key={s.id}>
                            <label className="grid grid-cols-[1.25rem_minmax(0,1fr)_4rem_5rem] items-center gap-3 px-7 py-3 cursor-pointer hover:bg-slate-50/70 transition-colors">
                                <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="sr-only peer" />
                                <span className={`flex items-center justify-center w-5 h-5 rounded-md border transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-slate-100 ${on ? 'bg-accent border-accent text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                                    <Check size={13} strokeWidth={3} />
                                </span>
                                <span className="flex items-center gap-2.5 min-w-0">
                                    <CategoryDot color={s.color} />
                                    <span className={`truncate text-sm font-medium ${on ? 'text-slate-800' : 'text-slate-400'}`}>{s.name}</span>
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <span className="w-2 h-2 rounded-[3px]" style={{ background: BUCKET_COLORS[s.bucket] }} aria-hidden="true" />
                                    {s.bucket === 'needs' ? 'Need' : 'Want'}
                                </span>
                                <span className={`text-right text-sm font-medium tabular-nums ${on ? 'text-slate-900' : 'text-slate-300'}`}>{formatMoney(s.amount)}</span>
                            </label>
                        </li>
                    );
                })}
            </ul>

            <div className="flex items-center justify-between gap-4 px-7 py-4 bg-slate-50/70 border-t border-slate-100">
                <span className="text-sm text-slate-500 tabular-nums">
                    <span className="font-semibold text-slate-900">{formatMoney(total)}</span> a month
                </span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => create([])}
                        disabled={saving}
                        className="px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-500 rounded-xl hover:text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                    >
                        Start empty
                    </button>
                    <button type="button" onClick={() => create(chosen)} disabled={saving} className={PRIMARY}>
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        Create plan
                    </button>
                </div>
            </div>
        </div>
    );
}

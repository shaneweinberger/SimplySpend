import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { formatMoney } from '../../../utils/budget';

export function CategoryDot({ color }) {
    return (
        <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-inset ring-black/10"
            style={{ background: color || '#cbd5e1' }}
            aria-hidden="true"
        />
    );
}

export function Pill({ children, tone = 'neutral' }) {
    const tones = {
        neutral: 'text-slate-500 bg-slate-100',
        amber: 'text-amber-700 bg-amber-50',
    };
    return (
        <span className={`inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-md text-[11px] font-medium leading-none ${tones[tone]}`}>
            {children}
        </span>
    );
}

/** Section title that sits above a list card, iOS grouped-list style. */
export function SectionHeader({ color, title, right }) {
    return (
        <div className="flex items-baseline justify-between px-1 mb-2.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                {color && <span className="w-2 h-2 rounded-[3px]" style={{ background: color }} aria-hidden="true" />}
                {title}
            </h3>
            {right && <span className="text-sm text-slate-500 tabular-nums">{right}</span>}
        </div>
    );
}

export function ListCard({ children }) {
    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            {children}
        </div>
    );
}

/** Three tiny bars: what you spent in each of the last few months. */
export function MiniHistory({ history, months }) {
    const max = Math.max(...history, 1);
    return (
        <span
            className="inline-flex items-end gap-[3px] h-4"
            title={history.map((v, i) => `${months[i]?.label}: ${formatMoney(v)}`).join(' · ')}
            aria-hidden="true"
        >
            {history.map((v, i) => (
                <span
                    key={i}
                    className={`w-[4px] rounded-[1.5px] ${i === history.length - 1 ? 'bg-slate-400' : 'bg-slate-300'}`}
                    style={{ height: `${Math.max(2, (v / max) * 16)}px` }}
                />
            ))}
        </span>
    );
}

/**
 * A dollar amount that reads as plain text and edits in place.
 * Shows "$1,240" at rest, the bare number while editing. Saves on blur or Enter.
 */
export function AmountInput({ value, onSave, label, className = '' }) {
    // null while not editing, so the field always shows the saved value.
    const [draft, setDraft] = useState(null);
    const plain = String(Math.round(value));

    const commit = () => {
        if (draft === null) return;
        const next = Math.max(0, Math.round(Number(draft.replace(/[^0-9.]/g, '')) || 0));
        setDraft(null);
        if (next !== Math.round(value)) onSave(next);
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            aria-label={label}
            value={draft ?? formatMoney(value)}
            onFocus={(e) => { setDraft(plain); requestAnimationFrame(() => e.target.select()); }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') { setDraft(plain); e.currentTarget.blur(); }
            }}
            className={`w-full px-2.5 py-1.5 -my-1.5 text-sm font-medium text-right tabular-nums text-slate-900 bg-transparent rounded-lg border border-transparent hover:bg-slate-50 hover:border-slate-200 focus:bg-white focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-colors ${className}`}
        />
    );
}

/** A "⋯" button with a small menu of actions. */
export function RowMenu({ items, label }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
    }, [open]);

    return (
        <div className="relative flex justify-end" ref={ref}>
            <button
                type="button"
                aria-label={label}
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
                className={`p-1.5 rounded-lg transition-colors ${open ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
            >
                <MoreHorizontal size={16} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1.5 z-20 w-52 p-1 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-900/10">
                    {items.map((item, i) => (
                        <React.Fragment key={item.label}>
                            {item.danger && i > 0 && <div className="my-1 border-t border-slate-100" />}
                            <button
                                type="button"
                                onClick={() => { setOpen(false); item.onClick(); }}
                                className={`w-full text-left px-2.5 py-1.5 text-sm rounded-lg ${item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'}`}
                            >
                                {item.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
}

export function SegmentedControl({ value, onChange, options }) {
    return (
        <div className="inline-flex bg-slate-200/60 p-1 rounded-xl" role="tablist">
            {options.map(o => (
                <button
                    key={o.id}
                    type="button"
                    role="tab"
                    aria-selected={value === o.id}
                    onClick={() => onChange(o.id)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${value === o.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

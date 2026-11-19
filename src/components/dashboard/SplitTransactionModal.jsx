import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Loader2, Split, Check, AlertCircle, Divide } from 'lucide-react';

// Money is handled in integer cents throughout this component. A split is only
// valid when the parts add up to the original to the penny, and 0.1 + 0.2 style
// float drift would make that check flicker.
const toCents = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    if (Number.isNaN(parsed)) return null;
    return Math.round(Math.abs(parsed) * 100);
};

const formatCents = (cents) => `$${(Math.abs(cents) / 100).toFixed(2)}`;

const centsToInput = (cents) => (Math.abs(cents) / 100).toFixed(2);

let nextKey = 0;
const makePart = (overrides = {}) => ({
    key: `part-${nextKey++}`,
    amount: '',
    description: '',
    category: '',
    ...overrides
});

export default function SplitTransactionModal({
    transaction,
    existingParts = [],
    categories = [],
    onClose,
    onSave,
    onRemoveSplit
}) {
    const isEditingExisting = existingParts.length > 0;

    const [parts, setParts] = useState(() => {
        if (isEditingExisting) {
            return existingParts.map(child => makePart({
                amount: centsToInput(Math.round(parseFloat(child.amount) * 100)),
                description: child.description || '',
                category: child.category || ''
            }));
        }
        // A fresh split starts as two empty parts carrying the original's category —
        // the point of splitting is to re-categorize, but starting from where the
        // transaction already sits beats starting from Uncategorized.
        return [
            makePart({ category: transaction.category || '' }),
            makePart({ category: transaction.category || '' })
        ];
    });

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const firstAmountRef = useRef(null);

    useEffect(() => {
        firstAmountRef.current?.focus();
        firstAmountRef.current?.select();
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                if (!busy) onClose();
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [busy, onClose]);

    const signedAmount = parseFloat(transaction.amount);
    const isInflow = signedAmount > 0;
    const totalCents = Math.round(Math.abs(signedAmount) * 100);

    const allocatedCents = useMemo(
        () => parts.reduce((sum, p) => sum + (toCents(p.amount) ?? 0), 0),
        [parts]
    );
    const remainingCents = totalCents - allocatedCents;

    const hasEmptyPart = parts.some(p => !toCents(p.amount));
    const isBalanced = remainingCents === 0 && !hasEmptyPart && parts.length >= 2;

    const updatePart = (key, field, value) => {
        setParts(prev => prev.map(p => (p.key === key ? { ...p, [field]: value } : p)));
        setError(null);
    };

    const addPart = () => {
        setParts(prev => [...prev, makePart({ category: transaction.category || '' })]);
        setError(null);
    };

    const removePart = (key) => {
        setParts(prev => (prev.length <= 2 ? prev : prev.filter(p => p.key !== key)));
        setError(null);
    };

    // Even split, with the leftover pennies handed to the earliest parts so the
    // total still lands exactly on the original.
    const splitEvenly = () => {
        const n = parts.length;
        const base = Math.floor(totalCents / n);
        const leftover = totalCents - base * n;
        setParts(prev => prev.map((p, i) => ({
            ...p,
            amount: centsToInput(base + (i < leftover ? 1 : 0))
        })));
        setError(null);
    };

    const assignRemainder = () => {
        if (remainingCents === 0) return;
        setParts(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            const target = (toCents(last.amount) ?? 0) + remainingCents;
            if (target <= 0) return prev;
            next[next.length - 1] = { ...last, amount: centsToInput(target) };
            return next;
        });
        setError(null);
    };

    const handleSave = async () => {
        if (!isBalanced || busy) return;
        setBusy(true);
        setError(null);
        try {
            const sign = isInflow ? 1 : -1;
            await onSave(parts.map(p => ({
                amount: (sign * (toCents(p.amount) ?? 0)) / 100,
                description: p.description.trim(),
                category: p.category
            })));
        } catch (err) {
            setError(err.message || 'Could not save this split.');
            setBusy(false);
        }
    };

    const handleRemoveSplit = async () => {
        if (busy) return;
        if (!confirm('Remove this split? The parts will be deleted and the original transaction restored.')) return;
        setBusy(true);
        setError(null);
        try {
            await onRemoveSplit();
        } catch (err) {
            setError(err.message || 'Could not remove this split.');
            setBusy(false);
        }
    };

    const dateLabel = new Date(transaction.effective_date || transaction.transaction_date)
        .toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

    return createPortal(
        <div
            className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-150"
            onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
        >
            <div
                className="w-full max-w-2xl my-auto bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/20 animate-in zoom-in-95 duration-150"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* ── Header: what is being split ─────────────────────────────── */}
                <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-100">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-accent-light text-accent flex items-center justify-center shrink-0">
                            <Split size={18} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-bold text-slate-900 leading-tight">
                                {isEditingExisting ? 'Edit split' : 'Split transaction'}
                            </h3>
                            <p className="text-sm font-medium text-slate-500 truncate mt-0.5">
                                {transaction.description}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">
                                {dateLabel}
                                {transaction.transaction_account ? ` · ${transaction.transaction_account}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 shrink-0">
                        <div className="text-right">
                            <div className={`text-xl font-extrabold tabular-nums ${isInflow ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {isInflow ? '+' : ''}{formatCents(totalCents)}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                to allocate
                            </div>
                        </div>
                        <button
                            onClick={() => !busy && onClose()}
                            className="p-1.5 -mr-1.5 -mt-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Parts ───────────────────────────────────────────────────── */}
                <div className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Parts ({parts.length})
                        </span>
                        <button
                            onClick={splitEvenly}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-accent hover:bg-accent-light/40 transition-colors"
                        >
                            <Divide size={12} />
                            Split evenly
                        </button>
                    </div>

                    <div className="grid grid-cols-[7.5rem_1fr_9.5rem_2rem] gap-2 px-1">
                        {['Amount', 'Description', 'Category', ''].map((label, i) => (
                            <span key={i} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {label}
                            </span>
                        ))}
                    </div>

                    {parts.map((part, index) => (
                        <div key={part.key} className="grid grid-cols-[7.5rem_1fr_9.5rem_2rem] gap-2 items-center">
                            <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                                    {isInflow ? '+$' : '$'}
                                </span>
                                <input
                                    ref={index === 0 ? firstAmountRef : null}
                                    type="text"
                                    inputMode="decimal"
                                    value={part.amount}
                                    onChange={(e) => updatePart(part.key, 'amount', e.target.value)}
                                    placeholder="0.00"
                                    className={`w-full text-sm font-bold tabular-nums text-right bg-white border rounded-xl py-2 pr-2.5 outline-none transition-colors focus:ring-2 focus:ring-accent-ring focus:border-accent-border ${isInflow ? 'pl-8' : 'pl-6'} ${
                                        part.amount && !toCents(part.amount) ? 'border-rose-300' : 'border-slate-200'
                                    }`}
                                />
                            </div>

                            <input
                                type="text"
                                value={part.description}
                                onChange={(e) => updatePart(part.key, 'description', e.target.value)}
                                placeholder={transaction.description}
                                className="w-full text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none transition-colors focus:ring-2 focus:ring-accent-ring focus:border-accent-border placeholder:text-slate-300 placeholder:font-normal"
                            />

                            <select
                                value={part.category}
                                onChange={(e) => updatePart(part.key, 'category', e.target.value)}
                                className="w-full text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-2 outline-none cursor-pointer transition-colors focus:ring-2 focus:ring-accent-ring focus:border-accent-border"
                            >
                                <option value="">Uncategorized</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>

                            <button
                                onClick={() => removePart(part.key)}
                                disabled={parts.length <= 2}
                                title={parts.length <= 2 ? 'A split needs at least two parts' : 'Remove this part'}
                                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 disabled:cursor-not-allowed"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={addPart}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-accent hover:bg-accent-light/40 border border-dashed border-slate-200 hover:border-accent-border w-full justify-center transition-colors"
                    >
                        <Plus size={15} />
                        Add another part
                    </button>
                </div>

                {/* ── Balance bar ─────────────────────────────────────────────── */}
                <div className={`mx-6 mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    isBalanced
                        ? 'bg-emerald-50 border-emerald-100'
                        : remainingCents < 0
                            ? 'bg-rose-50 border-rose-100'
                            : 'bg-slate-50 border-slate-100'
                }`}>
                    <div className="flex items-center gap-2 min-w-0">
                        {isBalanced
                            ? <Check size={15} className="text-emerald-600 shrink-0" strokeWidth={3} />
                            : <AlertCircle size={15} className={`shrink-0 ${remainingCents < 0 ? 'text-rose-500' : 'text-slate-400'}`} />}
                        <span className={`text-xs font-bold truncate ${
                            isBalanced ? 'text-emerald-700' : remainingCents < 0 ? 'text-rose-700' : 'text-slate-600'
                        }`}>
                            {isBalanced
                                ? `Balanced — ${parts.length} parts totalling ${formatCents(totalCents)}`
                                : remainingCents < 0
                                    ? `Over by ${formatCents(remainingCents)} — parts total ${formatCents(allocatedCents)}`
                                    : `${formatCents(remainingCents)} left to allocate of ${formatCents(totalCents)}`}
                        </span>
                    </div>

                    {remainingCents !== 0 && (
                        <button
                            onClick={assignRemainder}
                            className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold text-accent hover:bg-white border border-transparent hover:border-accent-border transition-colors"
                        >
                            {remainingCents > 0 ? 'Add to last part' : 'Take from last part'}
                        </button>
                    )}
                </div>

                {error && (
                    <div className="mx-6 mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-700">
                        {error}
                    </div>
                )}

                {/* ── Footer ──────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                    {isEditingExisting ? (
                        <button
                            onClick={handleRemoveSplit}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                        >
                            <Trash2 size={15} />
                            Remove split
                        </button>
                    ) : <span />}

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => !busy && onClose()}
                            disabled={busy}
                            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isBalanced || busy}
                            title={isBalanced ? undefined : 'Parts must add up to the transaction total'}
                            className="flex items-center gap-2 px-4 py-2 bg-accent text-white hover:bg-accent-hover rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {busy ? <Loader2 size={15} className="animate-spin" /> : <Split size={15} />}
                            {isEditingExisting ? 'Save split' : `Split into ${parts.length}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

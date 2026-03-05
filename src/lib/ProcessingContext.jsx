import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, AlertTriangle } from 'lucide-react';

const ProcessingContext = createContext(null);

export function useProcessing() {
    const ctx = useContext(ProcessingContext);
    if (!ctx) throw new Error('useProcessing must be used within ProcessingProvider');
    return ctx;
}

export function ProcessingProvider({ children }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [label, setLabel] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const abortRef = useRef(null);

    const startProcessing = useCallback((message = 'AI is processing your transactions…') => {
        setLabel(message);
        setIsProcessing(true);
        setShowConfirm(false);
    }, []);

    const stopProcessing = useCallback(() => {
        setIsProcessing(false);
        setLabel('');
        setShowConfirm(false);
        abortRef.current = null;
    }, []);

    // Called when user confirms they want to cancel
    const cancelProcessing = useCallback(() => {
        if (abortRef.current) abortRef.current.cancelled = true;
        stopProcessing();
    }, [stopProcessing]);

    // Callers get a ref object they can poll: { cancelled: false }
    const getAbortSignal = useCallback(() => {
        const signal = { cancelled: false };
        abortRef.current = signal;
        return signal;
    }, []);

    return (
        <ProcessingContext.Provider value={{ isProcessing, startProcessing, stopProcessing, cancelProcessing, getAbortSignal }}>
            {children}
            {isProcessing && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Animated top bar */}
                        <div className="h-1 bg-slate-100 relative overflow-hidden">
                            <div className="absolute inset-y-0 left-0 w-1/2 bg-accent rounded-full animate-[slide_1.8s_ease-in-out_infinite]" />
                        </div>

                        {showConfirm ? (
                            <div className="px-6 py-8 flex flex-col items-center text-center gap-6">
                                <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center">
                                    <AlertTriangle size={28} className="text-rose-500" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-slate-900">Stop Processing?</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed px-2">
                                        Any transactions processed so far will remain, but the current run will stop.
                                    </p>
                                </div>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setShowConfirm(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all font-sans"
                                    >
                                        Keep going
                                    </button>
                                    <button
                                        onClick={cancelProcessing}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-all shadow-sm shadow-rose-200 font-sans"
                                    >
                                        Yes, stop
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="px-6 py-7 flex flex-col items-center text-center gap-4">
                                {/* Icon */}
                                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                                    <Sparkles size={26} className="text-accent animate-pulse" />
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">AI Processing</h3>
                                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{label}</p>
                                </div>

                                <p className="text-xs text-slate-400 font-medium px-4">
                                    Please stay on this page until processing completes.
                                </p>

                                {/* Cancel */}
                                <button
                                    onClick={() => setShowConfirm(true)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all"
                                >
                                    <X size={14} />
                                    Cancel Processing
                                </button>
                            </div>
                        )}
                    </div>

                    <style>{`
                        @keyframes slide {
                            0% { transform: translateX(-100%); }
                            50% { transform: translateX(300%); }
                            100% { transform: translateX(300%); }
                        }
                    `}</style>
                </div>,
                document.body
            )}
        </ProcessingContext.Provider>
    );
}

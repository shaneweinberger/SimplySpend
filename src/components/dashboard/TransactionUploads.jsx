import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, Sparkles, FileText, Plus, X } from 'lucide-react';

export default function TransactionUploads({ isNested = false, onUploadComplete }) {
    const [pendingFile, setPendingFile] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    const [savedAccounts, setSavedAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [isAddingNewAccount, setIsAddingNewAccount] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');

    const fileInputRef = useRef(null);

    const fetchAccounts = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data, error } = await supabase
                .from('user_accounts')
                .select('account_name')
                .eq('user_id', user.id)
                .order('account_name');
            if (!error && data) {
                const arr = data.map(d => d.account_name).filter(Boolean);
                setSavedAccounts(arr);
                if (arr.length > 0 && !selectedAccount) setSelectedAccount(arr[0]);
            }
        } catch (err) { console.error('Error fetching accounts:', err); }
    }, [selectedAccount]);

    useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) { setPendingFile(file); setStatus({ type: '', message: '' }); }
    };

    const handleAddAccount = async () => {
        const accName = newAccountName.trim();
        if (!accName) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            const { error } = await supabase.from('user_accounts').insert([{ user_id: user.id, account_name: accName }]);
            if (error && error.code !== '23505') throw error;
            setSavedAccounts(prev => prev.includes(accName) ? prev : [...prev, accName].sort());
            setSelectedAccount(accName);
            setIsAddingNewAccount(false);
            setNewAccountName('');
        } catch (err) {
            console.error('Error adding account:', err);
            setStatus({ type: 'error', message: `Failed to save account: ${err.message}` });
        }
    };

    const handleRunAiProcessing = async () => {
        if (!pendingFile) { setStatus({ type: 'error', message: 'Please select a CSV file first.' }); return; }
        const finalAccount = selectedAccount;
        if (!finalAccount) { setStatus({ type: 'error', message: 'Please select an account.' }); return; }

        setProcessing(true);
        setStatus({ type: 'info', message: 'Uploading…' });

        Papa.parse(pendingFile, {
            header: false,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) throw new Error('Not authenticated');

                    const fileId = crypto.randomUUID();
                    const transactions = results.data.map(row => ({
                        user_id: user.id,
                        file_id: fileId,
                        file_name: pendingFile.name,
                        transaction_account: finalAccount,
                        raw_data: { Date: row[0], Description: row[1], MoneyOut: row[2], MoneyIn: row[3], Balance: row[4] },
                        status: 'pending'
                    }));

                    const { error } = await supabase.schema('bronze').from('transactions').insert(transactions);
                    if (error) throw error;

                    setStatus({ type: 'info', message: 'Uploaded. AI categorizing…' });
                    await processTransactionsInternal();
                } catch (err) {
                    setStatus({ type: 'error', message: `Failed to upload: ${err.message}` });
                    setProcessing(false);
                }
            },
            error: (err) => { setStatus({ type: 'error', message: `CSV error: ${err.message}` }); setProcessing(false); }
        });
    };

    const processTransactionsInternal = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated.');

            let hasMore = true, totalProcessed = 0, loops = 0;
            while (hasMore && loops < 20) {
                const { data, error } = await supabase.functions.invoke('process-transactions', {
                    headers: { Authorization: `Bearer ${session.access_token}` }
                });
                if (error) throw error;
                if (Array.isArray(data)) {
                    const n = data.reduce((a, c) => a + (c.processedCount || 0), 0);
                    totalProcessed += n; hasMore = n > 0;
                } else { hasMore = false; }
                loops++;
            }

            setStatus({ type: 'success', message: `Done! ${totalProcessed} transactions processed.` });
            setPendingFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            onUploadComplete?.();
        } catch (err) {
            let msg = err.message;
            if (err.context?.json) { try { const j = await err.context.json(); if (j?.error) msg = j.error; } catch { } }
            setStatus({ type: 'error', message: `Processing failed: ${msg}` });
        } finally { setProcessing(false); }
    };

    // ─── Nested mode ─────────────────────────────────────────────────────────────
    if (isNested) {
        return (
            <div className="p-5 space-y-4">

                {status.message && (
                    <div className={`px-3 py-2.5 rounded-lg border flex items-center gap-2.5 text-sm ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                            status.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                                'bg-accent-light border-accent-light text-accent-light-text'
                        }`}>
                        {status.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        <p className="font-medium">{status.message}</p>
                    </div>
                )}

                {/* Dropzone */}
                <label className="block cursor-pointer group">
                    <div className={`flex flex-col items-center justify-center border border-dashed rounded-lg py-8 transition-all ${pendingFile ? 'bg-accent-light/40 border-accent-ring' : 'border-slate-200 hover:border-accent-ring hover:bg-slate-50/50'
                        }`}>
                        {pendingFile ? (
                            <>
                                <FileText size={22} className="text-accent mb-1.5" />
                                <span className="text-sm font-medium text-accent-light-text">{pendingFile.name}</span>
                                <span className="text-xs text-accent mt-0.5">{(pendingFile.size / 1024).toFixed(1)} KB</span>
                            </>
                        ) : (
                            <>
                                <UploadCloud size={22} className="text-slate-300 mb-1.5 group-hover:text-accent-border transition-colors" />
                                <span className="text-sm text-slate-500">Drop a CSV file here, or <span className="text-accent font-medium">browse</span></span>
                            </>
                        )}
                        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} disabled={processing} />
                    </div>
                </label>

                {/* Account + Run row */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                        <span className="text-xs text-slate-400 shrink-0">Account:</span>
                        {savedAccounts.map((account, i) => (
                            <button key={i}
                                onClick={() => { setSelectedAccount(account); setIsAddingNewAccount(false); setNewAccountName(''); }}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${selectedAccount === account && !isAddingNewAccount
                                        ? 'bg-accent text-white border-accent'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                    }`}
                            >{account}</button>
                        ))}
                        {isAddingNewAccount ? (
                            <div className="relative">
                                <input type="text" value={newAccountName}
                                    onChange={(e) => setNewAccountName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddAccount(); }}
                                    placeholder="Account name"
                                    className="pl-3 pr-14 py-1 text-xs rounded-full border-2 border-accent-border outline-none"
                                    autoFocus
                                />
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex">
                                    <button onClick={handleAddAccount} className="p-1 text-accent"><CheckCircle2 size={12} className="stroke-[3]" /></button>
                                    <button onClick={() => { setIsAddingNewAccount(false); setNewAccountName(''); }} className="p-1 text-slate-400"><X size={12} className="stroke-[3]" /></button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => { setIsAddingNewAccount(true); setSelectedAccount(''); }}
                                className="w-5 h-5 rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-accent-border hover:text-accent flex items-center justify-center transition-all"
                            ><Plus size={11} /></button>
                        )}
                    </div>
                    <button onClick={handleRunAiProcessing}
                        disabled={!pendingFile || !selectedAccount || isAddingNewAccount || processing}
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-accent-shadow"
                    >
                        {processing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {processing ? 'Processing…' : 'Run AI Processing'}
                    </button>
                </div>

            </div>
        );
    }

    // ─── Standalone mode ──────────────────────────────────────────────────────────
    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <UploadCloud className="text-accent" size={32} />
                    Transaction Ingestion
                </h1>
                <p className="text-slate-500 mt-1">Upload your raw CSV data to the Bronze layer for AI processing.</p>
            </div>

            {status.message && (
                <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                        status.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                            'bg-accent-light border-accent-ring text-accent-light-text'
                    }`}>
                    {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <p className="font-medium">{status.message}</p>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-2xl mx-auto space-y-8">
                <div>
                    <h3 className="text-base font-semibold text-slate-800 mb-3">1. Upload CSV</h3>
                    <label className="block w-full cursor-pointer group">
                        <div className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-all ${pendingFile ? 'bg-accent-light/50 border-accent-border' : 'bg-slate-50 border-slate-200 hover:border-accent-border hover:bg-white'
                            }`}>
                            {pendingFile ? (
                                <><FileText size={36} className="text-accent mb-2" /><span className="text-sm font-semibold text-accent-light-text">{pendingFile.name}</span></>
                            ) : (
                                <><UploadCloud size={36} className="text-slate-400 mb-2 group-hover:text-accent" /><span className="text-sm text-slate-600">Click or drag & drop</span></>
                            )}
                            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} disabled={processing} />
                        </div>
                    </label>
                </div>
                <div>
                    <h3 className="text-base font-semibold text-slate-800 mb-3">2. Select Account</h3>
                    <div className="flex flex-wrap gap-2">
                        {savedAccounts.map((a, i) => (
                            <button key={i} onClick={() => { setSelectedAccount(a); setIsAddingNewAccount(false); }}
                                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${selectedAccount === a && !isAddingNewAccount ? 'bg-accent text-white border-accent' : 'bg-white text-slate-700 border-slate-300 hover:border-accent-border'
                                    }`}>{a}</button>
                        ))}
                        {isAddingNewAccount ? (
                            <div className="relative">
                                <input type="text" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddAccount(); }}
                                    placeholder="e.g. TD Credit Card"
                                    className="pl-4 pr-20 py-2 rounded-full text-sm border-2 border-accent outline-none" autoFocus />
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                                    <button onClick={handleAddAccount} className="p-1.5 bg-accent-medium text-accent-light-text rounded-full"><CheckCircle2 size={14} /></button>
                                    <button onClick={() => { setIsAddingNewAccount(false); setNewAccountName(''); }} className="p-1.5 text-slate-400 rounded-full"><X size={14} /></button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => { setIsAddingNewAccount(true); setSelectedAccount(''); }}
                                className="w-9 h-9 rounded-full border-2 border-dashed border-slate-300 text-slate-400 hover:border-accent-border flex items-center justify-center"><Plus size={18} /></button>
                        )}
                    </div>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button onClick={handleRunAiProcessing}
                        disabled={!pendingFile || !selectedAccount || isAddingNewAccount || processing}
                        className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-accent-shadow">
                        {processing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        {processing ? 'Processing…' : 'Run AI Processing'}
                    </button>
                </div>
            </div>
        </div>
    );
}

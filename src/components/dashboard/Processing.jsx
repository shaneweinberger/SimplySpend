import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import TransactionUploads from './TransactionUploads';
import { FileText, Trash2 } from 'lucide-react';

export default function Processing() {
    const [uploadHistory, setUploadHistory] = useState([]);

    const fetchHistory = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data, error } = await supabase
                .schema('bronze')
                .from('transactions')
                .select('file_id, file_name, transaction_account, created_at, status')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            const uniqueFiles = [];
            const seen = new Set();
            for (const item of data) {
                if (!seen.has(item.file_id)) { seen.add(item.file_id); uniqueFiles.push(item); }
            }
            setUploadHistory(uniqueFiles);
        } catch (err) {
            console.error('Error fetching upload history:', err);
        }
    }, []);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const handleDeleteFile = async (fileId) => {
        if (!confirm('Delete this upload? All raw records for this file will be removed.')) return;
        try {
            const { error } = await supabase.schema('bronze').from('transactions').delete().eq('file_id', fileId);
            if (error) throw error;
            fetchHistory();
        } catch (err) { console.error('Delete error:', err); }
    };

    return (
        <div className="w-full pb-16 animate-in fade-in duration-500">

            {/* ── Page Header ──────────────────────────────────────────── */}
            <div className="mb-10">
                <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Data Processing</h1>
                <p className="text-sm text-slate-400 mt-0.5">Manage file imports and uploaded data.</p>
            </div>

            {/* ── Upload ───────────────────────────────────────────────── */}
            <div className="max-w-2xl mb-10">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Ingestion</p>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                    <TransactionUploads isNested={true} onUploadComplete={fetchHistory} />
                </div>
            </div>

            {/* ── Uploaded Files ───────────────────────────────────────── */}
            <div className="mb-12">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Uploaded Files</p>
                {uploadHistory.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4">No files uploaded yet.</p>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">File</th>
                                    <th className="px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Account</th>
                                    <th className="px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                                    <th className="px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-5 py-2.5 w-10" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {uploadHistory.map((file) => (
                                    <tr key={file.file_id} className="group hover:bg-slate-50/60 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <FileText size={13} className="text-slate-300 shrink-0" />
                                                <span className="text-sm text-slate-700 font-medium">{file.file_name || 'Unnamed'}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{file.transaction_account}</span>
                                        </td>
                                        <td className="px-5 py-3 text-sm text-slate-400">
                                            {new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${file.status === 'processed' ? 'text-emerald-600' :
                                                file.status === 'error' ? 'text-rose-500' : 'text-amber-500'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${file.status === 'processed' ? 'bg-emerald-500' :
                                                    file.status === 'error' ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'
                                                    }`} />
                                                {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => handleDeleteFile(file.file_id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-400 rounded transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
}


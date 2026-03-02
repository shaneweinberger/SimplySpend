
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, X, Tags, Loader2, AlertCircle } from 'lucide-react';

export default function Categories({ isNested = false }) {
    const [categories, setCategories] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => { fetchCategories(); }, []);

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase.from('user_categories').select('*').order('name');
            if (error) throw error;
            setCategories(data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addCategory = async (e) => {
        e.preventDefault();
        if (!newCategory.trim()) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from('user_categories')
                .insert([{ name: newCategory.trim(), user_id: user.id }])
                .select();
            if (error) throw error;
            setCategories(prev => [...prev, ...data].sort((a, b) => a.name.localeCompare(b.name)));
            setNewCategory('');
        } catch (err) { setError(err.message); }
    };

    const deleteCategory = async (id) => {
        try {
            const { error } = await supabase.from('user_categories').delete().eq('id', id);
            if (error) throw error;
            setCategories(prev => prev.filter(c => c.id !== id));
        } catch (err) { setError(err.message); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-20">
                <Loader2 className="animate-spin text-indigo-500" size={20} />
            </div>
        );
    }

    // ─── Nested mode: clean text rows ────────────────────────────────────────────
    if (isNested) {
        return (
            <div className="space-y-1">
                {error && (
                    <div className="flex items-center gap-2 text-xs text-rose-600 mb-2">
                        <AlertCircle size={13} />{error}
                        <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
                    </div>
                )}

                {/* Compact inline add */}
                <form onSubmit={addCategory} className="flex gap-2 mb-3">
                    <input
                        type="text"
                        placeholder="Add category…"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="flex-1 text-sm px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all placeholder:text-slate-400"
                    />
                    <button
                        type="submit"
                        disabled={!newCategory.trim()}
                        className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 transition-all flex items-center gap-1"
                    >
                        <Plus size={13} />
                        Add
                    </button>
                </form>

                {/* Text rows */}
                {categories.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No categories yet.</p>
                ) : (
                    <div className="space-y-0.5">
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                className="group flex items-center justify-between px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <span className="text-sm text-slate-700">{cat.name}</span>
                                <button
                                    onClick={() => deleteCategory(cat.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-400 rounded transition-all"
                                >
                                    <X size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ─── Standalone mode ──────────────────────────────────────────────────────────
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                    <Tags className="text-indigo-600" size={32} />
                    Manage Categories
                </h1>
                <p className="text-slate-500 mt-1">Define the categories AI will use to sort your transactions.</p>
            </header>

            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle size={20} />
                    <p className="text-sm font-medium">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-rose-400"><X size={16} /></button>
                </div>
            )}

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <form onSubmit={addCategory} className="flex gap-3 mb-6">
                    <input
                        type="text"
                        placeholder="New category (e.g. Groceries, Rent, Travel)"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-100 font-medium text-slate-900"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                    />
                    <button type="submit" disabled={!newCategory.trim()}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2">
                        <Plus size={20} />Add
                    </button>
                </form>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                    {categories.length === 0 ? (
                        <div className="col-span-full py-12 text-center">
                            <Tags size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-slate-400">No categories yet. Add one above!</p>
                        </div>
                    ) : categories.map((cat) => (
                        <div key={cat.id} className="group flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all">
                            <span className="font-semibold text-slate-700">{cat.name}</span>
                            <button onClick={() => deleteCategory(cat.id)}
                                className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all">
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
                <h3 className="text-indigo-900 font-bold mb-2 flex items-center gap-2">
                    <Plus size={18} className="text-indigo-600" />Pro Tip
                </h3>
                <p className="text-indigo-700 text-sm">Categories added here are immediately available to Gemini AI during processing.</p>
            </div>
        </div>
    );
}

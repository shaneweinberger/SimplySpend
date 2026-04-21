import React, { useState, useEffect } from 'react';
import { User, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { theme } from '../../theme';

export default function Settings() {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [user, setUser] = useState(null);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: ''
    });

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user) {
                setUser(data.user);
            }
        });
    }, []);

    useEffect(() => {
        if (user) fetchProfile();
    }, [user]);

    const fetchProfile = async () => {
        setFetching(true);
        setStatus({ type: '', message: '' });
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setFormData({
                    first_name: data.first_name || '',
                    last_name: data.last_name || ''
                });
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
            setStatus({ type: 'error', message: 'Failed to load profile data.' });
        } finally {
            setFetching(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            setStatus({ type: 'success', message: 'Profile updated successfully!' });
            setTimeout(() => setStatus({ type: '', message: '' }), 3000);
        } catch (err) {
            console.error('Error saving profile:', err);
            setStatus({ type: 'error', message: `Failed to save: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen w-full flex flex-col"
            style={{ backgroundColor: theme.sidebar.backgroundColor }}
        >
            {/* Page Header */}
            <div
                className="px-8 pt-10 pb-6 border-b"
                style={{ borderColor: theme.sidebar.borderColor }}
            >
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
                    <p style={{ color: '#6b7280' }} className="text-sm">
                        Manage your account settings and preferences.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-8 py-8">
                <div className="max-w-2xl mx-auto">
                    {/* Profile Card */}
                    <div
                        style={{ backgroundColor: '#2a2a2a', border: '1px solid #333' }}
                        className="rounded-xl overflow-hidden"
                    >
                        {/* Card Header */}
                        <div className="px-6 py-4 border-b" style={{ borderColor: '#333' }}>
                            <h2 className="text-base font-semibold text-white flex items-center gap-2">
                                <User size={16} style={{ color: '#6b7280' }} />
                                Profile Information
                            </h2>
                        </div>

                        {/* Card Body */}
                        <div className="p-6">
                            {/* Email (read-only) */}
                            <div className="mb-6 pb-5 border-b" style={{ borderColor: '#333' }}>
                                <label style={{ color: '#9ca3af' }} className="text-xs font-semibold uppercase tracking-wider mb-2 block">
                                    Email
                                </label>
                                <p style={{ color: '#d1d5db' }} className="text-sm">{user?.email ?? '—'}</p>
                            </div>

                            {fetching ? (
                                <div className="flex items-center justify-center py-10 gap-3">
                                    <Loader2 size={24} className="animate-spin" style={{ color: '#4b5563' }} />
                                    <span style={{ color: '#6b7280' }} className="text-sm">Loading profile...</span>
                                </div>
                            ) : (
                                <form onSubmit={handleSave} className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label style={{ color: '#9ca3af' }} className="text-xs font-semibold uppercase tracking-wider mb-2.5 block">
                                                First Name
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.first_name}
                                                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                                                placeholder="Enter first name"
                                                style={{
                                                    backgroundColor: '#1e1e1e',
                                                    border: '1px solid #3a3a3a',
                                                    color: '#e2e8f0',
                                                }}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-600 transition-colors placeholder:text-[#4b5563]"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ color: '#9ca3af' }} className="text-xs font-semibold uppercase tracking-wider mb-2.5 block">
                                                Last Name
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.last_name}
                                                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                                                placeholder="Enter last name"
                                                style={{
                                                    backgroundColor: '#1e1e1e',
                                                    border: '1px solid #3a3a3a',
                                                    color: '#e2e8f0',
                                                }}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-600 transition-colors placeholder:text-[#4b5563]"
                                            />
                                        </div>
                                    </div>

                                    {status.message && (
                                        <div
                                            style={{
                                                backgroundColor: status.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                border: `1px solid ${status.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                                color: status.type === 'success' ? '#10b981' : '#f87171',
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                                        >
                                            {status.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                            {status.message}
                                        </div>
                                    )}

                                    <div className="pt-2 flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            style={{ backgroundColor: '#034638', color: '#fff' }}
                                            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                                        >
                                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                            {loading ? 'Saving…' : 'Save Changes'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

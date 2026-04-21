import React from 'react';
import { Zap, Check, Lock, Sparkles, MessageSquare, Bot } from 'lucide-react';
import { theme } from '../../theme';

export default function UpgradePlan() {
    return (
        <div
            className="min-h-screen w-full flex flex-col"
            style={{ backgroundColor: theme.sidebar.backgroundColor }}
        >
            {/* Page Header */}
            <div
                className="px-8 pt-12 pb-8 border-b"
                style={{ borderColor: theme.sidebar.borderColor }}
            >
                <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <Zap size={14} />
                        <span className="text-xs font-bold uppercase tracking-wider">Free Plan</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-3">SimplySpend Pro Coming Soon</h1>
                    <p style={{ color: '#9ca3af' }} className="text-sm max-w-lg leading-relaxed">
                        You're currently enjoying full, free access to our platform. Our upcoming Pro plan will introduce powerful AI automation and chatbot capabilities.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-8 py-12 flex items-start justify-center">
                <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Current Plan Card */}
                    <div
                        style={{ backgroundColor: '#2a2a2a', border: '1px solid #10b981' }}
                        className="rounded-2xl overflow-hidden relative shadow-[0_0_30px_rgba(16,185,129,0.05)]"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                        <div className="p-8">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Basic</h2>
                                    <p style={{ color: '#9ca3af' }} className="text-sm mt-1">Everything you need to manage your money.</p>
                                </div>
                                <span style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }} className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                                    Current
                                </span>
                            </div>

                            <div className="mb-6">
                                <span className="text-4xl font-black text-white">Free</span>
                                <span style={{ color: '#6b7280' }} className="text-sm font-medium"></span>
                            </div>

                            <button
                                disabled
                                style={{ backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}
                                className="w-full py-2.5 rounded-xl text-sm font-bold cursor-default mb-8"
                            >
                                Current Plan
                            </button>

                            <div className="space-y-4">
                                <p style={{ color: '#e5e7eb' }} className="text-sm font-bold mb-4 tracking-wide uppercase">Includes:</p>
                                {[
                                    '1000 transaction uploads per month',
                                    'AI categorization',
                                    'Custom rules & automation',
                                    'Advanced analytics & charts',
                                ].map((feature) => (
                                    <div key={feature} className="flex items-start gap-3">
                                        <Check size={16} style={{ color: '#10b981' }} className="mt-0.5 shrink-0" />
                                        <span style={{ color: '#d1d5db' }} className="text-sm font-medium">{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Pro Plan Card */}
                    <div
                        style={{ backgroundColor: '#212121', border: '1px solid #3a3a3a' }}
                        className="rounded-2xl overflow-hidden relative transition-all duration-300 hover:border-[#4a4a4a]"
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold text-white">Finsight Pro</h2>
                                        <Sparkles size={16} style={{ color: '#6366f1' }} />
                                    </div>
                                    <p style={{ color: '#9ca3af' }} className="text-sm mt-1">Supercharge your finances with AI.</p>
                                </div>
                                <span style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }} className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                                    Coming Soon
                                </span>
                            </div>

                            <div className="mb-6 relative inline-block">
                                <span className="text-4xl font-black text-white blur-[6px] select-none opacity-80">$29</span>
                                <span style={{ color: '#6b7280' }} className="text-sm font-medium blur-[4px] select-none opacity-80">/mo</span>
                            </div>

                            <button
                                disabled
                                style={{ backgroundColor: '#2a2a2a', color: '#6b7280', border: '1px solid #3a3a3a' }}
                                className="w-full py-2.5 rounded-xl text-sm font-bold cursor-not-allowed mb-8 relative overflow-hidden group"
                            >
                                Coming Soon
                            </button>

                            <div className="space-y-4">
                                <p style={{ color: '#e5e7eb' }} className="text-sm font-bold mb-4 tracking-wide uppercase">Everything in Free, plus:</p>
                                {[
                                    { icon: Bot, text: 'Unlimited Transaction Uploads', color: '#a855f7' },
                                    { icon: MessageSquare, text: 'AI assistant', color: '#3b82f6' },
                                    { icon: Sparkles, text: 'Generative AI insights', color: '#f59e0b' },
                                    { icon: Lock, text: 'Priority feature access & support', color: '#10b981' }
                                ].map((feature, i) => {
                                    const Icon = feature.icon;
                                    return (
                                        <div key={i} className="flex items-start gap-3 opacity-90">
                                            <Icon size={16} style={{ color: feature.color }} className="mt-0.5 shrink-0" />
                                            <span style={{ color: '#d1d5db' }} className="text-sm font-medium">{feature.text}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

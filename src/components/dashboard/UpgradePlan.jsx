import React from 'react';
import { Zap, Check } from 'lucide-react';
import { theme } from '../../theme';

const PLAN_FEATURES = [
    'Unlimited transaction uploads',
    'AI-powered categorization',
    'Custom rules & automation',
    'Advanced analytics & charts',
    'Priority support',
];

export default function UpgradePlan() {
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
                    <h1 className="text-2xl font-bold text-white mb-1">Upgrade Plan</h1>
                    <p style={{ color: '#6b7280' }} className="text-sm">
                        Unlock premium features and take full control of your finances.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-8 py-8 flex items-start justify-center">
                <div className="max-w-md w-full">
                    {/* Current Plan Banner */}
                    <div
                        style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
                        className="rounded-xl px-4 py-3 flex items-center gap-3 mb-6"
                    >
                        <div
                            style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        >
                            <Zap size={15} style={{ color: '#10b981' }} />
                        </div>
                        <div>
                            <p style={{ color: '#10b981' }} className="text-sm font-semibold">Beta Access</p>
                            <p style={{ color: '#6b7280' }} className="text-xs">You currently have free beta access to all features.</p>
                        </div>
                    </div>

                    {/* Plan Card */}
                    <div
                        style={{ backgroundColor: '#2a2a2a', border: '1px solid #333' }}
                        className="rounded-xl overflow-hidden"
                    >
                        <div className="px-6 py-5 border-b" style={{ borderColor: '#333' }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-semibold text-white">Pro Plan</h2>
                                    <p style={{ color: '#6b7280' }} className="text-xs mt-0.5">Coming soon</p>
                                </div>
                                <div className="text-right">
                                    <span style={{ color: '#6b7280' }} className="text-xs line-through">$12/mo</span>
                                    <p className="text-xl font-bold text-white">Free</p>
                                    <span style={{ color: '#6b7280' }} className="text-[10px] uppercase tracking-wider">during beta</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-3">
                            {PLAN_FEATURES.map((feature) => (
                                <div key={feature} className="flex items-center gap-3">
                                    <div
                                        style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}
                                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                    >
                                        <Check size={11} style={{ color: '#10b981' }} />
                                    </div>
                                    <span style={{ color: '#d1d5db' }} className="text-sm">{feature}</span>
                                </div>
                            ))}
                        </div>

                        <div className="px-6 pb-6 pt-2">
                            <button
                                disabled
                                style={{ backgroundColor: '#333', color: '#6b7280' }}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed"
                            >
                                You're on the Beta Plan — No Upgrade Needed
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

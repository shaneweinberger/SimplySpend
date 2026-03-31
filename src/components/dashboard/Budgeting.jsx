import React from 'react';
import { Lock, Sparkles } from 'lucide-react';

export default function Budgeting() {
    return (
        <div className="relative w-full h-full min-h-[80vh] overflow-hidden rounded-2xl bg-white border border-slate-200">
            {/* The Blurred Mockup Background */}
            <div className="absolute inset-0 p-8 select-none filter blur-[8px] opacity-40 transition-all duration-700 pb-20 pointer-events-none">
                <header className="flex items-center justify-between mb-8">
                    <div>
                        <div className="h-8 w-48 bg-slate-200 rounded mb-2"></div>
                        <div className="h-4 w-64 bg-slate-100 rounded"></div>
                    </div>
                    <div className="h-10 w-32 bg-accent/20 rounded-lg"></div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-slate-50 border border-slate-100 rounded-xl p-5">
                            <div className="h-4 w-24 bg-slate-200 rounded mb-4"></div>
                            <div className="h-8 w-32 bg-slate-300 rounded mb-2"></div>
                            <div className="h-2 w-full bg-slate-100 rounded-full mt-4">
                                <div className="h-full w-2/3 bg-accent rounded-full"></div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-96 bg-slate-50 border border-slate-100 rounded-xl p-6">
                        <div className="h-5 w-48 bg-slate-200 rounded mb-8"></div>
                        <div className="flex items-end justify-between h-64 gap-2">
                            {[40, 70, 45, 90, 65, 30, 85].map((h, i) => (
                                <div key={i} className="w-full bg-accent/30 rounded-t-sm" style={{ height: `${h}%` }}></div>
                            ))}
                        </div>
                    </div>
                    <div className="h-96 bg-slate-50 border border-slate-100 rounded-xl p-6 flex flex-col gap-4">
                        <div className="h-5 w-32 bg-slate-200 rounded mb-4"></div>
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0"></div>
                                <div className="flex-1">
                                    <div className="h-3 w-full bg-slate-200 rounded mb-2"></div>
                                    <div className="h-2 w-2/3 bg-slate-100 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* The Overlay */}
            <div className="absolute inset-x-0 top-0 bottom-0 z-10 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-700">
                <div className="bg-white/80 backdrop-blur-xl p-10 rounded-3xl border border-white shadow-2xl shadow-slate-200/50 max-w-lg w-full relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-32 bg-accent/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 p-32 bg-green-500/5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent-dark rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-accent/30 transform transition-transform hover:scale-110 duration-300">
                            <Sparkles size={32} />
                        </div>

                        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">
                            Financial Budgeting Feature Coming Soon!
                        </h2>

                        <p className="text-slate-500 font-medium leading-relaxed mb-8">
                            We're building an AI-powered, intuitive budgeting system to help you set goals, track pacing across custom categories, and automatically project your monthly expenditures.
                        </p>

                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold max-w-fit">
                            <Lock size={16} />
                            Currently in Development
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

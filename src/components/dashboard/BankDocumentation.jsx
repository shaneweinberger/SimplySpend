import React, { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, Lock, ArrowRight } from 'lucide-react';
import { bankDocumentationConfig } from '../../bankDocumentationConfig';

export default function BankDocumentation({ onBack }) {
    const [activeBank, setActiveBank] = useState('TD Bank');
    const { availableBanks, banks } = bankDocumentationConfig;
    const currentBankData = banks[activeBank] || banks['TD Bank'];

    useEffect(() => {
        setTimeout(() => {
            document.getElementById('docs-top')?.scrollIntoView({
                behavior: 'instant',
                block: 'start'
            });
        }, 10);
    }, []);

    return (
        <div id="docs-top" className="w-full min-h-[80vh] bg-[#f4f2f0] rounded-3xl p-6 md:p-10 text-[#034638] animate-fade-in-up">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-[#034638]/60 hover:text-[#034638] font-semibold text-sm transition-colors mb-8 focus:outline-none"
            >
                <ArrowLeft size={16} /> Back to Setup
            </button>

            <div className="max-w-3xl mx-auto pb-10">
                <div className="mb-10 text-center">
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">How to Download Transactions</h1>
                    <p className="text-lg text-[#034638]/70">Step-by-step guides for exporting CSV files from major banks securely.</p>
                </div>

                {/* Bank Tabs */}
                <div className="flex flex-wrap gap-2 mb-8 justify-center">
                    {availableBanks.map((bank) => (
                        <button
                            key={bank}
                            onClick={() => setActiveBank(bank)}
                            className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all focus:outline-none ${activeBank === bank
                                    ? 'bg-[#034638] text-white shadow-md'
                                    : 'bg-[#034638]/5 text-[#034638]/60 hover:bg-[#034638]/10'
                                }`}
                        >
                            {bank}
                        </button>
                    ))}
                </div>

                {/* Content Container */}
                <div className="relative">
                    {activeBank !== 'TD Bank' && (
                        <div className="absolute inset-0 z-10 flex items-start justify-center pt-24">
                            <div className="bg-white/80 backdrop-blur-md text-[#034638] border border-[#034638]/10 px-8 py-4 rounded-full font-bold text-lg shadow-xl flex items-center gap-3">
                                <Lock size={20} className="text-[#034638]/70" /> {activeBank} Guide Coming Soon
                            </div>
                        </div>
                    )}

                    <section className={`transition-all duration-500 ${activeBank !== 'TD Bank' ? 'blur-md opacity-40 select-none pointer-events-none' : ''}`}>
                        <div className="flex items-center justify-between mb-8 border-b border-[#034638]/10 pb-6">
                            <h2 className="text-2xl font-bold">{currentBankData.name}</h2>
                            {currentBankData.link && (
                                <a href={currentBankData.link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full hover:bg-emerald-100 transition-colors">
                                    {currentBankData.linkText} <ExternalLink size={14} />
                                </a>
                            )}
                        </div>

                        <div className="space-y-12">
                            {currentBankData.steps.map((step, index) => (
                                <div key={index} className="flex gap-4 md:gap-6">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#034638] text-white flex items-center justify-center font-bold shrink-0">
                                        {step.number}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                                        <p className="text-[#034638]/70 mb-4 leading-relaxed">{step.description}</p>
                                        
                                        {step.imagePath ? (
                                            <div className="w-full rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white ring-1 ring-black/5 mt-6">
                                                <img src={step.imagePath} alt={step.title} className="w-full h-auto object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-full aspect-[2/1] md:aspect-[21/9] bg-[#f4f2f0]/50 rounded-2xl ring-1 ring-black/5 flex items-center justify-center text-[#034638]/40 overflow-hidden shadow-sm mt-6">
                                                [ {step.imagePlaceholder} ]
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Bottom Navigation */}
                <div className="mt-16 pt-8 border-t border-[#034638]/10 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in-up">
                    <p className="text-[#034638]/60 font-medium text-lg text-center sm:text-left">Have your CSV file ready?</p>
                    <button
                        onClick={onBack}
                        className="bg-[#034638] text-white px-8 py-3.5 rounded-full font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all focus:outline-none flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                        Return to Setup <ArrowRight size={18} />
                    </button>
                </div>

            </div>
        </div>
    );
}

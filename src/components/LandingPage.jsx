import React, { useState, useEffect } from "react";
import { Check, Menu, X, Brain, Shield, Zap, LayoutDashboard } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { landingPageConfig } from "../landingPageConfig";

export default function LandingPage() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navigate = useNavigate();

    // Attach onScroll to the outer div instead of window since we are using h-screen overflow-y-auto
    const handleScroll = (e) => {
        setIsScrolled(e.target.scrollTop > 20);
    };

    // Use dynamic style block to map CSS variables to the document
    const customStyles = {
        '--lp-bg': landingPageConfig.colors.background,
        '--lp-text': landingPageConfig.colors.text,
        '--lp-primary': landingPageConfig.colors.primary,
        '--lp-primary-text': landingPageConfig.colors.primaryText,
        '--lp-accent-light': landingPageConfig.colors.accentLight,
        '--lp-accent-border': landingPageConfig.colors.accentBorder,
    };

    return (
        <div
            onScroll={handleScroll}
            style={customStyles}
            className="h-screen overflow-y-auto snap-y snap-mandatory bg-[var(--lp-bg)] text-[var(--lp-text)] font-sans selection:bg-[var(--lp-accent-border)] selection:text-[var(--lp-primary)] overflow-x-hidden scroll-smooth"
        >

            {/* Navbar */}
            <nav
                className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-[95%] max-w-5xl transition-all duration-500 ${isScrolled
                    ? "bg-[var(--lp-bg)]/90 backdrop-blur-md shadow-lg border border-[var(--lp-accent-border)] py-3 rounded-full"
                    : "bg-transparent py-4"
                    }`}
            >
                <div className="px-6 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-[var(--lp-primary)]">
                        <div className="w-8 h-8 rounded-lg bg-[var(--lp-primary)] text-[var(--lp-primary-text)] flex items-center justify-center">
                            <span className="text-lg">F</span>
                        </div>
                        FinSight
                    </div>

                    {/* Desktop Links */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--lp-primary)]/70">
                        <a href="#features" className="hover:text-[var(--lp-primary)] transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-[var(--lp-primary)] transition-colors">How it Works</a>
                        <a href="#security" className="hover:text-[var(--lp-primary)] transition-colors">Security</a>
                    </div>

                    {/* Right Area */}
                    <div className="hidden md:flex items-center gap-4">
                        <button
                            onClick={() => navigate('/auth')}
                            className="text-sm font-medium text-[var(--lp-primary)]/70 hover:text-[var(--lp-primary)] transition-colors"
                        >
                            Log In
                        </button>
                        <button
                            onClick={() => navigate('/auth?signup=true')}
                            className="bg-[var(--lp-primary)] hover:bg-[var(--lp-primary)]/90 text-[var(--lp-primary-text)] text-sm font-medium px-5 py-2.5 rounded-full transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5"
                        >
                            Get Started
                        </button>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 text-[var(--lp-primary)]"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="absolute top-full left-0 w-full bg-[var(--lp-bg)] rounded-2xl shadow-xl mt-2 p-4 flex flex-col gap-4 border border-[var(--lp-accent-border)] md:hidden">
                        <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-[var(--lp-primary)]/70 hover:text-[var(--lp-primary)] font-medium p-2">Features</a>
                        <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="text-[var(--lp-primary)]/70 hover:text-[var(--lp-primary)] font-medium p-2">How it Works</a>
                        <a href="#security" onClick={() => setIsMobileMenuOpen(false)} className="text-[var(--lp-primary)]/70 hover:text-[var(--lp-primary)] font-medium p-2">Security</a>
                        <hr className="border-[var(--lp-accent-border)]" />
                        <button onClick={() => navigate('/auth')} className="w-full text-center py-2 font-medium text-[var(--lp-primary)]/70">Log In</button>
                        <button onClick={() => navigate('/auth?signup=true')} className="w-full bg-[var(--lp-primary)] hover:bg-[var(--lp-primary)]/90 text-[var(--lp-primary-text)] py-3 rounded-xl font-medium">Get Started</button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 w-full snap-start min-h-screen flex flex-col justify-center px-6 pt-24 md:pt-0">
                <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
                    {/* Left Content */}
                    <div className="space-y-8 animate-fade-in-up delay-100 z-10 relative whitespace-pre-line">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[var(--lp-primary)] leading-[1.1]">
                            {landingPageConfig.hero.title}
                        </h1>
                        <p className="text-lg md:text-xl text-[var(--lp-primary)]/80 max-w-xl leading-relaxed">
                            {landingPageConfig.hero.subtitle}
                        </p>
                        <div className="pt-4 animate-fade-in-up delay-200">
                            <button
                                onClick={() => navigate('/auth?signup=true')}
                                className="w-full sm:w-max bg-[var(--lp-primary)] hover:bg-[var(--lp-primary)]/90 text-[var(--lp-primary-text)] text-lg font-medium px-10 py-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-2xl hover:-translate-y-1"
                            >
                                Start Tracking
                            </button>
                        </div>
                    </div>

                    {/* Right Content - Images */}
                    <div className="relative animate-fade-in-up delay-300 hidden md:block w-full h-[600px] my-10">
                        {/* Base Image */}
                        <div className={`absolute rounded-2xl shadow-2xl border border-[var(--lp-accent-border)] overflow-hidden transition-transform duration-700 hover:translate-x-0 ${landingPageConfig.hero.baseImageStyles}`}>
                            <img src="/dashboard-preview.png" alt="Dashboard Preview" className="w-full h-auto object-cover" />
                        </div>
                        {/* Overlapping Image */}
                        <div className={`absolute rounded-2xl shadow-2xl border border-[var(--lp-accent-border)] overflow-hidden transition-transform duration-700 z-10 hover:translate-x-0 ${landingPageConfig.hero.overlapImageStyles}`}>
                            <img src="/analysis-page-sc.png" alt="Analysis Page Preview" className="w-full h-auto object-cover" />
                        </div>
                    </div>
                </div>
            </section>

            {/* How it Works Section */}
            <section id="how-it-works" className="relative z-10 min-h-screen w-full snap-start flex flex-col justify-center px-4 py-20 bg-[var(--lp-bg)]">
                <div className="max-w-6xl mx-auto w-full">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold text-[var(--lp-primary)] mb-6">
                            From Raw Data to Real Intelligence
                        </h2>
                        <p className="text-[var(--lp-primary)]/70 text-lg md:text-xl max-w-2xl mx-auto">
                            Our 4-step local pipeline transforms messy CSVs into a pristine financial system.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-4 gap-8 relative">
                        {/* Connector Line (Desktop) */}
                        <div className="hidden md:block absolute top-[20%] left-[10%] right-[10%] h-[1px] bg-[var(--lp-primary)]/20 z-0" />

                        {[
                            {
                                step: "01",
                                title: "Ingest",
                                subtitle: "The Raw Layer",
                                desc: "Upload Credit & Debit CSVs. The system extracts dates and amounts into a 'Silver' dataset."
                            },
                            {
                                step: "02",
                                title: "Refine",
                                subtitle: "The Intelligence Layer",
                                desc: "Create simple rules (e.g. 'Amazon' = 'Shopping'). Override specific transactions manually."
                            },
                            {
                                step: "03",
                                title: "Process",
                                subtitle: "The Action Layer",
                                desc: "One-click 'Reprocess' runs the pipeline, applying all rules to historical data instantly."
                            },
                            {
                                step: "04",
                                title: "Analyze",
                                subtitle: "The Value Layer",
                                desc: "Dashboards and AI Chatbot update instantly with your clean, categorized 'Gold' dataset."
                            }
                        ].map((item, i) => (
                            <div key={i} className="relative z-10 bg-[var(--lp-bg)] p-8 rounded-3xl shadow-lg border border-[var(--lp-accent-light)] hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
                                <div className="text-center">
                                    <span className="text-3xl font-light text-[var(--lp-primary)]/30 group-hover:text-[var(--lp-primary)]/60 transition-colors block mb-4">{item.step}</span>
                                    <h3 className="font-bold text-xl text-[var(--lp-primary)] mb-1">{item.title}</h3>
                                    <span className="text-xs font-semibold text-[var(--lp-primary)]/60 uppercase tracking-widest block mb-4">{item.subtitle}</span>
                                    <p className="text-sm text-[var(--lp-primary)]/80 leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="relative z-10 min-h-screen w-full snap-start flex flex-col justify-center px-4 py-20 bg-[var(--lp-primary)] text-[var(--lp-primary-text)]">
                <div className="max-w-6xl mx-auto w-full">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--lp-primary-text)] to-[var(--lp-primary-text)]/80 mb-6">
                            Everything You Need in a Finance Tracker
                        </h2>
                        <p className="text-[var(--lp-primary-text)]/80 text-lg md:text-xl">Built for power users who want control, speed, and privacy.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* AI Core */}
                        <div className="col-span-1 lg:col-span-2 group p-10 rounded-3xl bg-[var(--lp-primary-text)]/5 border border-[var(--lp-primary-text)]/10 shadow-xl overflow-hidden relative hover:bg-[var(--lp-primary-text)]/10 transition-colors">
                            <div className="relative z-10">
                                <h3 className="text-3xl font-bold mb-4">AI-Powered Insights</h3>
                                <p className="text-[var(--lp-primary-text)]/80 leading-relaxed max-w-lg mb-8 text-lg">
                                    Get instant answers to complex questions like "How much did I spend on Uber in March?" without manually sorting data. Our Agentic system scopes the data and verifies the math.
                                </p>
                                <div className="flex gap-3">
                                    <span className="px-4 py-2 rounded-full bg-[var(--lp-primary-text)]/10 text-sm font-medium border border-[var(--lp-primary-text)]/20 backdrop-blur-md">Natural Language</span>
                                    <span className="px-4 py-2 rounded-full bg-[var(--lp-primary-text)]/10 text-sm font-medium border border-[var(--lp-primary-text)]/20 backdrop-blur-md">Math Verification</span>
                                </div>
                            </div>
                        </div>

                        {/* Smart Transactions */}
                        <div className="group p-8 rounded-3xl bg-[var(--lp-primary-text)]/5 border border-[var(--lp-primary-text)]/10 hover:bg-[var(--lp-primary-text)]/10 transition-all duration-300">
                            <h3 className="text-xl font-bold mb-3">Unified Dashboard</h3>
                            <p className="text-[var(--lp-primary-text)]/70 leading-relaxed">
                                Upload Credit and Debit CSVs separately but view them in a single, unified list. Filter, search, and edit thousands of transactions.
                            </p>
                        </div>

                        {/* Automation */}
                        <div className="group p-8 rounded-3xl bg-[var(--lp-primary-text)]/5 border border-[var(--lp-primary-text)]/10 hover:bg-[var(--lp-primary-text)]/10 transition-all duration-300">
                            <h3 className="text-xl font-bold mb-3">Rule Automation</h3>
                            <p className="text-[var(--lp-primary-text)]/70 leading-relaxed">
                                Create "If This, Then That" rules. One-click "Reprocess" applies new rules to all historical data instantly.
                            </p>
                        </div>

                        {/* Privacy */}
                        <div className="group p-8 rounded-3xl bg-[var(--lp-primary-text)]/5 border border-[var(--lp-primary-text)]/10 hover:bg-[var(--lp-primary-text)]/10 transition-all duration-300">
                            <h3 className="text-xl font-bold mb-3">Local First Security</h3>
                            <p className="text-[var(--lp-primary-text)]/70 leading-relaxed">
                                Your financial data stays local. We process CSVs on your machine, not in a third-party cloud database.
                            </p>
                        </div>

                        {/* Analytics */}
                        <div className="group p-8 rounded-3xl bg-[var(--lp-primary-text)]/5 border border-[var(--lp-primary-text)]/10 hover:bg-[var(--lp-primary-text)]/10 transition-all duration-300">
                            <h3 className="text-xl font-bold mb-3">Monthly Analytics</h3>
                            <p className="text-[var(--lp-primary-text)]/70 leading-relaxed">
                                Interactive charts to spot trends, spending anomalies, and month-over-month comparisons.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 bg-[var(--lp-primary)] text-[var(--lp-primary-text)] py-20 px-4 border-t border-[var(--lp-primary-text)]/10 snap-start flex flex-col justify-center w-full">
                <div className="max-w-6xl mx-auto w-full grid md:grid-cols-4 gap-12">
                    <div className="col-span-2">
                        <div className="flex items-center gap-2 font-bold text-2xl mb-6">
                            <div className="w-10 h-10 rounded-xl bg-[var(--lp-primary-text)] text-[var(--lp-primary)] flex items-center justify-center">F</div>
                            Finsight
                        </div>
                        <p className="max-w-sm text-[var(--lp-primary-text)]/70 leading-relaxed text-lg">The intelligent, privacy-focused personal finance tracker for the modern era.</p>
                    </div>
                    <div>
                        <h4 className="font-bold mb-6 text-lg">Product</h4>
                        <ul className="space-y-4 text-[var(--lp-primary-text)]/70">
                            <li><a href="#features" className="hover:text-[var(--lp-primary-text)] transition-colors">Features</a></li>
                            <li><a href="#security" className="hover:text-[var(--lp-primary-text)] transition-colors">Security</a></li>
                            <li><a href="#" className="hover:text-[var(--lp-primary-text)] transition-colors">Changelog</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold mb-6 text-lg">Company</h4>
                        <ul className="space-y-4 text-[var(--lp-primary-text)]/70">
                            <li><a href="#" className="hover:text-[var(--lp-primary-text)] transition-colors">About</a></li>
                            <li><a href="#" className="hover:text-[var(--lp-primary-text)] transition-colors">Contact</a></li>
                            <li><a href="#" className="hover:text-[var(--lp-primary-text)] transition-colors">Twitter</a></li>
                        </ul>
                    </div>
                </div>
            </footer>

            <style>{`
        .animate-fade-in-up {
          animation: fadeInUp 1s ease-out forwards;
          opacity: 0;
          transform: translateY(30px);
        }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        
        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
        </div>
    );
}

import React, { useState, useEffect } from "react";
import { Check, Menu, X, Brain, Shield, Zap, LayoutDashboard, CloudUpload, ShieldCheck, LineChart, Lock } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { landingPageConfig } from "../landingPageConfig";

export default function LandingPage() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isOverDarkSection, setIsOverDarkSection] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navigate = useNavigate();

    // Attach onScroll to the outer div instead of window since we are using h-screen overflow-y-auto
    const handleScroll = (e) => {
        setIsScrolled(e.target.scrollTop > 20);

        let overDark = false;

        // Use document lookup and bounding rect to calculate if these dark sections are directly beneath the ~80px tall sticky nav
        const howItWorks = document.getElementById('how-it-works');
        if (howItWorks) {
            const rect = howItWorks.getBoundingClientRect();
            if (rect.top <= 100 && rect.bottom >= 100) {
                overDark = true;
            }
        }

        // The footer is now light-bg, so we don't trigger overDark for it. 

        setIsOverDarkSection(overDark);
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
                    ? isOverDarkSection
                        ? "bg-[var(--lp-primary)]/80 backdrop-blur-md shadow-lg border border-[var(--lp-primary-text)]/20 py-3 rounded-full"
                        : "bg-[var(--lp-bg)]/90 backdrop-blur-md shadow-lg border border-[var(--lp-accent-border)] py-3 rounded-full"
                    : "bg-transparent py-4"
                    }`}
            >
                <div className="px-6 flex items-center justify-between">
                    {/* Logo */}
                    <div className={`flex items-center gap-2 font-bold text-xl tracking-tight transition-colors duration-500 ${isOverDarkSection ? 'text-[var(--lp-primary-text)]' : 'text-[var(--lp-primary)]'}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-500 ${isOverDarkSection ? 'bg-[var(--lp-primary-text)] text-[var(--lp-primary)]' : 'bg-[var(--lp-primary)] text-[var(--lp-primary-text)]'}`}>
                            <span className="text-lg">F</span>
                        </div>
                        FinSight
                    </div>

                    {/* Desktop Links */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium">
                        <a href="#features" className={`transition-opacity duration-300 ${isOverDarkSection ? 'text-[var(--lp-primary-text)] opacity-80 hover:opacity-100 hover:text-white' : 'text-[var(--lp-primary)] opacity-70 hover:opacity-100'}`}>Features</a>
                        <a href="#how-it-works" className={`transition-opacity duration-300 ${isOverDarkSection ? 'text-[var(--lp-primary-text)] opacity-80 hover:opacity-100 hover:text-white' : 'text-[var(--lp-primary)] opacity-70 hover:opacity-100'}`}>How it Works</a>
                    </div>

                    {/* Right Area */}
                    <div className="hidden md:flex items-center gap-4">
                        <button
                            onClick={() => navigate('/auth')}
                            className={`text-sm font-medium transition-opacity duration-500 ${isOverDarkSection ? 'text-[var(--lp-primary-text)] opacity-90 hover:opacity-100 hover:text-white' : 'text-[var(--lp-primary)] opacity-70 hover:opacity-100'}`}
                        >
                            Log In
                        </button>
                        <button
                            onClick={() => navigate('/auth?signup=true')}
                            className={`text-sm font-medium px-5 py-2.5 rounded-full transition-all duration-300 shadow-md transform hover:-translate-y-0.5 hover:shadow-xl ${isOverDarkSection
                                ? 'bg-[var(--lp-primary-text)] text-[var(--lp-primary)] hover:bg-white'
                                : 'bg-[var(--lp-primary)] text-[var(--lp-primary-text)] opacity-90 hover:opacity-100'
                                }`}
                        >
                            Get Started
                        </button>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className={`md:hidden p-2 transition-colors duration-500 ${isOverDarkSection ? 'text-[var(--lp-primary-text)]' : 'text-[var(--lp-primary)]'}`}
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className={`absolute top-full left-0 w-full rounded-2xl shadow-xl mt-2 p-4 flex flex-col gap-4 border md:hidden transition-colors duration-500 ${isOverDarkSection
                        ? 'bg-[var(--lp-primary)] border-[var(--lp-primary-text)] opacity-90'
                        : 'bg-[var(--lp-bg)] border-[var(--lp-accent-border)]'
                        }`}>
                        <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className={`font-medium p-2 transition-opacity duration-300 ${isOverDarkSection ? 'text-[var(--lp-primary-text)] opacity-80 hover:opacity-100 hover:text-white' : 'text-[var(--lp-primary)] opacity-70 hover:opacity-100'}`}>Features</a>
                        <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className={`font-medium p-2 transition-opacity duration-300 ${isOverDarkSection ? 'text-[var(--lp-primary-text)] opacity-80 hover:opacity-100 hover:text-white' : 'text-[var(--lp-primary)] opacity-70 hover:opacity-100'}`}>How it Works</a>
                        <hr className={`transition-opacity duration-500 ${isOverDarkSection ? 'border-[var(--lp-primary-text)] opacity-20' : 'border-[var(--lp-accent-border)]'}`} />
                        <button onClick={() => navigate('/auth')} className={`w-full text-center py-2 font-medium transition-opacity duration-500 ${isOverDarkSection ? 'text-[var(--lp-primary-text)] opacity-90 hover:opacity-100 hover:text-white' : 'text-[var(--lp-primary)] opacity-70 hover:opacity-100'}`}>Log In</button>
                        <button onClick={() => navigate('/auth?signup=true')} className={`w-full py-3 rounded-xl font-medium transition-colors duration-500 ${isOverDarkSection ? 'bg-[var(--lp-primary-text)] text-[var(--lp-primary)] hover:bg-white' : 'bg-[var(--lp-primary)] text-[var(--lp-primary-text)] hover:opacity-90'}`}>Get Started</button>
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

            {/* Features Grid */}
            <section id="features" className="relative z-10 min-h-screen w-full snap-start flex flex-col justify-start px-6 md:px-12 pt-36 pb-20 bg-[var(--lp-bg)]">
                <div className="max-w-6xl mx-auto w-full">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold text-[var(--lp-primary)] mb-6">
                            {landingPageConfig.featuresSection.title}
                        </h2>
                        <p className="text-[var(--lp-primary)]/70 text-lg md:text-xl max-w-2xl mx-auto">
                            {landingPageConfig.featuresSection.subtitle}
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                        {landingPageConfig.features.map((feature, i) => (
                            <div key={i} className="group p-5 rounded-3xl bg-[var(--lp-bg)] border border-[var(--lp-accent-border)] hover:bg-[var(--lp-primary)]/5 hover:border-[var(--lp-primary)]/20 hover:-translate-y-2 transition-all duration-300 shadow-md hover:shadow-xl flex flex-col">
                                {/* Feature Screenshot */}
                                <div className="w-full h-32 lg:h-40 bg-[var(--lp-primary)]/5 rounded-xl mb-5 flex items-center justify-center border border-[var(--lp-accent-border)] overflow-hidden relative">
                                    {feature.image ? (
                                        <img
                                            src={feature.image}
                                            alt={feature.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                        />
                                    ) : (
                                        <div className="text-[var(--lp-primary)]/40 font-mono text-[10px] sm:text-xs tracking-widest uppercase flex flex-col items-center gap-2 group-hover:scale-110 transition-transform duration-700">
                                            <LayoutDashboard size={24} className="opacity-50" />
                                            Screenshot
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 flex flex-col items-center text-center">
                                    <h3 className="text-lg md:text-xl font-bold text-[var(--lp-primary)] mb-2 leading-tight">{feature.title}</h3>
                                    <p className="text-[var(--lp-primary)]/70 leading-relaxed text-xs sm:text-sm whitespace-pre-line">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it Works Section */}
            <section id="how-it-works" className={`relative z-10 w-full h-screen snap-start flex flex-col justify-start ${landingPageConfig.howItWorks.sectionPadding} px-6 bg-[var(--lp-primary)] text-[var(--lp-primary-text)] overflow-hidden`}>
                <div className="max-w-6xl mx-auto w-full relative">
                    <div className="text-center mb-24">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            {landingPageConfig.howItWorks.title}
                        </h2>
                        <p className="text-[var(--lp-primary-text)]/80 text-lg md:text-xl">
                            {landingPageConfig.howItWorks.subtitle}
                        </p>
                    </div>

                    {/* Desktop Horizontal Timeline */}
                    <div className={`hidden md:block relative max-w-5xl mx-auto h-[360px] ${landingPageConfig.howItWorks.timelineOffset}`}>
                        {/* Central Horizontal Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white opacity-10 -translate-y-1/2 z-0" />

                        {/* Progress Line */}
                        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gradient-to-r from-white/0 via-white/40 to-white/0 -translate-y-1/2 z-0" />

                        <div className="grid grid-cols-4 h-full relative z-10">
                            {/* Step 1 (Above) */}
                            <div className="relative flex flex-col items-center justify-center">
                                {/* The node sits exactly on the line in the center */}
                                <div className="w-10 h-10 rounded-full bg-[var(--lp-primary)] border-2 border-white/20 text-white text-sm font-bold flex items-center justify-center z-20 shadow-[0_0_15px_rgba(255,255,255,0.05)]">{landingPageConfig.howItWorks.steps[0].number}</div>

                                <div className="absolute bottom-[calc(50%+20px)] flex flex-col items-center w-full">
                                    <div className="mb-6 text-center px-4">
                                        <h3 className="text-lg font-semibold mb-1 whitespace-nowrap">{landingPageConfig.howItWorks.steps[0].title}</h3>
                                        <p className="text-sm text-white opacity-40 max-w-[180px] mx-auto mb-3">
                                            {landingPageConfig.howItWorks.steps[0].description}
                                        </p>
                                        <CloudUpload className="w-6 h-6 text-white opacity-60 mx-auto" />
                                    </div>
                                    <div className="w-[1px] h-[50px] bg-white opacity-20" />
                                </div>
                            </div>

                            {/* Step 2 (Below) */}
                            <div className="relative flex flex-col items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-[var(--lp-primary)] border-2 border-white/20 text-white text-sm font-bold flex items-center justify-center z-20 shadow-[0_0_15px_rgba(255,255,255,0.05)]">{landingPageConfig.howItWorks.steps[1].number}</div>

                                <div className="absolute top-[calc(50%+20px)] flex flex-col items-center w-full">
                                    <div className="w-[1px] h-[50px] bg-white opacity-20" />
                                    <div className="mt-6 text-center px-4">
                                        <Brain className="w-6 h-6 text-white opacity-60 mx-auto mb-3" />
                                        <h3 className="text-lg font-semibold mb-1 whitespace-nowrap">{landingPageConfig.howItWorks.steps[1].title}</h3>
                                        <p className="text-sm text-white opacity-40 max-w-[180px] mx-auto">
                                            {landingPageConfig.howItWorks.steps[1].description}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Step 3 (Above) */}
                            <div className="relative flex flex-col items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-[var(--lp-primary)] border-2 border-white/20 text-white text-sm font-bold flex items-center justify-center z-20 shadow-[0_0_15px_rgba(255,255,255,0.05)]">{landingPageConfig.howItWorks.steps[2].number}</div>

                                <div className="absolute bottom-[calc(50%+20px)] flex flex-col items-center w-full">
                                    <div className="mb-6 text-center px-4">
                                        <h3 className="text-lg font-semibold mb-1 whitespace-nowrap">{landingPageConfig.howItWorks.steps[2].title}</h3>
                                        <p className="text-sm text-white opacity-40 max-w-[180px] mx-auto mb-3">
                                            {landingPageConfig.howItWorks.steps[2].description}
                                        </p>
                                        <ShieldCheck className="w-6 h-6 text-white opacity-60 mx-auto" />
                                    </div>
                                    <div className="w-[1px] h-[50px] bg-white opacity-20" />
                                </div>
                            </div>

                            {/* Step 4 (Below) */}
                            <div className="relative flex flex-col items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-[var(--lp-primary)] border-2 border-white/20 text-white text-sm font-bold flex items-center justify-center z-20 shadow-[0_0_15px_rgba(255,255,255,0.05)]">{landingPageConfig.howItWorks.steps[3].number}</div>

                                <div className="absolute top-[calc(50%+20px)] flex flex-col items-center w-full">
                                    <div className="w-[1px] h-[50px] bg-white opacity-20" />
                                    <div className="mt-6 text-center px-4">
                                        <LineChart className="w-6 h-6 text-white opacity-60 mx-auto mb-3" />
                                        <h3 className="text-lg font-semibold mb-1 whitespace-nowrap">{landingPageConfig.howItWorks.steps[3].title}</h3>
                                        <p className="text-sm text-white opacity-40 max-w-[180px] mx-auto">
                                            {landingPageConfig.howItWorks.steps[3].description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Vertical Timeline (fallback) */}
                    <div className="md:hidden relative mx-auto space-y-12 py-8 pl-4">
                        <div className="absolute top-4 bottom-4 left-10 w-[2px] bg-[var(--lp-primary-text)] opacity-10 z-0" />

                        {landingPageConfig.howItWorks.steps.map((step, index) => {
                            const Icon = [CloudUpload, Brain, ShieldCheck, LineChart][index];
                            return (
                                <div key={index} className="relative z-10 flex flex-col group pl-20">
                                    <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-[var(--lp-primary)] border-[2px] border-white/20 text-[var(--lp-primary-text)] font-bold flex items-center justify-center text-sm z-10 ml-5 -translate-x-1/2">
                                        {step.number}
                                    </div>
                                    <h3 className="text-[18px] font-semibold mb-1.5 flex items-center gap-3 whitespace-nowrap">
                                        {Icon && <Icon className="w-5 h-5 text-[var(--lp-primary-text)] opacity-80" />}
                                        {step.title}
                                    </h3>
                                    <p className="text-[14px] text-[var(--lp-primary-text)] opacity-60 leading-snug">
                                        {step.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-16 md:mt-40 text-center pb-8 opacity-0 animate-[fade-in-up_0.5s_ease-out_forwards]" style={{ animationDelay: '1400ms' }}>
                        <p className="inline-flex items-center justify-center gap-2 text-[13px] font-medium text-[var(--lp-primary-text)]/70 bg-[var(--lp-primary-text)]/5 px-6 py-2.5 rounded-full border border-[var(--lp-primary-text)]/10 backdrop-blur-sm shadow-[0_0_15px_rgba(255,255,255,0.02)] transition-opacity hover:opacity-100 cursor-default">
                            <Lock className="w-3.5 h-3.5 opacity-80" />
                            Bank-grade security. Your data is encrypted and never shared.
                        </p>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative z-10 w-full py-24 bg-[var(--lp-bg)] snap-start flex flex-col items-center justify-center px-6 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-[var(--lp-primary)] mb-8">
                    Ready to take control of your finances?
                </h2>
                <button
                    onClick={() => navigate('/auth?signup=true')}
                    className="bg-[var(--lp-primary)] hover:bg-[var(--lp-primary)]/90 text-[var(--lp-primary-text)] text-lg font-medium px-10 py-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-2xl hover:-translate-y-1"
                >
                    Get Started
                </button>
            </section>

            {/* Footer */}
            <footer className={`relative z-10 bg-[var(--lp-bg)] text-[var(--lp-primary)] ${landingPageConfig.footer.padding} px-4 border-t border-[var(--lp-primary)]/10 snap-start flex flex-col justify-center w-full`}>
                <div className="max-w-6xl mx-auto w-full grid md:grid-cols-4 gap-12">
                    <div className="col-span-2">
                        <div className="flex items-center gap-2 font-bold text-2xl mb-6 text-[var(--lp-primary)]">
                            <div className="w-10 h-10 rounded-xl bg-[var(--lp-primary)] text-[var(--lp-primary-text)] flex items-center justify-center">F</div>
                            Finsight
                        </div>
                        <p className="max-w-sm text-[var(--lp-primary)]/70 leading-relaxed text-lg">The intelligent, privacy-focused personal finance tracker for the modern era.</p>
                    </div>
                    <div>
                        <h4 className="font-bold mb-6 text-[var(--lp-primary)] text-lg">Product</h4>
                        <ul className="space-y-4 text-[var(--lp-primary)]/70">
                            <li><a href="#features" className="hover:text-[var(--lp-primary)] transition-colors">Features</a></li>
                            <li><a href="#" className="hover:text-[var(--lp-primary)] transition-colors">Changelog</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold mb-6 text-[var(--lp-primary)] text-lg">Company</h4>
                        <ul className="space-y-4 text-[var(--lp-primary)]/70">
                            <li><a href="#" className="hover:text-[var(--lp-primary)] transition-colors">About</a></li>
                            <li><a href="#" className="hover:text-[var(--lp-primary)] transition-colors">Contact</a></li>
                            <li><a href="#" className="hover:text-[var(--lp-primary)] transition-colors">Twitter</a></li>
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
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes grow-line {
          from { transform: scaleX(0); opacity: 0; }
          to { transform: scaleX(1); opacity: 1; }
        }
        
        @keyframes grow-y {
          from { transform: scaleY(0); opacity: 0; }
          to { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
        </div>
    );
}

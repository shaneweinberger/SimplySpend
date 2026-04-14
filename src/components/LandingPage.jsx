import React, { useState, useEffect } from "react";
import { Check, Menu, X, Brain, Shield, Zap, LayoutDashboard, CloudUpload, ShieldCheck, LineChart, Lock, EyeOff, FileSpreadsheet, Database, AlignLeft } from "lucide-react";
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

        // Note: As of the recent design update, all sections (including Security and Footer) 
        // are light-themed, so we never trigger the overDark navbar inversion.


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
                        <a href="#security" className={`transition-opacity duration-300 ${isOverDarkSection ? 'text-[var(--lp-primary-text)] opacity-80 hover:opacity-100 hover:text-white' : 'text-[var(--lp-primary)] opacity-70 hover:opacity-100'}`}>Security</a>
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
                        <a href="#security" onClick={() => setIsMobileMenuOpen(false)} className={`font-medium p-2 transition-opacity duration-300 ${isOverDarkSection ? 'text-[var(--lp-primary-text)] opacity-80 hover:opacity-100 hover:text-white' : 'text-[var(--lp-primary)] opacity-70 hover:opacity-100'}`}>Security</a>
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
                    <div className="space-y-8 animate-fade-in-up delay-100 z-10 relative whitespace-pre-line mt-12 md:mt-24">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[var(--lp-primary)] leading-[1.1]">
                            {landingPageConfig.hero.title}
                        </h1>
                        <div className="space-y-4">
                            <p className="text-lg md:text-xl text-[var(--lp-primary)]/80 max-w-xl leading-relaxed">
                                {landingPageConfig.hero.subtitle}
                            </p>
                            <p className="text-base text-[var(--lp-primary)]/70 max-w-xl leading-relaxed font-medium">
                                <span className="font-bold">Privacy by Design:</span> No bank logins or third-party integrations. You maintain total data sovereignty via secure CSV uploads—encrypted, private, and always under your control.
                            </p>
                        </div>
                        <div className="pt-2 animate-fade-in-up delay-200">
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

            {/* Security Section */}
            <section id="security" className={`relative z-10 w-full min-h-screen snap-start flex flex-col justify-center py-12 px-6 bg-white text-[var(--lp-primary)] overflow-hidden`}>
                <div className="max-w-5xl mx-auto w-full relative z-10 mt-16 md:mt-20">
                    <div className="mb-10">
                        <h2 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 tracking-tight">
                            {landingPageConfig.securitySection.title}
                        </h2>
                        {landingPageConfig.securitySection.subtitle && (
                            <p className="text-gray-600 text-lg md:text-xl">
                                {landingPageConfig.securitySection.subtitle}
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-6">
                        {landingPageConfig.securitySection.features.map((feature, idx) => {
                            const Icon = [ShieldCheck, FileSpreadsheet, Database, AlignLeft][idx];
                            return (
                                <div key={idx} className="flex flex-col p-5 md:p-6 rounded-[2rem] bg-gray-50 hover:bg-gray-100 transition-colors duration-300 group border border-transparent hover:border-gray-200 cursor-default">
                                    <div className="w-12 h-12 mb-4 rounded-xl bg-gray-200/50 flex items-center justify-center text-gray-500 group-hover:text-teal-600 group-hover:bg-teal-50 transition-colors duration-300">
                                        {Icon && <Icon className="w-6 h-6" />}
                                    </div>
                                    <h4 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">{feature.title}</h4>
                                    <p className="text-[15px] text-gray-600 leading-relaxed whitespace-pre-line">
                                        {feature.description}
                                    </p>
                                </div>
                            )
                        })}
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
                <p className="mt-6 text-sm font-medium text-[var(--lp-primary)]/60 flex items-center justify-center gap-2">
                    <ShieldCheck size={16} />
                    No bank logins required.
                </p>
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

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Upload, PieChart, ArrowRight, Video, CheckCircle2, Circle, ChevronDown, Download } from 'lucide-react';
import BankDocumentation from './BankDocumentation';
import { gettingStartedConfig } from '../../gettingStartedConfig';

export default function GettingStarted() {
    const navigate = useNavigate();

    // Setup view state and onboarding step state
    const [currentView, setCurrentView] = useState('onboarding');
    const [unlockedStep, setUnlockedStep] = useState(1);
    const [expandedStep, setExpandedStep] = useState(1);

    useEffect(() => {
        const saved = localStorage.getItem('finsight_onboarding_step');
        if (saved) {
            const step = parseInt(saved, 10);
            setUnlockedStep(step);
            setExpandedStep(step);
            
            // Automatically center the user's current step when they navigate back from another page
            setTimeout(() => {
                const targetId = step > 4 ? 'setup-complete' : `step-${step}`;
                document.getElementById(targetId)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }, 350);
        }
    }, []);

    const completeStep = (stepNumber) => {
        const next = Math.max(unlockedStep, stepNumber + 1);
        setUnlockedStep(next);
        setExpandedStep(next);
        localStorage.setItem('finsight_onboarding_step', next.toString());
        
        // Wait for the collapse/expand CSS transition (duration-300) to complete
        // before calculating the final scroll absolute position, otherwise it misaligns.
        setTimeout(() => {
            const targetId = next > 4 ? 'setup-complete' : `step-${next}`;
            document.getElementById(targetId)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 350);
    };

    const toggleStep = (stepNumber) => {
        // Only allow toggling steps that are unlocked or completed
        if (stepNumber <= unlockedStep) {
            setExpandedStep(expandedStep === stepNumber ? null : stepNumber);
        }
    };

    const handleReturnToSetup = () => {
        setCurrentView('onboarding');
        setTimeout(() => {
            document.getElementById('step-1')?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 100);
    };

    // Converts a config step's `lines` array into JSX
    const renderLines = (lines) => (
        <div className="space-y-3">
            {lines.map((line, i) => {
                if (line.bullets) {
                    return (
                        <ul key={i} className="list-disc pl-5 space-y-1">
                            {line.bullets.map((b, j) => <li key={j}>{b}</li>)}
                        </ul>
                    );
                }
                return (
                    <p
                        key={i}
                        className={[
                            line.bold ? 'font-semibold text-lg' : '',
                            line.italic ? 'italic opacity-80 pt-2' : '',
                        ].join(' ').trim() || undefined}
                    >
                        {line.text}
                    </p>
                );
            })}
        </div>
    );

    const { steps: configSteps, header, completion, footer } = gettingStartedConfig;
    const iconMap = [null, <Zap size={32} className="text-[#034638]" />, <Upload size={32} className="text-[#034638]" />, <PieChart size={32} className="text-[#034638]" />];
    const routeMap = [null, null, '/dashboard/ai-processing', '/dashboard/processing', '/dashboard/analysis'];

    const stepsData = configSteps.map((cfg) => {
        const isStep1 = cfg.number === 1;
        return {
            number: cfg.number,
            title: cfg.title,
            description: renderLines(cfg.lines),
            icon: iconMap[cfg.number - 1] ?? null,
            imageLabel: null,
            imageSubLabel: null,
            navigateAction: isStep1
                ? () => setCurrentView('docs')
                : () => navigate(routeMap[cfg.number]),
            navigateLabel: cfg.navigateLabel,
            action: () => completeStep(cfg.number),
            actionLabel: cfg.actionLabel,
            showCheckIcon: true,
        };
    });
    if (currentView === 'docs') {
        return <BankDocumentation onBack={handleReturnToSetup} />;
    }

    return (
        <div className="w-full bg-[#f4f2f0] rounded-3xl overflow-hidden flex flex-col p-6 md:p-10 text-[#034638] animate-fade-in">

            {/* Header Section */}
            <div className="w-full flex flex-col items-center justify-center text-center space-y-6 pt-4 pb-10">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-[#034638] leading-[1.1] max-w-4xl">
                    {header.title}
                </h1>

                <div className="text-lg md:text-xl text-[#034638]/80 max-w-3xl leading-relaxed space-y-5">
                    <p>{header.paragraphs[0]}</p>
                    <p className="text-base md:text-lg opacity-90">{header.paragraphs[1]}</p>
                    <div className="pt-4">
                        <p className="text-xl md:text-2xl font-bold text-[#034638]">
                            {header.callToAction}
                        </p>
                    </div>
                </div>
            </div>

            {/* Progress Indicator */}
            <div className="max-w-3xl w-full mx-auto flex items-center justify-between gap-2 pb-8">
                {stepsData.map((step) => {
                    const isPassed = step.number < unlockedStep;
                    const isActive = step.number === unlockedStep;
                    return (
                        <div key={`progress-${step.number}`} className="flex-1 flex flex-col gap-2">
                            <div className={`h-1.5 rounded-full transition-all duration-500 ${isPassed ? 'bg-emerald-500' : isActive ? 'bg-[#034638]' : 'bg-[#034638]/10'}`} />
                            <span className={`text-[10px] md:text-xs font-bold uppercase tracking-wider ${isPassed ? 'text-emerald-700' : isActive ? 'text-[#034638]' : 'text-[#034638]/30'}`}>
                                {step.number} {step.title.split(' ')[0]}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Accordion Steps */}
            <div className="max-w-3xl w-full mx-auto space-y-4 pb-10">
                {stepsData.map((step) => {
                    const isUnlocked = step.number <= unlockedStep;
                    const isCompleted = step.number < unlockedStep;
                    const isExpanded = expandedStep === step.number;

                    return (
                        <div
                            key={step.number}
                            id={`step-${step.number}`}
                            className={`rounded-3xl border transition-all duration-300 overflow-hidden ${isExpanded
                                ? 'bg-[#f4f2f0] border-[#034638]/20 shadow-lg'
                                : isUnlocked
                                    ? 'bg-[#f4f2f0] border-[#034638]/10 hover:border-[#034638]/30 hover:bg-[#034638]/5 cursor-pointer shadow-sm'
                                    : 'bg-[#f4f2f0]/40 border-[#034638]/5 opacity-60'
                                }`}
                        >
                            {/* Accordion Header */}
                            <div
                                onClick={() => toggleStep(step.number)}
                                className={`flex items-center justify-between p-5 md:p-6 ${isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${isCompleted
                                        ? 'bg-emerald-600 text-[#f7f0e8]'
                                        : isUnlocked
                                            ? 'bg-[#034638] text-[#f7f0e8]'
                                            : 'bg-[#034638]/10 text-[#034638]/40'
                                        }`}>
                                        {isCompleted ? <CheckCircle2 size={20} /> : step.number}
                                    </div>
                                    <h3 className={`text-lg md:text-xl font-bold leading-tight ${isUnlocked ? 'text-[#034638]' : 'text-[#034638]/50'}`}>
                                        {step.title}
                                    </h3>
                                </div>

                                {isUnlocked && (
                                    <div className="text-[#034638]/40 pr-2">
                                        <ChevronDown size={24} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                )}
                            </div>

                            {/* Accordion Body */}
                            <div
                                className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100 border-t border-[#034638]/10' : 'max-h-0 opacity-0'
                                    }`}
                            >
                                <div className="p-6 pt-6">

                                    {/* Text and Actions Area */}
                                    <div className="flex flex-col w-full">
                                        <div className="text-[#034638]/80 leading-relaxed w-full mb-6">
                                            {step.description}
                                        </div>

                                        <div className="mt-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 w-full">
                                            {step.navigateAction && (
                                                <button
                                                    onClick={step.navigateAction}
                                                    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-sm shadow-md transition-all active:scale-95 focus:outline-none ${!isCompleted ? 'bg-[#034638] text-[#f7f0e8] hover:opacity-90' : 'bg-[#034638]/10 text-[#034638] hover:bg-[#034638]/20 shadow-none'}`}
                                                >
                                                    {step.navigateLabel} <ArrowRight size={16} />
                                                </button>
                                            )}

                                            {!isCompleted && step.actionLabel && (
                                                <button
                                                    onClick={step.action}
                                                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#034638] text-[#f7f0e8] hover:opacity-90 rounded-full font-bold text-sm shadow-md transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#034638] focus:ring-offset-2 focus:ring-offset-[#f4f2f0]"
                                                >
                                                    {step.showCheckIcon && <Circle size={18} strokeWidth={2.5} className="opacity-50" />}
                                                    {step.actionLabel}
                                                </button>
                                            )}

                                            {isCompleted && (
                                                <div className="flex items-center gap-2 px-5 py-3 bg-emerald-600/10 text-emerald-700/80 rounded-full font-bold text-sm cursor-default">
                                                    <CheckCircle2 size={18} />
                                                    Completed
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Completion Message */}
            {unlockedStep > 4 && (
                <div id="setup-complete" className="max-w-3xl w-full mx-auto animate-fade-in-up mt-4">
                    <div className="bg-white border border-[#034638]/10 shadow-sm rounded-3xl p-8 md:p-10 text-center relative overflow-hidden">
                        <div className="w-12 h-12 bg-emerald-600/10 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={24} />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-[#034638] mb-4">
                            {completion.title}
                        </h2>
                        <p className="text-[#034638]/70 text-lg max-w-xl mx-auto mb-8 leading-relaxed">
                            {completion.body}
                        </p>
                        <div className="pt-6 border-t border-[#034638]/5 max-w-xl mx-auto">
                            <p className="font-medium text-[#034638] mb-1">{completion.feedbackTitle}</p>
                            <p className="text-sm text-[#034638]/60 mb-5">{completion.feedbackBody}</p>
                            <button className="bg-[#f4f2f0] text-[#034638] font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-[#034638]/5 transition-all focus:outline-none">
                                {completion.feedbackButtonLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer Note */}
            <div className="w-full text-center mt-12 pt-6 border-t border-[#034638]/10 shrink-0">
                <p className="text-sm font-medium text-[#034638]/60">
                    {footer.note}
                    {unlockedStep > 1 && (
                        <button onClick={() => { setUnlockedStep(1); setExpandedStep(1); localStorage.setItem('finsight_onboarding_step', '1'); }} className="ml-4 hover:underline text-[#034638]/40 focus:outline-none">
                            {footer.resetLabel}
                        </button>
                    )}
                </p>
            </div>

        </div>
    );
}

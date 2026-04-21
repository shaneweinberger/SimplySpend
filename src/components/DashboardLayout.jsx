import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ProcessingProvider } from '../lib/ProcessingContext';
import { ArrowRight } from 'lucide-react';

export default function DashboardLayout() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Persistent date range state
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30); // Default to last 30 days
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });

    const navigate = useNavigate();
    const location = useLocation();

    // Determine if onboarding is currently in progress
    const onboardingStepStr = localStorage.getItem('finsight_onboarding_step');
    const onboardingStep = onboardingStepStr ? parseInt(onboardingStepStr, 10) : 1;
    const isOnboarding = onboardingStep < 5 && location.pathname !== '/dashboard/getting-started';

    useEffect(() => {
        const getSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    navigate('/auth');
                    return;
                }

                // Check for dev_access in profile
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('dev_access')
                    .eq('id', session.user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Error fetching profile:', error);
                }

                // Redirect if dev_access is explicitly false or if profile doesn't exist (safer default for under-construction apps)
                // User asked: "if their profile has dev_access == False"
                // I will implement: Redirect if profile exists and dev_access is false.
                // But for "Under Construction", usually everyone is blocked except allowed ones.
                // I'll assume if dev_access is NOT true, block them.
                if (!profile || profile.dev_access !== true) {
                    navigate('/under-construction');
                    return;
                }

                setUser(session.user);
            } catch (err) {
                console.error("Auth Error:", err);
                navigate('/auth');
            } finally {
                setLoading(false);
            }
        };

        getSession();
    }, [navigate]);

    if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading...</div>;

    return (
        <ProcessingProvider>
            <div className="min-h-screen bg-slate-50 flex">
                {/* Sidebar */}
                <Sidebar user={user} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

                {/* Main Content Area */}
                <div className={`flex-1 overflow-y-auto h-screen transition-all duration-300 relative ${isCollapsed ? 'ml-20' : 'ml-64'} ${['/dashboard/feedback', '/dashboard/settings', '/dashboard/upgrade'].includes(location.pathname) ? 'bg-[#212121]' : 'p-4 bg-slate-50'}`}>
                    
                    {isOnboarding && (
                        <div className="mb-4 w-full animate-fade-in">
                            <div className="bg-[#f4f2f0] border border-[#034638]/10 rounded-lg py-2 px-4 flex items-center justify-between shadow-sm">
                                <span className="font-semibold text-sm text-[#034638]/70 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                    Setup incomplete (Step {onboardingStep} of 4)
                                </span>
                                <button
                                    onClick={() => navigate('/dashboard/getting-started')}
                                    className="text-xs font-bold text-[#f7f0e8] bg-[#034638] hover:bg-[#034638]/90 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 focus:outline-none"
                                >
                                    Return to Setup <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    <Outlet context={{ startDate, setStartDate, endDate, setEndDate }} />
                </div>
            </div>
        </ProcessingProvider>
    );
}

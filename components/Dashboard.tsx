
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Page } from '../App.tsx';
import { User, RaceResults, PointsSystem, Driver, Constructor, Event } from '../types.ts';
import { PicksIcon } from './icons/PicksIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { DonationIcon } from './icons/DonationIcon.tsx';
import { LeagueIcon } from './icons/LeagueIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { getAllUsersAndPicks } from '../services/firestoreService.ts';
import { calculateScoreRollup } from '../services/scoringService.ts';
import CountdownTimer from './CountdownTimer.tsx';
import { useRaceStartEasterEgg, EasterEggOverlay } from './EasterEgg.tsx';

interface DashboardProps {
  user: User | null;
  setActivePage: (page: Page, params?: { eventId?: string }) => void;
  raceResults?: RaceResults;
  pointsSystem?: PointsSystem;
  allDrivers?: Driver[];
  allConstructors?: Constructor[];
  events: Event[];
}

// Helper for scroll animations and flare triggering
const FadeInSection: React.FC<{ children: React.ReactNode; delay?: string; className?: string }> = ({ children, delay = '0s', className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        setIsVisible(entry.isIntersecting);
        // Toggle 'animate-flare' class on children if they have 'sheen-sweep' class
        if (entry.isIntersecting && domRef.current) {
            const tiles = domRef.current.querySelectorAll('.sheen-sweep');
            tiles.forEach(tile => {
                tile.classList.add('animate-flare');
                // Remove class after animation to allow re-trigger on hover
                setTimeout(() => tile.classList.remove('animate-flare'), 2000);
            });
        }
      });
    });
    if (domRef.current) observer.observe(domRef.current);
    return () => {
      if (domRef.current) observer.unobserve(domRef.current);
    };
  }, []);

  return (
    <div
      ref={domRef}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      } ${className}`}
      style={{ transitionDelay: delay }}
    >
      {children}
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
    user, 
    setActivePage,
    events 
}) => {
  const isAdmin = user && !!user.isAdmin;
  
  // Easter Egg Hook
  const { easterEggState, activeLights, handleTriggerClick } = useRaceStartEasterEgg();
  
  // Keep local flag effect synchronized with the global easter egg state if triggered
  const isRacing = easterEggState === 'racing';

  // Find next event for countdown
  const nextEvent = useMemo(() => {
      const now = new Date();
      return events?.find(e => new Date(e.lockAtUtc) > now);
  }, [events]);

  return (
    <div className="flex flex-col w-full min-h-screen pb-20">
      <EasterEggOverlay state={easterEggState} activeLights={activeLights} />
      
      {/* 1. HERO SECTION - Full Screen for Immersive Feel */}
      <div className="relative w-full h-[90vh] md:h-screen flex items-center justify-center overflow-hidden">
         
         {/* Hero Content - Centered */}
         <div 
            className="relative z-20 text-center px-4 pb-20 flex flex-col items-center select-none"
            onClick={handleTriggerClick}
         >
            {/* Animated Title Block - Drives Up */}
            <div className="animate-drive-in opacity-0 relative">
                {/* Checkered Flags Reveal - Behind Logo */}
                {/* Added opacity-0 to flag containers to hide them initially until animation delay triggers */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full flex justify-center items-center -z-10 pointer-events-none">
                    <div className={`origin-bottom-right animate-flag-left opacity-0 ${isRacing ? 'opacity-100 z-50' : ''}`}>
                        {/* Flip Left Flag to wave outwards (Left) */}
                        <div className={`transform scale-x-[-1] ${isRacing ? 'animate-wiggle' : ''}`}>
                            <CheckeredFlagIcon className="w-16 h-16 md:w-32 md:h-32 text-pure-white" />
                        </div>
                    </div>
                    <div className={`origin-bottom-left animate-flag-right opacity-0 ${isRacing ? 'opacity-100 z-50' : ''}`}>
                        {/* Normal Right Flag waves outwards (Right) */}
                        <div className={`${isRacing ? 'animate-wiggle' : ''}`}>
                            <CheckeredFlagIcon className="w-16 h-16 md:w-32 md:h-32 text-pure-white" />
                        </div>
                    </div>
                </div>

                {/* Minimalist 5 Lights Gantry */}
                <div className="mb-6 flex flex-col items-center justify-center relative py-2 stagger-1">
                    {/* Gantry Bar (Thin Line behind lights) */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 md:w-64 h-1 bg-accent-gray rounded-full shadow-lg"></div>
                    
                    {/* The Lights */}
                    <div className="flex gap-4 md:gap-6 relative z-10">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div 
                                key={i}
                                className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#ff0000] shadow-[0_0_20px_rgba(255,0,0,0.9)] border border-red-900 ring-1 ring-black/50"
                            />
                        ))}
                    </div>
                </div>
                
                <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-pure-white mb-2 cursor-pointer active:scale-95 transition-transform uppercase stagger-2 text-glow-silver">
                    LIGHTS OUT<br/>LEAGUE
                </h1>

                {/* User Telemetry - Only for logged in users */}
                {user && (
                    <div className="flex items-center justify-center gap-4 mt-4 mb-2 stagger-3 animate-fade-in-up">
                        <div className="telemetry-row card-premium-silver border-primary-red/20 px-4 py-2 backdrop-blur-md">
                            <span className="telemetry-label mr-3 text-xs">PTS</span>
                            <span className="telemetry-value text-lg text-pure-white font-mono">{user.totalPoints || 0}</span>
                        </div>
                        <div className="telemetry-row card-premium-silver border-primary-red/20 px-4 py-2 backdrop-blur-md">
                            <span className="telemetry-label mr-3 text-xs">RANK</span>
                            <span className="telemetry-value text-lg text-glow-red font-mono">#{user.rank || '-'}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Next Race Countdown - Premium Card */}
            {nextEvent && (
                <div 
                    className="mt-8 animate-fade-in-up stagger-4 w-full max-w-sm cursor-pointer group"
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent counting clicks on the card
                        setActivePage('picks', { eventId: nextEvent.id });
                    }}
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                        e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
                    }}
                >
                    <div className="card-premium backdrop-blur-md p-6 hover:border-primary-red/50 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-[0_0_40px_rgba(218,41,28,0.2)]">
                        {/* Spotlight Gradient Layer */}
                        <div 
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                            style={{
                                background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(218, 41, 28, 0.1), transparent 40%)`
                            }}
                        />
                        
                        {/* Content */}
                        <div className="relative z-10">
                            <p className="text-[10px] text-highlight-silver uppercase tracking-[0.2em] font-bold mb-2 drop-shadow-sm">Up Next: {nextEvent.location}</p>
                            <h2 className="text-3xl font-black text-pure-white italic mb-4 drop-shadow-lg leading-none">{nextEvent.name}</h2>
                            
                            <div className="border-t border-pure-white/10 pt-4 flex flex-col items-center">
                                <p className="text-[10px] text-primary-red uppercase tracking-wider font-bold mb-2 animate-pulse-red-limited">Picks Lock In</p>
                                <CountdownTimer targetDate={nextEvent.lockAtUtc} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Start Engine Button (Only for guests) */}
            {!user && (
                <div className="animate-fade-in-up stagger-4 mt-8">
                    <button 
                        className="bg-primary-red text-pure-white font-bold py-3 px-8 rounded-full shadow-lg hover:scale-105 transition-transform hover:shadow-[0_0_20px_rgba(218,41,28,0.5)]"
                    >
                        Start Your Engine
                    </button>
                </div>
            )}
         </div>
      </div>

      {/* 2. CORE ACTION SECTIONS - Overlap (-mt-24) creates the peeking effect */}
      <div className="max-w-7xl mx-auto w-full px-4 -mt-24 relative z-30 flex flex-col gap-6 md:gap-8">
        
        {/* Main Cards Grid: Side-by-side on Desktop for better density */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            {/* Picks Section */}
            <div className="animate-peek-up opacity-0 [animation-delay:400ms]">
                <div 
                    onClick={() => setActivePage('picks')}
                    className="group card-premium card-hover p-6 md:p-10 cursor-pointer min-h-[350px] flex flex-col justify-center"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 group-hover:text-primary-red transition-all transform group-hover:scale-110 duration-500">
                        <PicksIcon className="w-64 h-64" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-14 h-14 bg-primary-red/20 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(218,41,28,0.3)] border border-primary-red/30 backdrop-blur-md">
                            <PicksIcon className="w-7 h-7 text-primary-red" />
                        </div>
                        <h2 className="text-4xl font-bold text-pure-white mb-3 group-hover:text-primary-red transition-colors drop-shadow-md">Race Strategy</h2>
                        <p className="text-highlight-silver max-w-md text-xl leading-relaxed font-light">
                            Make your team and driver selections for the upcoming Grand Prix.
                        </p>
                        <div className="mt-8 flex items-center gap-2 text-pure-white font-bold text-sm uppercase tracking-wider">
                            Manage Picks <span className="group-hover:translate-x-1 transition-transform text-primary-red">→</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Standings Section */}
            <FadeInSection delay="0.2s" className="h-full">
                <div 
                    onClick={() => setActivePage('leaderboard')}
                    className="group card-premium card-hover p-6 md:p-10 cursor-pointer h-full flex flex-col justify-center min-h-[350px]"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 group-hover:text-primary-red transition-all transform group-hover:-rotate-12 duration-500">
                        <LeaderboardIcon className="w-64 h-64" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-14 h-14 bg-primary-red/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md shadow-[0_0_15px_rgba(218,41,28,0.3)] border border-primary-red/30">
                            <LeaderboardIcon className="w-7 h-7 text-primary-red" />
                        </div>
                        <h2 className="text-4xl font-bold text-pure-white mb-3 group-hover:text-primary-red transition-colors drop-shadow-md">Leaderboard</h2>
                        <p className="text-highlight-silver max-w-sm text-xl leading-relaxed font-light">
                            Track the championship battle.
                        </p>
                        <div className="mt-8 flex items-center gap-2 text-pure-white font-bold text-sm uppercase tracking-wider">
                            View Leaderboards <span className="group-hover:translate-x-1 transition-transform text-primary-red">→</span>
                        </div>
                    </div>
                </div>
            </FadeInSection>
        </div>

        {/* 3. UTILITY GRID - Redesigned as Large Tiles */}
        <FadeInSection delay="0.3s">
            <h3 className="text-highlight-silver text-xs font-bold uppercase tracking-widest mb-4 ml-1">Team Operations</h3>
            {/* Switched to a responsive grid that allows for larger, card-like tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                <QuickAction 
                    icon={ProfileIcon} 
                    label="Profile" 
                    sub="History & Stats" 
                    onClick={() => setActivePage('profile')} 
                    delay="stagger-1"
                />
                <QuickAction 
                    icon={LeagueIcon} 
                    label="League" 
                    sub="Rules & Scoring" 
                    onClick={() => setActivePage('league-hub')} 
                    delay="stagger-2"
                />
                <QuickAction 
                    icon={DonationIcon} 
                    label="Donate" 
                    sub="Victory Junction" 
                    onClick={() => setActivePage('donate')} 
                    delay="stagger-3"
                />
                {isAdmin && (
                    <QuickAction 
                        icon={AdminIcon} 
                        label="Admin" 
                        sub="League Controls" 
                        onClick={() => setActivePage('admin')} 
                        highlight // Admin card gets subtle highlight
                        delay="stagger-4"
                    />
                )}
            </div>
        </FadeInSection>

      </div>
      
    </div>
  );
};

// Redesigned QuickAction to match V2 Design System (Premium Cards)
const QuickAction: React.FC<{ 
    icon: React.FC<React.SVGProps<SVGSVGElement>>; 
    label: string; 
    sub: string;
    onClick: () => void;
    highlight?: boolean;
    delay?: string;
}> = ({ icon: Icon, label, sub, onClick, highlight, delay }) => (
    <div
        onClick={onClick}
        className={`group relative overflow-hidden p-6 shadow-xl cursor-pointer transition-all duration-300 min-h-[220px] flex flex-col justify-between animate-fade-in-up ${delay || ''} card-hover ${
            highlight ? 'card-premium' : 'card-premium-silver'
        }`}
    >
        {/* Background Icon Faded */}
        <div className={`absolute -top-6 -right-6 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:brightness-150 transition-all transform group-hover:scale-110 group-hover:rotate-12 duration-500 pointer-events-none ${highlight ? 'text-primary-red' : 'text-pure-white'}`}>
            <Icon className="w-40 h-40" />
        </div>

        <div className="relative z-10">
            {/* Small Icon Container */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 backdrop-blur-sm border ${
                highlight 
                ? 'bg-primary-red/20 text-pure-white border-primary-red/40 shadow-[0_0_15px_rgba(218,41,28,0.3)]' 
                : 'bg-pure-white/5 text-highlight-silver border-pure-white/10 group-hover:bg-primary-red/10 group-hover:text-primary-red group-hover:border-primary-red/30 group-hover:shadow-[0_0_15px_rgba(218,41,28,0.2)]'
            }`}>
                <Icon className="w-6 h-6" />
            </div>

            {/* Typography */}
            <h3 className={`text-2xl font-bold mb-2 transition-colors ${highlight ? 'text-pure-white' : 'text-pure-white group-hover:text-primary-red'}`}>
                {label}
            </h3>
            <p className="text-highlight-silver text-sm leading-relaxed font-medium opacity-80">
                {sub}
            </p>
        </div>

        {/* Footer Link */}
        <div className="relative z-10 mt-6 pt-4 border-t border-pure-white/5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-pure-white/90 group-hover:text-primary-red transition-colors">
            <span>View Details</span>
            <span className="group-hover:translate-x-1 transition-transform text-lg leading-none">→</span>
        </div>
    </div>
);

export default Dashboard;

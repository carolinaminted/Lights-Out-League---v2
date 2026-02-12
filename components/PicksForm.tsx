
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PickSelection, EntityClass, Event, Constructor, Driver, User } from '../types.ts';
import SelectorGroup from './SelectorGroup.tsx';
import { SubmitIcon } from './icons/SubmitIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { LockIcon } from './icons/LockIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { CONSTRUCTORS } from '../constants.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import CountdownTimer from './CountdownTimer.tsx';

const getInitialPicks = (): PickSelection => ({
  aTeams: [null, null],
  bTeam: null,
  aDrivers: [null, null, null],
  bDrivers: [null, null],
  fastestLap: null,
});

interface PicksFormProps {
  user: User;
  event: Event;
  initialPicksForEvent?: PickSelection;
  onPicksSubmit: (eventId: string, picks: PickSelection) => void;
  formLocks: { [eventId: string]: boolean };
  aTeams: Constructor[];
  bTeams: Constructor[];
  aDrivers: Driver[];
  bDrivers: Driver[];
  allDrivers: Driver[];
  allConstructors: Constructor[];
  getUsage: (id: string, type: 'teams' | 'drivers') => number;
  getLimit: (entityClass: EntityClass, type: 'teams' | 'drivers') => number;
  hasRemaining: (id: string, type: 'teams' | 'drivers') => boolean;
}

const PicksForm: React.FC<PicksFormProps> = ({
  user,
  event,
  initialPicksForEvent,
  onPicksSubmit,
  formLocks,
  aTeams,
  bTeams,
  aDrivers,
  bDrivers,
  allDrivers,
  allConstructors,
  getUsage,
  getLimit,
  hasRemaining
}) => {
  const [picks, setPicks] = useState<PickSelection>(initialPicksForEvent || getInitialPicks());
  const [isEditing, setIsEditing] = useState<boolean>(!initialPicksForEvent);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  
  // Time-based locking logic
  const [isTimeLocked, setIsTimeLocked] = useState(() => {
      return event.lockAtUtc ? new Date(event.lockAtUtc).getTime() <= Date.now() : false;
  });

  const { showToast } = useToast();

  const isSubmitted = !!initialPicksForEvent;
  
  // Unified lock variables
  const isEffectiveLocked = formLocks[event.id] || isTimeLocked;
  const isFormDisabled = isEffectiveLocked && !user.isAdmin;

  // Handle expiration from the Timer component
  const handleTimerExpire = useCallback(() => {
      if (!isTimeLocked) {
          setIsTimeLocked(true);
          if (isEditing && !user.isAdmin) {
              showToast("Time's up! Picks for this event are now locked.", 'error');
          }
      }
  }, [isTimeLocked, isEditing, user.isAdmin, showToast]);

  // Sync state if event changes
  useEffect(() => {
    const savedPicks = initialPicksForEvent;
    setPicks(savedPicks || getInitialPicks());
    setIsEditing(!savedPicks);
    setIsTimeLocked(event.lockAtUtc ? new Date(event.lockAtUtc).getTime() <= Date.now() : false);
  }, [event.id, initialPicksForEvent, event.lockAtUtc]);

  // Force-exit editing mode if form becomes locked mid-session
  useEffect(() => {
    if (isFormDisabled && isEditing) {
        setIsEditing(false);
        showToast("This event has been locked by the administrator.", 'warning');
    }
  }, [isFormDisabled, isEditing, showToast]);

  // Sort drivers by constructor RANK to pair teammates together
  const sortedDrivers = useMemo(() => {
    return [...allDrivers].sort((a, b) => {
        const getRank = (id: string) => CONSTRUCTORS.findIndex(c => c.id === id) ?? 999;
        const teamAIndex = getRank(a.constructorId);
        const teamBIndex = getRank(b.constructorId);
        if (teamAIndex !== teamBIndex) return teamAIndex - teamBIndex;
        return a.name.localeCompare(b.name);
    });
  }, [allDrivers]);

  const handleSelect = useCallback((category: keyof PickSelection, value: string | null, index?: number) => {
    if (isFormDisabled) return; // HARD STOP
    setPicks(prev => {
      const newPicks = { ...prev };
      const field = newPicks[category];
      if (Array.isArray(field) && typeof index === 'number') {
        const newArray = [...field];
        newArray[index] = value;
        (newPicks as any)[category] = newArray;
      } else {
        (newPicks as any)[category] = value;
      }
      return newPicks;
    });
  }, [isFormDisabled]);
  
  const isSelectionComplete = () => {
      return picks.aTeams.every(p => p) &&
             picks.bTeam &&
             picks.aDrivers.every(p => p) &&
             picks.bDrivers.every(p => p) &&
             picks.fastestLap;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormDisabled) {
        showToast("This event is locked. Picks cannot be submitted.", 'error');
        return;
    }
    if (user.isAdmin && isTimeLocked) {
        if (!confirm("Admin Override: This event is time-locked. Submit anyway?")) {
            return;
        }
    }
    if (isSelectionComplete()) {
        onPicksSubmit(event.id, picks);
        setIsEditing(false);
    } else {
        showToast("Please complete all selections before submitting.", 'error');
    }
  };
  
  // PRIMARY LOCK GATE: If locked for a non-admin, show the lock screen immediately.
  if (isFormDisabled) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
            <div className="max-w-4xl w-full text-center card-premium p-8 md:p-12 shadow-2xl relative overflow-hidden animate-fade-in-up">
                <div className="absolute inset-0 bg-checkered-flag opacity-[0.03] pointer-events-none"></div>
                <div className="w-24 h-24 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary-red/30 shadow-[0_0_30px_rgba(218,41,28,0.2)] animate-pulse-red-limited">
                    <LockIcon className="w-10 h-10 text-primary-red" />
                </div>
                <h2 className="text-4xl font-black text-pure-white mb-2 relative z-10 italic uppercase tracking-tighter">Picks Locked</h2>
                <p className="text-highlight-silver relative z-10 text-lg max-w-md mx-auto">
                    {isSubmitted 
                        ? "Your submitted picks for this event are final and cannot be edited."
                        : "This session is closed. Picks can no longer be submitted."
                    }
                </p>
                {isSubmitted && (
                    <div className="mt-8 p-4 bg-green-900/20 border border-green-500/30 rounded-lg inline-block backdrop-blur-sm">
                        <p className="text-sm font-bold text-green-400 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Submission Confirmed
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
  }
  
  // Confirmation Screen (if not editing and not locked)
  if (!isEditing) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
            <div className="max-w-4xl w-full text-center card-premium p-8 md:p-12 shadow-2xl animate-fade-in-up relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50"></div>
                
                <h2 className="text-4xl font-black text-pure-white mb-2 relative z-10 italic uppercase tracking-tighter stagger-1">Ready to Race</h2>
                <p className="text-highlight-silver relative z-10 text-lg mb-8 stagger-2">Your strategy is locked in. Good luck, {user.displayName}!</p>
                
                {!isEffectiveLocked && (
                    <div className="mb-8 p-6 bg-carbon-black/40 rounded-xl border border-pure-white/5 backdrop-blur-sm relative z-10 stagger-3 shadow-inner">
                        <p className="text-[10px] text-highlight-silver uppercase tracking-widest font-bold mb-2">Time Remaining to Edit</p>
                        <CountdownTimer targetDate={event.lockAtUtc} onExpire={handleTimerExpire} className="justify-center" />
                    </div>
                )}

                <div className="mt-4 relative z-10 stagger-4">
                    <button 
                        onClick={() => setIsEditing(true)} 
                        disabled={isFormDisabled}
                        className="bg-accent-gray hover:bg-pure-white hover:text-carbon-black text-pure-white font-bold py-3 px-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg border border-pure-white/10 uppercase tracking-wider text-sm"
                    >
                        {isFormDisabled ? 'Editing Locked' : 'Adjust Strategy'}
                    </button>
                </div>
            </div>
        </div>
    );
  }

  // Resolve Fastest Lap Selections
  const selectedFLDriver = allDrivers.find(d => d.id === picks.fastestLap) || null;
  let flColor = undefined;
  if (selectedFLDriver) {
      const cId = selectedFLDriver.constructorId;
      flColor = allConstructors.find(c => c.id === cId)?.color || CONSTRUCTORS.find(c => c.id === cId)?.color;
  }

  const openFastestLapModal = () => {
      if(isFormDisabled) return;
      const isAnyFastestLapSelected = !!picks.fastestLap;
      const modalBody = (
          <div className="p-6">
              <div className="text-center mb-6">
                  <h4 className="text-2xl font-bold text-pure-white italic uppercase tracking-wider">Select Fastest Lap</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {sortedDrivers.map(driver => {
                       let constructor = allConstructors.find(c => c.id === driver.constructorId) || CONSTRUCTORS.find(c => c.id === driver.constructorId);
                       const color = constructor?.color;
                       return (
                           <SelectorCard
                               key={driver.id}
                               option={driver}
                               isSelected={picks.fastestLap === driver.id}
                               onClick={() => { handleSelect('fastestLap', driver.id); setModalContent(null); }}
                               placeholder="Driver"
                               disabled={isFormDisabled}
                               color={color}
                               forceColor={!isAnyFastestLapSelected}
                           />
                       );
                   })}
              </div>
          </div>
      );
      setModalContent(modalBody);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
        <div className="card-premium-silver p-4 md:p-6 flex flex-col md:flex-row justify-between md:items-center gap-4 flex-none relative overflow-hidden">
          {/* Header Background Shine */}
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <F1CarIcon className="w-64 h-64 text-pure-white transform -rotate-12" />
          </div>

          <div className="flex-grow text-center md:text-left z-10">
            <h2 className="text-3xl md:text-4xl font-black text-pure-white leading-none italic uppercase tracking-tighter mb-1">{event.name}</h2>
            <p className="text-highlight-silver text-sm md:text-base font-bold uppercase tracking-wider mb-2">Round {event.round} • {event.country}</p>
            <div className="inline-flex items-center gap-2 bg-carbon-black/50 px-3 py-1.5 rounded-lg border border-pure-white/10 backdrop-blur-sm">
                <span className="text-xs text-highlight-silver uppercase font-bold">Lock In:</span>
                <span className="font-mono text-primary-red font-bold text-sm">
                    {new Date(event.lockAtUtc).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', weekday: 'short' })}
                </span>
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center py-2 md:py-0 md:px-6 z-10 border-y md:border-y-0 md:border-x border-pure-white/10 bg-black/10 md:bg-transparent rounded-lg md:rounded-none">
              <p className="text-[10px] text-highlight-silver uppercase tracking-[0.2em] font-bold mb-1 opacity-80">Time Remaining</p>
              <CountdownTimer targetDate={event.lockAtUtc} onExpire={handleTimerExpire} />
          </div>
          
          <div className="text-center bg-carbon-black/20 p-2 rounded-lg md:bg-transparent md:p-0 flex flex-col items-center justify-center gap-2 min-w-[120px] z-10">
              <div>
                  <p className="hidden md:block text-[10px] uppercase tracking-wider font-bold text-highlight-silver mb-1">
                      {isEffectiveLocked ? "Status" : "Status"}
                  </p>
                  <p className={`text-xl font-black tracking-wider uppercase ${isEffectiveLocked ? "text-primary-red" : "text-green-400"}`}>
                      {isEffectiveLocked ? "LOCKED" : "OPEN"}
                  </p>
              </div>
              <div>
                {isSubmitted ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-green-600/20 text-green-400 px-3 py-1 rounded-full border border-green-600/30">Submitted</span>
                ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-accent-gray text-highlight-silver px-3 py-1 rounded-full border border-pure-white/10">Drafting</span>
                )}
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
                 <SelectorGroup
                    title="Class A Teams" slots={2} options={aTeams} selected={picks.aTeams}
                    onSelect={(value, index) => handleSelect('aTeams', value, index)}
                    getUsage={getUsage} getLimit={getLimit} hasRemaining={hasRemaining}
                    entityType="teams" setModalContent={setModalContent} disabled={isFormDisabled} allConstructors={allConstructors}
                />
                <SelectorGroup
                    title="Class B Team" slots={1} options={bTeams} selected={[picks.bTeam]}
                    onSelect={(value) => handleSelect('bTeam', value, 0)}
                    getUsage={getUsage} getLimit={getLimit} hasRemaining={hasRemaining}
                    entityType="teams" setModalContent={setModalContent} disabled={isFormDisabled} allConstructors={allConstructors}
                />
            </div>
            <div className="space-y-6 flex flex-col">
                 <SelectorGroup
                    title="Class A Drivers" slots={3} options={aDrivers} selected={picks.aDrivers}
                    onSelect={(value, index) => handleSelect('aDrivers', value, index)}
                    getUsage={getUsage} getLimit={getLimit} hasRemaining={hasRemaining}
                    entityType="drivers" setModalContent={setModalContent} disabled={isFormDisabled} allConstructors={allConstructors}
                />
                <SelectorGroup
                    title="Class B Drivers" slots={2} options={bDrivers} selected={picks.bDrivers}
                    onSelect={(value, index) => handleSelect('bDrivers', value, index)}
                    getUsage={getUsage} getLimit={getLimit} hasRemaining={hasRemaining}
                    entityType="drivers" setModalContent={setModalContent} disabled={isFormDisabled} allConstructors={allConstructors}
                />
            </div>
        </div>

        <div className="card-premium-silver p-4 md:p-6 flex flex-col md:flex-row items-end gap-4 md:gap-8">
             <div className="w-full md:flex-1 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <div className="bg-primary-red/10 p-1.5 rounded-lg">
                        <FastestLapIcon className="w-5 h-5 text-primary-red" />
                    </div>
                    <h3 className="text-lg font-bold text-pure-white uppercase tracking-wider">Fastest Lap</h3>
                </div>
                <div className="h-20">
                    <SelectorCard 
                        option={selectedFLDriver} isSelected={!!selectedFLDriver}
                        onClick={openFastestLapModal} placeholder="Select Driver"
                        disabled={isFormDisabled} color={flColor} forceColor={!!selectedFLDriver}
                    />
                </div>
            </div>
            <div className="w-full md:flex-1">
                <button
                    type="submit"
                    disabled={!isSelectionComplete() || isFormDisabled}
                    className="w-full h-20 flex items-center justify-center gap-3 bg-primary-red hover:bg-red-600 text-pure-white font-black text-xl rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-primary-red/30 disabled:bg-accent-gray disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100 uppercase tracking-widest italic"
                >
                    {isFormDisabled ? <LockIcon className="w-6 h-6" /> : <SubmitIcon className="w-6 h-6" />}
                    {isFormDisabled ? 'Event Locked' : 'Lock In Picks'}
                </button>
            </div>
        </div>
      </form>
      
      {modalContent && (
        <div 
          className="fixed inset-0 bg-carbon-black/90 flex items-end md:items-center justify-center z-[999] md:p-4 pb-safe md:pb-4 backdrop-blur-sm" 
          onClick={() => setModalContent(null)}
        >
          <div 
            className="bg-carbon-fiber rounded-t-2xl md:rounded-xl w-full md:max-w-3xl max-h-[85vh] md:max-h-[80vh] overflow-y-auto animate-slide-up shadow-2xl ring-1 ring-pure-white/10 border border-pure-white/10" 
            onClick={(e) => e.stopPropagation()}
          >
              <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={() => setModalContent(null)}>
                  <div className="w-12 h-1.5 bg-pure-white/20 rounded-full"></div>
              </div>
              {modalContent}
          </div>
        </div>
      )}
    </>
  );
};

interface SelectorCardProps {
    option: { id: string, name: string } | null;
    isSelected: boolean;
    onClick: () => void;
    isDropdown?: boolean;
    options?: { id: string, name: string, class: EntityClass }[];
    onSelect?: (id: string | null) => void;
    placeholder?: string;
    usage?: string;
    disabled?: boolean;
    color?: string;
    forceColor?: boolean;
}

export const SelectorCard: React.FC<SelectorCardProps> = ({ option, isSelected, onClick, isDropdown, options, onSelect, placeholder, usage, disabled, color, forceColor }) => {
    
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const showColor = (isSelected || forceColor) && color;

    // Base card styles with V2 enhancements
    const baseClasses = `
        relative p-2 rounded-xl border flex flex-col justify-center items-center h-full text-center
        transition-all duration-300 min-h-[4rem] group overflow-hidden card-hover
    `;

    // Dynamic style calculation
    const getCardStyle = () => {
        if (disabled) return { opacity: 0.5, cursor: 'not-allowed', filter: 'grayscale(1)' };
        
        if (showColor) {
            // Selected state with team color
            return {
                borderColor: isSelected ? color : `${color}60`,
                backgroundColor: isSelected ? hexToRgba(color!, 0.2) : hexToRgba(color!, 0.05),
                boxShadow: isSelected ? `0 0 20px ${hexToRgba(color!, 0.2)}` : 'none',
                transform: isSelected ? 'scale(1.02)' : 'none'
            };
        }
        
        if (isSelected && !color) {
            // Generic selected state (e.g. if color missing)
            return {
                borderColor: '#DA291C',
                backgroundColor: 'rgba(218, 41, 28, 0.1)',
                boxShadow: '0 0 15px rgba(218, 41, 28, 0.2)'
            };
        }

        // Default empty/unselected state
        return {
            borderColor: 'rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(17,17,17,0.6)'
        };
    };

    if (isDropdown && options && onSelect) { 
        return (
            <div className="relative">
                <select
                    value={option?.id || ''}
                    onChange={(e) => onSelect(e.target.value || null)}
                    disabled={disabled}
                    style={color && isSelected ? { borderColor: color, boxShadow: `0 0 0 1px ${color}` } : {}}
                    className="w-full bg-carbon-black border border-accent-gray rounded-xl shadow-sm py-3 px-4 text-sm text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red appearance-none disabled:bg-accent-gray disabled:cursor-not-allowed transition-all"
                >
                    <option value="">{placeholder}</option>
                    {options.map(opt => (
                        <option key={opt.id} value={opt.id} disabled={disabled || (usage?.includes('0') && opt.id !== option?.id)}>
                            {opt.name}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-highlight-silver">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
        );
    }
    
    const styles = getCardStyle();

    return (
        <div 
            onClick={disabled ? undefined : onClick}
            style={styles}
            className={`${baseClasses} ${!showColor && !isSelected && !disabled ? 'hover:border-pure-white/30 hover:bg-carbon-black' : ''}`}
        >
            {/* Color Stripe accent for unselected but colored cards */}
            {showColor && !isSelected && !disabled && (
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }}></div>
            )}

            <p className={`font-bold text-sm md:text-base leading-tight z-10 transition-colors ${isSelected || forceColor ? 'text-pure-white' : 'text-ghost-white group-hover:text-pure-white'}`}>
                {option ? option.name : placeholder}
            </p>
            {usage && (
                <div className={`telemetry-row mt-2 py-0.5 px-2 rounded text-[10px] font-mono border ${isSelected ? 'border-pure-white/20 bg-black/20' : 'border-transparent bg-pure-white/5'}`}>
                    <span className="text-highlight-silver opacity-80">{usage}</span>
                </div>
            )}
        </div>
    );
};

export default PicksForm;

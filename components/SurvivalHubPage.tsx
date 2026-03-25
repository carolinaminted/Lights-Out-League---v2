import React, { useState, useMemo } from 'react';
import { PageHeader } from './ui/PageHeader.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { User, SurvivalConfig, SurvivalPickDoc, SurvivalStanding, Driver, Constructor, Event, RaceResults } from '../types.ts';
import { saveSurvivalPick } from '../services/firestoreService.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { AppSkeleton as LoadingSkeleton } from './LoadingSkeleton.tsx';

interface SurvivalHubPageProps {
  user: User;
  survivalConfig: SurvivalConfig | null;
  survivalPicks: SurvivalPickDoc;
  survivalStandings: SurvivalStanding[];
  allDrivers: Driver[];
  allConstructors: Constructor[];
  events: Event[];
  formLocks: { [eventId: string]: boolean };
  raceResults: RaceResults;
  navigateToPage: (page: any) => void;
}

export const SurvivalHubPage: React.FC<SurvivalHubPageProps> = ({
  user,
  survivalConfig,
  survivalPicks,
  survivalStandings,
  allDrivers,
  allConstructors,
  events,
  formLocks,
  raceResults,
  navigateToPage
}) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; message: string } | null>(null);

  // 1. Dues Gate
  if (user.duesPaidStatus !== 'Paid') {
    return (
      <div className="pb-safe">
        <PageHeader title="Podium Survival" icon={TrophyIcon} />
        <div className="p-4 max-w-md mx-auto mt-8">
          <div className="bg-carbon-fiber rounded-xl p-6 border border-red-500/30 text-center space-y-4">
            <TrophyIcon className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">League Dues Required</h2>
            <p className="text-gray-400 text-sm">
              You must pay your league dues to participate in the Podium Survival Challenge.
            </p>
            <button
              onClick={() => navigateToPage('duesPayment')}
              className="w-full bg-primary-red hover:bg-red-700 text-white font-bold rounded-lg px-6 py-3 transition-colors mt-4"
            >
              Pay Dues Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Challenge Not Started
  if (!survivalConfig || survivalConfig.status === 'pending') {
    return (
      <div className="pb-safe">
        <PageHeader title="Podium Survival" icon={TrophyIcon} />
        <div className="p-4 max-w-md mx-auto mt-8">
          <div className="bg-carbon-fiber rounded-xl p-6 border border-white/10 text-center space-y-4">
            <TrophyIcon className="w-12 h-12 text-gray-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Challenge Pending</h2>
            <p className="text-gray-400 text-sm">
              The Podium Survival Challenge hasn't started yet. Check back later!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2.5 Not in challenge
  if (!survivalConfig.lockedParticipants.includes(user.id)) {
    return (
      <div className="pb-safe">
        <PageHeader title="Podium Survival" icon={TrophyIcon} />
        <div className="p-4 max-w-md mx-auto mt-8">
          <div className="bg-carbon-fiber rounded-xl p-6 border border-white/10 text-center space-y-4">
            <TrophyIcon className="w-12 h-12 text-gray-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Not Participating</h2>
            <p className="text-gray-400 text-sm">
              The challenge has already started and you are not on the roster. Better luck next season!
            </p>
            <button
              onClick={() => navigateToPage('survival-leaderboard')}
              className="w-full bg-carbon-black hover:bg-gray-800 border border-white/20 text-white font-bold rounded-lg px-6 py-4 transition-colors flex justify-between items-center mt-4"
            >
              <span>View Survival Leaderboard</span>
              <span className="text-gray-400">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const myStanding = survivalStandings.find(s => s.userId === user.id);
  const currentEvent = events.find(e => e.id === survivalConfig.currentEventId);
  const isAlive = myStanding?.status === 'alive';
  const survivorsCount = survivalStandings.filter(s => s.status === 'alive').length;

  // 3. Lock Logic
  const isLocked = useMemo(() => {
    if (!currentEvent) return true;
    if (formLocks[currentEvent.id]) return true;
    if (currentEvent.lockAtUtc) {
      return new Date() >= new Date(currentEvent.lockAtUtc);
    }
    return false;
  }, [formLocks, currentEvent]);

  const currentPick = currentEvent ? survivalPicks[currentEvent.id]?.driverId : null;

  const handleSubmitPick = async () => {
    if (!selectedDriverId || !currentEvent || !isAlive || isLocked) return;

    // Validate usage
    const usage = myStanding?.driverUsage[selectedDriverId] || 0;
    if (usage >= survivalConfig.maxDriverUses) {
      showToast(`You have already used this driver ${survivalConfig.maxDriverUses} times.`, 'error');
      return;
    }

    setConfirmAction({
      action: async () => {
        setIsSubmitting(true);
        try {
          await saveSurvivalPick(user.id, currentEvent.id, {
            driverId: selectedDriverId,
            submittedAt: new Date()
          });
          showToast('Survival pick submitted!', 'success');
          setSelectedDriverId(null); // Clear selection after save
        } catch (error) {
          console.error('Error saving survival pick:', error);
          showToast('Failed to submit pick.', 'error');
        } finally {
          setIsSubmitting(false);
        }
      },
      message: 'Submit this driver for the survival round?'
    });
  };

  // Helper to get constructor color
  const getConstructorColor = (driverId: string) => {
    const driver = allDrivers.find(d => d.id === driverId);
    if (!driver) return '#666';
    const constructor = allConstructors.find(c => c.id === driver.constructorId);
    return constructor?.color || '#666';
  };

  return (
    <div className="pb-safe">
      <PageHeader 
        title="Podium Survival" 
        icon={TrophyIcon} 
      />

      <div className="p-4 space-y-6 max-w-3xl mx-auto">
        
        {/* Status Card */}
        <div className={`rounded-xl p-6 border-l-4 ${isAlive ? 'border-green-500 bg-carbon-fiber' : 'border-red-500 bg-carbon-fiber opacity-80'} relative overflow-hidden`}>
          {isAlive && <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>}
          {!isAlive && <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>}
          
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h2 className={`text-2xl font-bold ${isAlive ? 'text-green-400' : 'text-red-400'} mb-1`}>
                {isAlive ? '🟢 YOU ARE ALIVE' : '💀 ELIMINATED'}
              </h2>
              <p className="text-sm text-gray-300">
                {survivalConfig.status === 'completed' 
                  ? 'Challenge Completed' 
                  : `Round ${myStanding?.survivedRounds || 0} Survived`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">{survivorsCount}</p>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Survivors</p>
            </div>
          </div>

          {!isAlive && myStanding?.eliminatedAtEventId && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-sm text-gray-400">
                Eliminated at <span className="text-white font-medium">{events.find(e => e.id === myStanding.eliminatedAtEventId)?.name || 'Unknown'}</span>
                {myStanding.eliminatedReason === 'missed_pick' ? ' (Missed Pick)' : ' (Wrong Pick)'}
              </p>
            </div>
          )}
        </div>

        {/* Pick Form (Only if alive, active, and event exists) */}
        {isAlive && survivalConfig.status === 'active' && currentEvent && (
          <div className="bg-carbon-fiber rounded-xl p-6 border border-white/10 space-y-4">
            <div className="flex justify-between items-end border-b border-white/10 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">Select Your Driver</h3>
                <p className="text-sm text-gray-400 mt-1">{currentEvent.name}</p>
              </div>
              {isLocked ? (
                <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full border border-red-500/30">
                  🔒 LOCKED
                </span>
              ) : (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30">
                  🟢 OPEN
                </span>
              )}
            </div>

            {currentPick && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                  ✓
                </div>
                <div>
                  <p className="text-xs text-green-400/80 uppercase tracking-wider mb-1">Current Pick</p>
                  <p className="text-lg font-bold text-white">
                    {allDrivers.find(d => d.id === currentPick)?.name || currentPick}
                  </p>
                </div>
              </div>
            )}

            {!isLocked && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {allDrivers.filter(d => d.isActive).map(driver => {
                    const usage = myStanding?.driverUsage[driver.id] || 0;
                    const isMaxed = usage >= survivalConfig.maxDriverUses;
                    const isSelected = selectedDriverId === driver.id;
                    const isCurrentPick = currentPick === driver.id;
                    const color = getConstructorColor(driver.id);

                    return (
                      <button
                        key={driver.id}
                        onClick={() => !isMaxed && setSelectedDriverId(driver.id)}
                        disabled={isMaxed || isLocked}
                        className={`
                          relative p-3 rounded-lg text-left transition-all overflow-hidden border
                          ${isMaxed ? 'opacity-40 cursor-not-allowed border-white/5 bg-carbon-black' : 'cursor-pointer hover:bg-gray-800'}
                          ${isSelected ? 'ring-2 ring-primary-red border-transparent bg-carbon-black' : 'border-white/10 bg-carbon-black/50'}
                          ${isCurrentPick && !isSelected ? 'ring-1 ring-green-500/50' : ''}
                        `}
                      >
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1" 
                          style={{ backgroundColor: color }}
                        />
                        <div className="pl-2">
                          <p className="font-bold text-white text-sm truncate">{driver.name}</p>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs text-gray-400">Uses:</span>
                            <span className={`text-xs font-mono font-bold ${isMaxed ? 'text-red-400' : 'text-white'}`}>
                              {usage}/{survivalConfig.maxDriverUses}
                            </span>
                          </div>
                        </div>
                        {isMaxed && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                            <span className="text-xs font-bold text-red-400 bg-red-500/20 px-2 py-1 rounded border border-red-500/30 transform -rotate-12">
                              MAXED
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-4 mt-4 border-t border-white/10">
                  <button
                    onClick={handleSubmitPick}
                    disabled={!selectedDriverId || isSubmitting}
                    className="w-full bg-primary-red hover:bg-red-700 text-white font-bold rounded-lg px-6 py-3 disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Survival Pick'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Round History */}
        <div className="bg-carbon-fiber rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white border-b border-white/10 pb-4 mb-4">Your History</h3>
          
          {Object.keys(survivalPicks).length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No picks submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {events.filter(e => survivalPicks[e.id]).map(event => {
                const pick = survivalPicks[event.id];
                const driverName = allDrivers.find(d => d.id === pick.driverId)?.name || pick.driverId;
                const result = raceResults[event.id];
                
                let statusIcon = '⏳';
                let statusText = 'Pending';
                
                if (result && result.grandPrixFinish && result.grandPrixFinish.length > 0) {
                  const pos = result.grandPrixFinish.indexOf(pick.driverId);
                  if (pos !== -1 && pos < 3) {
                    statusIcon = '✅';
                    statusText = `P${pos + 1}`;
                  } else {
                    statusIcon = '❌';
                    statusText = pos !== -1 ? `P${pos + 1}` : 'DNF';
                  }
                }

                return (
                  <div key={event.id} className="flex justify-between items-center p-3 bg-carbon-black/50 rounded-lg border border-white/5">
                    <div>
                      <p className="text-sm font-bold text-white">{event.name}</p>
                      <p className="text-xs text-gray-400">{driverName}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg">{statusIcon}</span>
                      <p className="text-xs text-gray-400 mt-1">{statusText}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Leaderboard Link */}
        <button
          onClick={() => navigateToPage('survival-leaderboard')}
          className="w-full bg-carbon-black hover:bg-gray-800 border border-white/20 text-white font-bold rounded-lg px-6 py-4 transition-colors flex justify-between items-center"
        >
          <span>View Survival Leaderboard</span>
          <span className="text-gray-400">→</span>
        </button>

        {/* Custom Confirmation Modal */}
        {confirmAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-accent-gray border border-primary-red/50 rounded-xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(218,41,28,0.2)] ring-1 ring-pure-white/10 animate-peek-up">
              <h2 className="text-xl font-bold text-pure-white mb-4">Confirm Pick</h2>
              <p className="text-highlight-silver mb-8 text-sm">{confirmAction.message}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    confirmAction.action();
                    setConfirmAction(null);
                  }}
                  className="flex-1 bg-primary-red hover:bg-red-600 text-pure-white font-bold py-3 rounded-lg"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 bg-transparent hover:bg-pure-white/5 text-highlight-silver font-bold py-3 rounded-lg border border-pure-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

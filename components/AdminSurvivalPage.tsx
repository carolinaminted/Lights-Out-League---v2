import React, { useState, useMemo, useEffect } from 'react';
import { PageHeader } from './ui/PageHeader.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { SurvivalConfig, SurvivalStanding, SurvivalPickDoc, Event, User, RaceResults } from '../types.ts';
import { initializeSurvivalChallenge, saveSurvivalConfig, batchUpdateSurvivalStandings, getAllUsers } from '../services/firestoreService.ts';
import { processSurvivalRound, resolveTiebreaker } from '../services/survivalService.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { AppSkeleton as LoadingSkeleton } from './LoadingSkeleton.tsx';

interface AdminSurvivalPageProps {
  survivalConfig: SurvivalConfig | null;
  survivalStandings: SurvivalStanding[];
  survivalPicks: { [uid: string]: SurvivalPickDoc };
  events: Event[];
  raceResults: RaceResults;
  setAdminSubPage: (page: 'dashboard') => void;
}

export const AdminSurvivalPage: React.FC<AdminSurvivalPageProps> = ({
  survivalConfig,
  survivalStandings,
  survivalPicks,
  events,
  raceResults,
  setAdminSubPage
}) => {
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    action: () => Promise<void>;
    message: string;
  } | null>(null);
  const [startEventId, setStartEventId] = useState('');
  const [maxDriverUses, setMaxDriverUses] = useState(3);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  useEffect(() => {
    const fetchAllUsers = async () => {
      setIsLoadingUsers(true);
      try {
        // Fetch all users without pagination for this admin task
        const { users: fetchedUsers } = await getAllUsers(1000); 
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Failed to fetch users:", error);
        showToast("Failed to load users for challenge setup.", "error");
      } finally {
        setIsLoadingUsers(false);
      }
    };
    fetchAllUsers();
  }, [showToast]);

  // Eligible users: Dues Paid
  const eligibleUsers = useMemo(() => {
    return users.filter(u => u.duesPaidStatus === 'Paid');
  }, [users]);

  const handleStartChallenge = async () => {
    if (!startEventId) {
      showToast('Please select a starting race.', 'error');
      return;
    }
    if (eligibleUsers.length === 0) {
      showToast('No eligible users (dues paid) found.', 'error');
      return;
    }
    setConfirmAction({
      action: async () => {
        setIsProcessing(true);
        try {
          const participants = eligibleUsers.map(u => ({ uid: u.id, displayName: u.displayName }));
          await initializeSurvivalChallenge(startEventId, participants, maxDriverUses);
          showToast('Survival Challenge started successfully!', 'success');
        } catch (error) {
          console.error('Error starting challenge:', error);
          showToast('Failed to start challenge.', 'error');
        } finally {
          setIsProcessing(false);
        }
      },
      message: `Start challenge with ${eligibleUsers.length} participants starting at ${startEventId}?`
    });
  };

  const handleProcessRound = async () => {
    if (!survivalConfig || survivalConfig.status !== 'active') return;

    const currentEvent = events.find(e => e.id === survivalConfig.currentEventId);
    if (!currentEvent) {
      showToast('Current event not found.', 'error');
      return;
    }

    const result = raceResults[currentEvent.id];
    if (!result || !result.grandPrixFinish || result.grandPrixFinish.length === 0) {
      showToast(`No race results found for ${currentEvent.name}. Cannot process round.`, 'error');
      return;
    }

    setConfirmAction({
      action: async () => {
        setIsProcessing(true);
        try {
          const aliveStandings = survivalStandings.filter(s => s.status === 'alive');
          
          // Map picks to the format expected by processSurvivalRound
          const currentPicks: { [uid: string]: any } = {};
          aliveStandings.forEach(s => {
            const userPicks = survivalPicks[s.userId];
            currentPicks[s.userId] = userPicks ? userPicks[currentEvent.id] : undefined;
          });

          const roundResults = processSurvivalRound(aliveStandings, currentPicks, result, currentEvent.id);

          const updates: { uid: string; data: Partial<SurvivalStanding> }[] = [];
          let survivorsCount = 0;

          roundResults.forEach(res => {
            const standing = aliveStandings.find(s => s.userId === res.uid)!;
            
            if (res.survived) {
              survivorsCount++;
              const newUsage = { ...standing.driverUsage };
              if (res.driverId) {
                newUsage[res.driverId] = (newUsage[res.driverId] || 0) + 1;
              }
              updates.push({
                uid: res.uid,
                data: {
                  survivedRounds: standing.survivedRounds + 1,
                  driverUsage: newUsage,
                  lastPickDriverId: res.driverId,
                  lastPickPosition: res.finishPosition
                }
              });
            } else {
              updates.push({
                uid: res.uid,
                data: {
                  status: 'eliminated',
                  eliminatedAtEventId: currentEvent.id,
                  eliminatedReason: res.reason,
                  lastPickDriverId: res.driverId,
                  lastPickPosition: res.finishPosition
                }
              });
            }
          });

          await batchUpdateSurvivalStandings(updates);

          // Determine next state
          let nextStatus = survivalConfig.status;
          let winnerId = survivalConfig.winnerId;

          if (survivorsCount === 0) {
            // Mass elimination
            nextStatus = 'completed';
            showToast('All remaining users eliminated! Challenge over with no winner.', 'info');
          } else if (survivorsCount === 1) {
            // We have a winner
            nextStatus = 'completed';
            const winner = roundResults.find(r => r.survived);
            winnerId = winner?.uid;
            showToast('We have a winner! Challenge completed.', 'success');
          } else {
            // Multiple survivors, check if it was the last race
            const currentEventIndex = events.findIndex(e => e.id === currentEvent.id);
            if (currentEventIndex === events.length - 1) {
              // Last race, apply tiebreaker
              const sortedSurvivors = resolveTiebreaker(roundResults);
              nextStatus = 'completed';
              winnerId = sortedSurvivors[0]?.uid;
              showToast('Final race reached. Winner determined by tiebreaker!', 'success');
            } else {
              // Continue to next event
              showToast(`Round processed. ${survivorsCount} users survived.`, 'success');
            }
          }

          await saveSurvivalConfig({
            status: nextStatus,
            winnerId
          });

        } catch (error) {
          console.error('Error processing round:', error);
          showToast('Failed to process round.', 'error');
        } finally {
          setIsProcessing(false);
        }
      },
      message: `Process survival round for ${currentEvent.name}? This will eliminate users with incorrect picks.`
    });
  };

  const handleAdvanceEvent = async () => {
    if (!survivalConfig || survivalConfig.status !== 'active') return;
    
    const currentIndex = events.findIndex(e => e.id === survivalConfig.currentEventId);
    if (currentIndex === -1 || currentIndex === events.length - 1) {
      showToast('Cannot advance. Already at the last event.', 'error');
      return;
    }

    const nextEvent = events[currentIndex + 1];
    
    setConfirmAction({
      action: async () => {
        setIsProcessing(true);
        try {
          await saveSurvivalConfig({ currentEventId: nextEvent.id });
          showToast(`Advanced to ${nextEvent.name}`, 'success');
        } catch (error) {
          console.error('Error advancing event:', error);
          showToast('Failed to advance event.', 'error');
        } finally {
          setIsProcessing(false);
        }
      },
      message: `Advance challenge to ${nextEvent.name}?`
    });
  };

  const handleEndChallenge = async () => {
    setConfirmAction({
      action: async () => {
        setIsProcessing(true);
        try {
          await saveSurvivalConfig({ status: 'completed', winnerId: undefined });
          showToast('Challenge ended.', 'success');
        } catch (error) {
          console.error('Error ending challenge:', error);
          showToast('Failed to end challenge.', 'error');
        } finally {
          setIsProcessing(false);
        }
      },
      message: 'Are you sure you want to end the challenge with NO winner?'
    });
  };

  const handleResetChallenge = async () => {
    setConfirmAction({
      action: async () => {
        setIsProcessing(true);
        try {
          await saveSurvivalConfig({ status: 'pending', winnerId: undefined, lockedParticipants: [] });
          showToast('Challenge reset to pending.', 'success');
        } catch (error) {
          console.error('Error resetting challenge:', error);
          showToast('Failed to reset challenge.', 'error');
        } finally {
          setIsProcessing(false);
        }
      },
      message: 'Are you sure you want to reset? This will put the challenge back to pending state. Standings will NOT be deleted automatically.'
    });
  };

  if (isProcessing) {
    return <LoadingSkeleton />;
  }

  const aliveCount = survivalStandings.filter(s => s.status === 'alive').length;
  const eliminatedCount = survivalStandings.filter(s => s.status === 'eliminated').length;
  const currentEvent = events.find(e => e.id === survivalConfig?.currentEventId);

  return (
    <div className="pb-safe">
      <PageHeader 
        title="Manage Survival Challenge" 
        icon={TrophyIcon} 
        onBack={() => setAdminSubPage('dashboard')} 
      />

      <div className="p-4 space-y-6 max-w-3xl mx-auto">
        
        {/* Status Banner */}
        <div className="bg-carbon-fiber rounded-xl p-4 border border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white">Challenge Status</h2>
            <p className="text-sm text-gray-400">
              {survivalConfig ? survivalConfig.status.toUpperCase() : 'NOT CONFIGURED'}
            </p>
          </div>
          {survivalConfig?.status === 'active' && (
            <div className="text-right">
              <p className="text-sm text-gray-400">Current Round</p>
              <p className="font-bold text-white">{currentEvent?.name || 'Unknown'}</p>
            </div>
          )}
        </div>

        {/* Setup Section (Pending) */}
        {(!survivalConfig || survivalConfig.status === 'pending') && (
          <div className="bg-carbon-fiber rounded-xl p-6 border border-white/10 space-y-4">
            <h3 className="text-xl font-bold text-white border-b border-white/10 pb-2">Setup Challenge</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Start Race</label>
              <select 
                className="w-full bg-carbon-black border border-white/20 rounded-lg p-3 text-white"
                value={startEventId}
                onChange={(e) => setStartEventId(e.target.value)}
              >
                <option value="">Select a race...</option>
                {events.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Max Driver Uses</label>
              <input 
                type="number" 
                className="w-full bg-carbon-black border border-white/20 rounded-lg p-3 text-white"
                value={maxDriverUses}
                onChange={(e) => setMaxDriverUses(parseInt(e.target.value) || 3)}
                min="1"
                max="24"
              />
            </div>

            <div className="bg-carbon-black/50 p-4 rounded-lg border border-white/5">
              <p className="text-sm text-gray-300 mb-2">
                <strong>Eligible Users (Dues Paid):</strong> {eligibleUsers.length}
              </p>
              <p className="text-xs text-gray-500">
                Only users who have paid their dues will be included in the challenge. Once started, the roster is locked.
              </p>
            </div>

            <button 
              onClick={handleStartChallenge}
              disabled={!startEventId || eligibleUsers.length === 0}
              className="w-full bg-primary-red hover:bg-red-700 text-white font-bold rounded-lg px-6 py-3 disabled:opacity-50 transition-colors"
            >
              🏁 Start Challenge
            </button>
          </div>
        )}

        {/* Active Management Section */}
        {survivalConfig?.status === 'active' && (
          <div className="bg-carbon-fiber rounded-xl p-6 border border-white/10 space-y-6">
            <h3 className="text-xl font-bold text-white border-b border-white/10 pb-2">Active Management</h3>
            
            <div className="flex gap-4 mb-4">
              <div className="flex-1 bg-carbon-black/50 p-4 rounded-lg text-center border border-green-500/30">
                <p className="text-2xl font-bold text-green-400">{aliveCount}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Alive</p>
              </div>
              <div className="flex-1 bg-carbon-black/50 p-4 rounded-lg text-center border border-red-500/30">
                <p className="text-2xl font-bold text-red-400">{eliminatedCount}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Eliminated</p>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handleProcessRound}
                className="w-full bg-primary-red hover:bg-red-700 text-white font-bold rounded-lg px-6 py-3 transition-colors"
              >
                Process Round Results
              </button>
              <p className="text-xs text-gray-400 text-center">
                Evaluates picks against {currentEvent?.name} results and eliminates incorrect picks.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-3">
              <button 
                onClick={handleAdvanceEvent}
                className="w-full bg-carbon-black hover:bg-gray-800 border border-white/20 text-white font-bold rounded-lg px-6 py-3 transition-colors"
              >
                Advance to Next Event (Skip Processing)
              </button>
              
              <button 
                onClick={handleEndChallenge}
                className="w-full bg-carbon-black hover:bg-red-900/30 border border-red-500/30 text-red-400 font-bold rounded-lg px-6 py-3 transition-colors"
              >
                End Challenge (No Winner)
              </button>
            </div>
          </div>
        )}

        {/* Completed Section */}
        {survivalConfig?.status === 'completed' && (
          <div className="bg-carbon-fiber rounded-xl p-6 border border-white/10 space-y-4 text-center">
            <h3 className="text-xl font-bold text-white mb-4">Challenge Completed</h3>
            
            {survivalConfig.winnerId ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-6 rounded-lg mb-6">
                <TrophyIcon className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                <p className="text-sm text-yellow-500/80 uppercase tracking-wider mb-1">Winner</p>
                <p className="text-2xl font-bold text-white">
                  {users.find(u => u.id === survivalConfig.winnerId)?.displayName || 'Unknown User'}
                </p>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-lg mb-6">
                <p className="text-xl font-bold text-red-400">No Winner</p>
                <p className="text-sm text-gray-400 mt-2">All remaining participants were eliminated.</p>
              </div>
            )}

            <button 
              onClick={handleResetChallenge}
              className="w-full bg-carbon-black hover:bg-gray-800 border border-white/20 text-white font-bold rounded-lg px-6 py-3 transition-colors"
            >
              Reset Challenge for Next Season
            </button>
          </div>
        )}

        {/* Custom Confirmation Modal */}
        {confirmAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-accent-gray border border-primary-red/50 rounded-xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(218,41,28,0.2)] ring-1 ring-pure-white/10 animate-peek-up">
              <h2 className="text-xl font-bold text-pure-white mb-4">Confirm Action</h2>
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

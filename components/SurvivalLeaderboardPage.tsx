import React, { useState, useMemo } from 'react';
import { PageHeader } from './ui/PageHeader.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { SurvivalStanding, SurvivalPickDoc, Event, Driver } from '../types.ts';
import { SurvivalStatusBadge } from './SurvivalStatusBadge.tsx';

interface SurvivalLeaderboardPageProps {
  survivalStandings: SurvivalStanding[];
  survivalPicks: { [uid: string]: SurvivalPickDoc };
  events: Event[];
  allDrivers: Driver[];
  currentEventId?: string;
  onBack: () => void;
}

export const SurvivalLeaderboardPage: React.FC<SurvivalLeaderboardPageProps> = ({
  survivalStandings,
  survivalPicks,
  events,
  allDrivers,
  currentEventId,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'alive' | 'eliminated'>('alive');

  const aliveStandings = useMemo(() => {
    return survivalStandings
      .filter(s => s.status === 'alive')
      .sort((a, b) => {
        if (b.survivedRounds !== a.survivedRounds) {
          return b.survivedRounds - a.survivedRounds;
        }
        return a.displayName.localeCompare(b.displayName);
      });
  }, [survivalStandings]);

  const eliminatedStandings = useMemo(() => {
    return survivalStandings
      .filter(s => s.status === 'eliminated')
      .sort((a, b) => {
        if (b.survivedRounds !== a.survivedRounds) {
          return b.survivedRounds - a.survivedRounds;
        }
        return a.displayName.localeCompare(b.displayName);
      });
  }, [survivalStandings]);

  const getDriverName = (driverId?: string) => {
    if (!driverId) return 'None';
    return allDrivers.find(d => d.id === driverId)?.name || driverId;
  };

  const getEventName = (eventId?: string) => {
    if (!eventId) return 'Unknown';
    return events.find(e => e.id === eventId)?.name || eventId;
  };

  return (
    <div className="pb-safe">
      <PageHeader 
        title="Survival Standings" 
        icon={TrophyIcon} 
        leftAction={(
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10"
          >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold tracking-widest uppercase">Back</span>
          </button>
        )}
      />

      <div className="p-4 max-w-3xl mx-auto space-y-6">
        
        {/* Tab Toggle */}
        <div className="flex bg-carbon-black rounded-lg p-1 border border-white/10">
          <button
            onClick={() => setActiveTab('alive')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${
              activeTab === 'alive' 
                ? 'bg-carbon-fiber text-white shadow-sm' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🟢 Alive ({aliveStandings.length})
          </button>
          <button
            onClick={() => setActiveTab('eliminated')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${
              activeTab === 'eliminated' 
                ? 'bg-carbon-fiber text-white shadow-sm' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            💀 Eliminated ({eliminatedStandings.length})
          </button>
        </div>

        {/* Alive Section */}
        {activeTab === 'alive' && (
          <div className="space-y-3">
            {aliveStandings.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No one is alive. The challenge is over!</p>
              </div>
            ) : (
              aliveStandings.map((standing, index) => {
                const currentPick = currentEventId && survivalPicks[standing.userId] 
                  ? survivalPicks[standing.userId][currentEventId]?.driverId 
                  : null;

                return (
                  <div key={standing.userId} className="bg-carbon-fiber rounded-xl p-4 border border-green-500/30 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-8 text-center text-gray-400 font-bold">
                        {index + 1}.
                      </div>
                      <div>
                        <p className="font-bold text-white">{standing.displayName}</p>
                        <p className="text-xs text-gray-400">
                          Rounds Survived: <span className="text-white font-mono">{standing.survivedRounds}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {currentPick ? (
                        <>
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Pick</p>
                          <p className="font-bold text-white text-sm">{getDriverName(currentPick)}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Last Pick</p>
                          <p className="font-bold text-white text-sm">
                            {standing.lastPickDriverId ? getDriverName(standing.lastPickDriverId) : '--'}
                            {standing.lastPickPosition ? ` (P${standing.lastPickPosition})` : ''}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Eliminated Section */}
        {activeTab === 'eliminated' && (
          <div className="space-y-3">
            {eliminatedStandings.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No one has been eliminated yet.</p>
              </div>
            ) : (
              eliminatedStandings.map(standing => (
                <div key={standing.userId} className="bg-carbon-fiber rounded-xl p-4 border border-red-500/30 opacity-80 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <p className="font-bold text-white">{standing.displayName}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Eliminated: <span className="text-white">{getEventName(standing.eliminatedAtEventId)}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      Reason: <span className="text-red-400">{standing.eliminatedReason === 'missed_pick' ? 'Missed Pick' : 'Wrong Pick'}</span>
                    </p>
                  </div>
                  <div className="sm:text-right bg-carbon-black/50 p-3 rounded-lg border border-white/5">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Final Pick</p>
                    <p className="font-bold text-white text-sm">
                      {standing.lastPickDriverId ? getDriverName(standing.lastPickDriverId) : 'None'}
                      {standing.lastPickPosition ? ` (P${standing.lastPickPosition})` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Survived {standing.survivedRounds} rounds
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
};

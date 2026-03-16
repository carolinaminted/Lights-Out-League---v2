import React from 'react';

export const SurvivalStatusBadge: React.FC<{ status: 'alive' | 'eliminated' | 'pending' }> = ({ status }) => {
  const styles = {
    alive: 'bg-green-500/20 text-green-400 border-green-500/30',
    eliminated: 'bg-red-500/20 text-red-400 border-red-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };
  const labels = { alive: '🟢 ALIVE', eliminated: '💀 OUT', pending: '⏳ PENDING' };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-mono border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

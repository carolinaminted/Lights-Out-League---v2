import { SurvivalStanding, SurvivalPick, EventResult } from '../types.ts';

export interface SurvivalRoundResult {
  uid: string;
  survived: boolean;
  reason?: 'wrong_pick' | 'missed_pick';
  driverId?: string;
  finishPosition?: number;
}

/**
 * Determines if a driver podiumed (P1, P2, P3) in the GP race.
 * Returns the finish position (1-indexed) or null if not on podium.
 */
export const getDriverFinishPosition = (
  driverId: string,
  gpFinish: (string | null)[]
): number | null => {
  const index = gpFinish.indexOf(driverId);
  if (index === -1) return null;
  return index + 1; // Convert 0-indexed to 1-indexed position
};

/**
 * Process a single round of survival for all participants.
 * Returns per-user results.
 */
export const processSurvivalRound = (
  aliveStandings: SurvivalStanding[],
  picks: { [uid: string]: SurvivalPick | undefined },
  eventResult: EventResult,
  eventId: string
): SurvivalRoundResult[] => {
  const gpFinish = eventResult.grandPrixFinish || [];

  return aliveStandings.map(standing => {
    const pick = picks[standing.userId];

    // No pick submitted = eliminated
    if (!pick) {
      return {
        uid: standing.userId,
        survived: false,
        reason: 'missed_pick' as const
      };
    }

    const position = getDriverFinishPosition(pick.driverId, gpFinish);

    // Podium = P1, P2, P3 (positions 1, 2, 3)
    if (position !== null && position <= 3) {
      return {
        uid: standing.userId,
        survived: true,
        driverId: pick.driverId,
        finishPosition: position
      };
    }

    // Not on podium = eliminated
    return {
      uid: standing.userId,
      survived: false,
      reason: 'wrong_pick' as const,
      driverId: pick.driverId,
      finishPosition: position // could be null if DNF
    };
  });
};

/**
 * Validates a survival pick submission.
 * Returns error message or null if valid.
 */
export const validateSurvivalPick = (
  driverId: string,
  driverUsage: { [driverId: string]: number },
  maxUses: number,
  activeDriverIds: string[]
): string | null => {
  if (!driverId) return 'No driver selected.';
  if (!activeDriverIds.includes(driverId)) return 'Selected driver is not active.';

  const currentUsage = driverUsage[driverId] || 0;
  if (currentUsage >= maxUses) {
    return `You have already used this driver ${maxUses} times this season.`;
  }

  return null; // Valid
};

/**
 * Tiebreaker: If multiple users survive to the final race,
 * the user whose driver finished highest wins.
 * Returns sorted array (winner first).
 */
export const resolveTiebreaker = (
  survivors: SurvivalRoundResult[]
): SurvivalRoundResult[] => {
  return [...survivors]
    .filter(s => s.survived)
    .sort((a, b) => {
      // Lower position number = higher finish = wins
      const posA = a.finishPosition ?? 999;
      const posB = b.finishPosition ?? 999;
      return posA - posB;
    });
};

export const BASE_POINTS = 5;
export const BONUS_POINTS = 10;
export const MAJORITY_THRESHOLD = 3;

export interface BonusResult {
  awarded: number;
  multiplier: number | null;
}

// Pure majority/bonus rule. `votes` is every existing vote (booleans) for a
// trip+type INCLUDING the current user's just-recorded vote; `vote` is the
// current user's vote. Returns total points awarded (base + any bonus) and the
// bonus multiplier (or null when no bonus).
export function computeBonus(votes: boolean[], vote: boolean): BonusResult {
  let awarded = BASE_POINTS;
  let multiplier: number | null = null;
  if (votes.length >= MAJORITY_THRESHOLD) {
    const upVotes = votes.filter((v) => v).length;
    const majority = upVotes > votes.length / 2;
    if (vote === majority) {
      awarded += BONUS_POINTS;
      multiplier = 3;
    }
  }
  return { awarded, multiplier };
}

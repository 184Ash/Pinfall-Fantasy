// src/scoringEngine.js
// Pure function — no API calls, no Supabase.
// Input:  matches object (keyed by UUID) from getBracket()
//         placements array from getPlacements()
// Output: { participantId: totalPts }

// ── Win-type bonus points ─────────────────────────────────────────────────────
const BONUS_POINTS = {
  F:   2.0,  // Fall
  TF:  1.5,  // Technical fall
  MD:  1.0,  // Major decision
  DEC: 0.0,  // Decision
  FOR: 2.0,  // Forfeit
  DEF: 2.0,  // Default
  DQ:  2.0,  // Disqualification
  FM:  2.0,  // Flagrant misconduct
  MFF: 0.0,  // Medical forfeit (no bonus)
};

// ── Placement points ──────────────────────────────────────────────────────────
// Added once when FloArena officially records the placement.
// These are flat values — NOT cumulative with each other.
const PLACEMENT_POINTS = {
  1: 16, 2: 12, 3: 10, 4: 9, 5: 7, 6: 6, 7: 4, 8: 3,
};

const PLACE_TO_NUM = {
  '1st': 1, '2nd': 2, '3rd': 3, '4th': 4,
  '5th': 5, '6th': 6, '7th': 7, '8th': 8,
};

/**
 * Score one weight class.
 *
 * Bracket side (champ vs cons) is derived from win/loss record — NOT from
 * FloArena's roundName, which is null for most matches.
 *
 * Matches are processed in matchNumber order so loss counts are accurate
 * before each match is scored:
 *   - Both participants have 0 prior losses → championship match → winner gets 1pt
 *   - Either participant has 1+ prior loss  → consolation match  → winner gets 0.5pt
 *
 * Total = advancement (1 or 0.5 per win) + bonus (fall=2, TF=1.5, MD=1) + placement pts.
 *
 * @param {Object} matches    - keyed by match UUID, from getBracket()
 * @param {Array}  placements - array of { place, participantId, name, teamName }
 * @returns {Object} { participantId: totalPts }
 */
export function scoreWeightClass(matches, placements) {
  const pts      = {};
  const lossCount = {}; // id → cumulative losses (updated as matches are processed)

  const add = (id, amount) => {
    if (!id) return;
    pts[id] = (pts[id] ?? 0) + amount;
  };

  // Sort completed matches in bracket order so earlier rounds are processed first
  const completed = Object.values(matches)
    .filter(m => m.state === 'completed' && m.topParticipant?.id && m.bottomParticipant?.id)
    .sort((a, b) => (a.matchNumber ?? a.x ?? 0) - (b.matchNumber ?? b.x ?? 0));

  for (const match of completed) {
    const top = match.topParticipant;
    const bot = match.bottomParticipant;

    const winner = top.winner ? top : bot.winner ? bot : null;
    const loser  = top.winner ? bot : bot.winner ? top : null;
    if (!winner || !loser) continue;

    // Determine bracket side from prior loss counts
    const topPriorLosses = lossCount[top.id] ?? 0;
    const botPriorLosses = lossCount[bot.id] ?? 0;
    const isCons         = topPriorLosses > 0 || botPriorLosses > 0;
    const advancement    = isCons ? 0.5 : 1.0;

    add(winner.id, advancement);
    add(winner.id, BONUS_POINTS[match.winType] ?? 0);

    // Record the loss AFTER scoring so this match is correctly classified
    lossCount[loser.id] = (lossCount[loser.id] ?? 0) + 1;
  }

  // Placement pts added once when FloArena records official placement
  for (const { place, participantId } of placements) {
    if (!participantId) continue;
    const placeNum = typeof place === 'number'
      ? place
      : (PLACE_TO_NUM[place] ?? parseInt(place, 10));
    add(participantId, PLACEMENT_POINTS[placeNum] ?? 0);
  }

  return pts;
}

/**
 * Score all weight classes and merge into one map.
 * @param {Object} allBrackets   - { 125: matchesObj, 133: matchesObj, ... }
 * @param {Object} allPlacements - { 125: [...], 133: [...], ... }
 * @returns {Object} { participantId: totalPts } across all weights
 */
export function scoreAllWeights(allBrackets, allPlacements) {
  const totals = {};

  for (const weight of Object.keys(allBrackets)) {
    const weightPts = scoreWeightClass(
      allBrackets[weight] ?? {},
      allPlacements[weight] ?? []
    );
    for (const [id, p] of Object.entries(weightPts)) {
      totals[id] = (totals[id] ?? 0) + p;
    }
  }

  return totals;
}

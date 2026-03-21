// src/scoringEngine.js
// Pure function — no API calls, no Supabase.
// Input:  matches object (keyed by UUID) from getBracket()
//         placements array from getPlacements()
// Output: { participantId: totalPts }

// ── Win-type bonus points (per NCAA team scoring rules) ───────────────────────
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

// ── Placement points (incremental, not cumulative) ────────────────────────────
const PLACEMENT_POINTS = {
  1: 16,
  2: 12,
  3: 10,
  4:  9,
  5:  7,
  6:  6,
  7:  4,
  8:  3,
};

// FloArena may return ordinal strings or numeric values for placement
const PLACE_TO_NUM = {
  '1st': 1, '2nd': 2, '3rd': 3, '4th': 4,
  '5th': 5, '6th': 6, '7th': 7, '8th': 8,
};


/**
 * Score one weight class.
 * @param {Object} matches    - keyed by match UUID, from getBracket()
 * @param {Array}  placements - array of { place, participantId, name, teamName }
 * @returns {Object} { participantId: totalPts }
 */
export function scoreWeightClass(matches, placements) {
  const pts = {};

  const add = (id, amount) => {
    if (!id) return;
    pts[id] = (pts[id] ?? 0) + amount;
  };

  for (const match of Object.values(matches)) {
    // Only score completed bouts
    if (match.state !== 'completed') continue;

    const top = match.topParticipant;
    const bot = match.bottomParticipant;

    // Bye: one participant slot is missing/null — 0 points (per spec)
    if (!top || !bot) continue;

    // Find winner
    const winner = top.winner ? top : bot.winner ? bot : null;
    if (!winner) continue;

    // Bonus points based on win type (fall, TF, MD, forfeit, etc.)
    // Placement points come from the placements endpoint — NOT cumulative with per-win advancement.
    // Each wrestler's final score = PLACEMENT_POINTS[place] + sum of bonus pts.
    const bonus = BONUS_POINTS[match.winType] ?? 0.0;
    add(winner.id, bonus);
  }

  // ── Placement points come entirely from the placements endpoint ───────────
  for (const { place, participantId } of placements) {
    const placeNum =
      typeof place === 'number'
        ? place
        : PLACE_TO_NUM[place] ?? parseInt(place, 10);
    const placePts = PLACEMENT_POINTS[placeNum] ?? 0;
    add(participantId, placePts);
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

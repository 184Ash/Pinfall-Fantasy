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

// ── Advancement points by bracket side ───────────────────────────────────────
// 1pt per championship bracket win, 0.5pt per consolation bracket win.
// Placement matches (3rd/5th/7th) award 0 advancement (they use placement pts).
const ADVANCEMENT_POINTS = {
  championship: 1.0,
  consolation:  0.5,
  placement:    0.0,
};

/**
 * Classify a match as 'championship', 'consolation', or 'placement'.
 */
function getMatchCategory(match) {
  const mt = (
    match.matchType         ||
    match.params?.matchType ||
    match.bracket_type      ||
    ''
  ).toLowerCase();

  if (mt === 'placement' || mt === 'consolation_placement') return 'placement';
  if (mt === 'consolation' || mt === 'consi')               return 'consolation';
  if (mt === 'championship' || mt === 'champ')              return 'championship';

  const rn = (
    match.roundName         ||
    match.params?.roundName ||
    match.round?.name       ||
    match.round_name        ||
    ''
  ).toLowerCase();

  if (rn.includes('place') || rn.includes('3rd') || rn.includes('5th') || rn.includes('7th')) {
    return 'placement';
  }
  if (rn.includes('consolation') || rn.includes('consi') || rn.includes('cons')) {
    return 'consolation';
  }

  return 'championship';
}

/**
 * Score one weight class.
 *
 * Total = advancement pts (per win) + bonus pts (per win type) + placement pts (when placed).
 * Example: QF winner with 2 falls = 2 advancement + 4 bonus = 6pts live,
 *          then placement pts added on top when the tournament ends.
 *
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
    if (match.state !== 'completed') continue;

    const top = match.topParticipant;
    const bot = match.bottomParticipant;
    if (!top?.id || !bot?.id) continue;

    const winner = top.winner ? top : bot.winner ? bot : null;
    if (!winner) continue;

    // Advancement: 1pt (champ) or 0.5pt (cons) per win
    const category   = getMatchCategory(match);
    const advancement = ADVANCEMENT_POINTS[category] ?? 1.0;
    add(winner.id, advancement);

    // Bonus: fall=2, TF=1.5, MD=1, decision=0
    const bonus = BONUS_POINTS[match.winType] ?? 0.0;
    add(winner.id, bonus);
  }

  // Placement pts added once when FloArena records official placement
  for (const { place, participantId } of placements) {
    if (!participantId) continue;
    const placeNum = typeof place === 'number'
      ? place
      : (PLACE_TO_NUM[place] ?? parseInt(place, 10));
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

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

// ── Final placement points ────────────────────────────────────────────────────
const PLACEMENT_POINTS = {
  1: 16, 2: 12, 3: 10, 4: 9, 5: 7, 6: 6, 7: 4, 8: 3,
};

const PLACE_TO_NUM = {
  '1st': 1, '2nd': 2, '3rd': 3, '4th': 4,
  '5th': 5, '6th': 6, '7th': 7, '8th': 8,
};

// ── Live milestone points (non-cumulative — replaces previous value) ──────────
// Score updates immediately after each match. Bonus pts stack on top.
// Championship bracket (0 losses):
//   1 win  → 0  pts (not yet guaranteed placement)
//   2 wins → 6  pts (won QF, in SF)
//   3 wins → 12 pts (won SF, guaranteed finalist)
//   4 wins → 16 pts (Champion)
// Consolation bracket (1 loss):
//   1 win  → 3  pts (blood round win, guaranteed 8th)
//   2 wins → 4  pts
//   3 wins → 6  pts
//   4 wins → 7  pts
//   5 wins → 9  pts (guaranteed top 4)
function getMilestone(wins, losses) {
  if (losses === 0) {
    if (wins >= 4) return 16;
    if (wins === 3) return 12;
    if (wins === 2) return 6;
    return 0;
  }
  if (losses === 1) {
    if (wins >= 5) return 9;
    if (wins === 4) return 7;
    if (wins === 3) return 6;
    if (wins === 2) return 4;
    if (wins === 1) return 3;
  }
  return 0;
}

/**
 * Score one weight class with live milestone scoring.
 *
 * Score = milestone(wins, losses) + Σ bonus_pts_per_win
 * When officially placed: score = PLACEMENT_POINTS[place] + Σ bonus_pts
 *
 * @param {Object} matches    - keyed by match UUID, from getBracket()
 * @param {Array}  placements - array of { place, participantId, name, teamName }
 * @returns {Object} { participantId: totalPts }
 */
export function scoreWeightClass(matches, placements) {
  const winsMap  = {}; // id → wins
  const lossMap  = {}; // id → losses
  const bonusMap = {}; // id → cumulative bonus pts

  const ensure = (id) => {
    if (winsMap[id]  === undefined) winsMap[id]  = 0;
    if (lossMap[id]  === undefined) lossMap[id]  = 0;
    if (bonusMap[id] === undefined) bonusMap[id] = 0;
  };

  for (const match of Object.values(matches)) {
    if (match.state !== 'completed') continue;
    const top = match.topParticipant;
    const bot = match.bottomParticipant;
    if (!top?.id || !bot?.id) continue;

    ensure(top.id); ensure(bot.id);

    const winner = top.winner ? top : bot.winner ? bot : null;
    const loser  = top.winner ? bot : bot.winner ? top : null;
    if (!winner || !loser) continue;

    winsMap[winner.id]++;
    lossMap[loser.id]++;
    bonusMap[winner.id] += BONUS_POINTS[match.winType] ?? 0;
  }

  const pts = {};

  // ── Officially placed wrestlers ───────────────────────────────────────────
  const placedIds = new Set();
  for (const { place, participantId } of placements) {
    if (!participantId) continue;
    const placeNum = typeof place === 'number'
      ? place
      : (PLACE_TO_NUM[place] ?? parseInt(place, 10));
    const placePts = PLACEMENT_POINTS[placeNum] ?? 0;
    ensure(participantId);
    pts[participantId] = placePts + bonusMap[participantId];
    placedIds.add(participantId);
  }

  // ── In-progress wrestlers: live milestone ─────────────────────────────────
  for (const id of new Set([...Object.keys(winsMap), ...Object.keys(lossMap)])) {
    if (placedIds.has(id)) continue;
    const w = winsMap[id]  ?? 0;
    const l = lossMap[id]  ?? 0;
    const m = getMilestone(w, l);
    pts[id] = m > 0 ? m + (bonusMap[id] ?? 0) : 0;
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

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
const PLACEMENT_POINTS = {
  1: 16, 2: 12, 3: 10, 4: 9, 5: 7, 6: 6, 7: 4, 8: 3,
};

const PLACE_TO_NUM = {
  '1st': 1, '2nd': 2, '3rd': 3, '4th': 4,
  '5th': 5, '6th': 6, '7th': 7, '8th': 8,
};

/**
 * Returns guaranteed minimum placement points for a wrestler's current
 * bracket position (before official placement is recorded by FloArena).
 *
 * Champ bracket (0 losses):
 *   wins=3 (won QF, in SF)     → guaranteed 4th min  = 9pts
 *   wins=4 (won SF, in Finals) → guaranteed 2nd min  = 12pts
 *   wins<3                     → not guaranteed (blood round risk)
 *
 * Cons bracket (1 loss):
 *   wins=1  blood round win    → guaranteed 8th = 3pts
 *   wins=2  Cons R2 win        → guaranteed 7th = 4pts
 *   wins=3  Cons R3 win        → guaranteed 6th = 6pts
 *   wins=4  Cons R4 win        → guaranteed 5th = 7pts
 *   wins=5  Cons SF win        → guaranteed 4th = 9pts (in 3rd place match)
 */
function getLiveGuaranteedPlacement(wins, losses) {
  if (losses >= 2) return 0; // Eliminated

  if (losses === 0) {
    // Championship bracket
    if (wins >= 4) return PLACEMENT_POINTS[2]; // In Finals → guaranteed 2nd
    if (wins === 3) return PLACEMENT_POINTS[4]; // In Champ SF → guaranteed 4th
    return 0; // wins < 3: blood round risk if they lose, not guaranteed
  }

  if (losses === 1) {
    // Consolation bracket
    if (wins >= 5) return PLACEMENT_POINTS[4]; // In 3rd place match → guaranteed 4th
    if (wins === 4) return PLACEMENT_POINTS[5]; // Cons SF → guaranteed 5th
    if (wins === 3) return PLACEMENT_POINTS[6]; // Cons R4 → guaranteed 6th
    if (wins === 2) return PLACEMENT_POINTS[7]; // Cons R3 → guaranteed 7th
    if (wins === 1) return PLACEMENT_POINTS[8]; // Blood round win → guaranteed 8th
    return 0;
  }

  return 0;
}

/**
 * Score one weight class.
 *
 * Scoring formula:
 *   total = wins × 1pt (all brackets)
 *         + bonus pts per win (fall=2, TF=1.5, MD=1)
 *         + live guaranteed placement pts (based on bracket position)
 *         + official placement pts (replaces live pts when FloArena records result)
 *
 * Example — Josh Barr (197lb, in Finals, 4 champ wins, 2 TF + 2 MD bonus):
 *   4 × 1pt + (2×1.5 + 2×1.0) + 12 (guaranteed 2nd) = 4 + 5 + 12 = 21pts
 *
 * Bracket side (champ vs cons) is derived from win/loss record so matches are
 * processed in matchNumber order — NOT relying on FloArena's roundName field
 * (which is null for most matches).
 *
 * @param {Object} matches    - keyed by match UUID, from getBracket()
 * @param {Array}  placements - array of { place, participantId, name, teamName }
 * @returns {Object} { participantId: totalPts }
 */
export function scoreWeightClass(matches, placements) {
  const pts           = {};
  const winCount      = {}; // id → total wins (for live placement lookup)
  const lossCount     = {}; // id → total losses (for live placement lookup)
  // Track each participant's last match result so we can correct placement-match
  // double-counting: when a wrestler WINS their final placement match (1st/3rd/5th/7th),
  // that win earns advancement pts AND placement pts — subtract the advancement to avoid
  // double-counting (placement pts already reflect the full value of that win).
  const lastMatchResult = {}; // id → { won: bool, advancement: float }

  const add = (id, amount) => {
    if (!id || !amount) return;
    pts[id] = (pts[id] ?? 0) + amount;
  };

  // Sort completed matches in bracket order so loss counts are accurate
  const completed = Object.values(matches)
    .filter(m => m.state === 'completed' && m.topParticipant?.id && m.bottomParticipant?.id)
    .sort((a, b) => (a.matchNumber ?? a.x ?? 0) - (b.matchNumber ?? b.x ?? 0));

  for (const match of completed) {
    const top = match.topParticipant;
    const bot = match.bottomParticipant;

    const winner = top.winner ? top : bot.winner ? bot : null;
    const loser  = top.winner ? bot : bot.winner ? top : null;
    if (!winner || !loser) continue;

    // Advancement: 1pt for champ bracket win, 0.5pt for consolation win
    const topPriorLoss = lossCount[top.id] ?? 0;
    const botPriorLoss = lossCount[bot.id] ?? 0;
    const isCons       = topPriorLoss > 0 || botPriorLoss > 0;
    const advancement  = isCons ? 0.5 : 1.0;
    add(winner.id, advancement);
    // Bonus for win type
    add(winner.id, BONUS_POINTS[match.winType] ?? 0);

    // Track last match result for both participants (used for placement correction below)
    lastMatchResult[winner.id] = { won: true,  advancement };
    lastMatchResult[loser.id]  = { won: false, advancement };

    winCount[winner.id]  = (winCount[winner.id]  ?? 0) + 1;
    lossCount[loser.id]  = (lossCount[loser.id]  ?? 0) + 1;
  }

  // Official placement pts (added when FloArena records the final result).
  // For wrestlers who WON their placement match (1st/3rd/5th/7th), subtract
  // the advancement already awarded for that win — placement pts cover its value.
  const placedIds = new Set();
  for (const { place, participantId } of placements) {
    if (!participantId) continue;
    const placeNum = typeof place === 'number'
      ? place
      : (PLACE_TO_NUM[place] ?? parseInt(place, 10));
    add(participantId, PLACEMENT_POINTS[placeNum] ?? 0);
    placedIds.add(participantId);
    // Subtract placement-match win advancement to avoid double-counting
    const last = lastMatchResult[participantId];
    if (last?.won) {
      pts[participantId] = (pts[participantId] ?? 0) - last.advancement;
    }
  }

  // Live guaranteed placement for non-officially-placed wrestlers
  const allIds = new Set([...Object.keys(winCount), ...Object.keys(lossCount)]);
  for (const id of allIds) {
    if (placedIds.has(id)) continue; // official placement already applied
    const w = winCount[id]  ?? 0;
    const l = lossCount[id] ?? 0;
    add(id, getLiveGuaranteedPlacement(w, l));
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

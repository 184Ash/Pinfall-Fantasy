// src/scoringEngine.js
// Pure function — no API calls, no Supabase.
// Input:  matches object (keyed by UUID) from getBracket()
//         placements array from getPlacements()
// Output: { participantId: totalPts }

const BONUS_POINTS = {
  F:   2.0,
  TF:  1.5,
  MD:  1.0,
  DEC: 0.0,
  FOR: 0.0, // forfeit — advancement only, no bonus
  MFF: 0.0, // medical forfeit — advancement only, no bonus
};

const PLACEMENT_POINTS = {
  '1st': 4.0,
  '2nd': 3.0,
  '3rd': 2.0,
  '4th': 1.5,
  '5th': 1.0,
  '6th': 0.5,
  '7th': 0.5,
  '8th': 0.0,
};

/**
 * Score one weight class.
 * @param {Object} matches - keyed by match UUID, from getBracket()
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

    // Detect bye: one participant slot is missing/null
    if (!top || !bot) {
      const present = top || bot;
      if (present) add(present.id, 0.5); // bye = 0.5 advancement
      continue;
    }

    // Find winner
    const winner = top.winner ? top : bot.winner ? bot : null;
    if (!winner) continue; // no winner yet, skip

    // Advancement point
    add(winner.id, 1.0);

    // Bonus points based on winType
    const bonus = BONUS_POINTS[match.winType] ?? 0.0;
    add(winner.id, bonus);
  }

  // Add placement points
  for (const { place, participantId } of placements) {
    const placePts = PLACEMENT_POINTS[place] ?? 0.0;
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
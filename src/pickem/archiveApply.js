// ─── ARCHIVE PULL PLANNING ────────────────────────────────────────────────────
// Pure logic for the "pull known results" button: given a pool's dual (with
// its matches) and the global archive row for the same real-world dual
// (pickem_dual_results, keyed by source_dual_id), compute the updates to
// apply locally.
//
// Semantics are FILL-THE-BLANKS: nothing a commissioner already entered is
// ever overwritten — the dual winner, team scores, per-bout winners/win types
// and expected-lineup names each apply only where the local value is empty.
// Kept free of Supabase imports so it is unit-testable with plain node.

export function planArchivePull(dual, archived) {
  if (!archived?.winner) return null

  const dualFields = {}
  if (dual.winner == null) dualFields.winner = archived.winner
  if (dual.home_score == null && archived.home_score != null) dualFields.home_score = archived.home_score
  if (dual.away_score == null && archived.away_score != null) dualFields.away_score = archived.away_score

  const byWeight = new Map((archived.bouts_json || []).map(b => [b.weight, b]))
  const matchUpdates = []
  for (const mt of dual.matches || []) {
    const bout = byWeight.get(mt.weight)
    if (!bout) continue
    const fields = {}
    if (mt.winner == null && bout.winner) fields.winner = bout.winner
    if (!mt.win_type && bout.win_type) fields.win_type = bout.win_type
    if (!mt.home_wrestler && bout.home_wrestler) fields.home_wrestler = bout.home_wrestler
    if (!mt.away_wrestler && bout.away_wrestler) fields.away_wrestler = bout.away_wrestler
    if (Object.keys(fields).length > 0) matchUpdates.push({ matchId: mt.id, fields })
  }

  if (Object.keys(dualFields).length === 0 && matchUpdates.length === 0) return null
  return { dualFields, matchUpdates }
}

/** True when the archive knows something this dual hasn't recorded yet. */
export function hasPullableResult(dual, archived) {
  return planArchivePull(dual, archived) !== null
}

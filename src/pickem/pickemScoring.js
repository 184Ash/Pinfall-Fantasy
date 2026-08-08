// src/pickem/pickemScoring.js
// Pure scoring functions — all data is small (a pool has tens of members and
// a season of weekly events), so standings are computed client-side.
import { DEFAULT_SCORING } from './pickemConstants'

// events: [{ id, status, pick_mode, duals: [{ id, winner, matches: [{ id, winner }] }] }]
// picks:  [{ member_id, match_id, dual_id, pick }]
// Only events with status 'final' count toward standings.
export function computeStandings(members, events, picks, scoring = DEFAULT_SCORING) {
  const cfg = { ...DEFAULT_SCORING, ...scoring }

  // Index picks by member for fast lookup
  const picksByMember = {}
  picks.forEach(p => {
    if (!picksByMember[p.member_id]) picksByMember[p.member_id] = { byMatch: {}, byDual: {} }
    if (p.match_id) picksByMember[p.member_id].byMatch[p.match_id] = p.pick
    if (p.dual_id) picksByMember[p.member_id].byDual[p.dual_id] = p.pick
  })

  const rows = members.map(m => {
    const mine = picksByMember[m.id] || { byMatch: {}, byDual: {} }
    let points = 0, correct = 0, total = 0, perfectCards = 0

    events.filter(e => e.status === 'final').forEach(ev => {
      ev.duals.forEach(dual => {
        if (ev.pick_mode === 'matches') {
          const decided = (dual.matches || []).filter(mt => mt.winner)
          let dualCorrect = 0
          decided.forEach(mt => {
            total++
            if (mine.byMatch[mt.id] === mt.winner) {
              points += cfg.matchWin
              correct++
              dualCorrect++
            }
          })
          // Perfect card = every decided match picked correctly, min 10 bouts
          if (decided.length >= 10 && dualCorrect === decided.length) {
            points += cfg.perfectCard
            perfectCards++
          }
        } else {
          if (!dual.winner || dual.winner === 'tie') return
          total++
          if (mine.byDual[dual.id] === dual.winner) {
            points += cfg.dualWin
            correct++
          }
        }
      })
    })

    return { member: m, points, correct, total, perfectCards }
  })

  return rows.sort((a, b) =>
    b.points - a.points || b.correct - a.correct || a.member.name.localeCompare(b.member.name))
}

// Per-event breakdown for a single member — used on the results view.
export function scoreEventForMember(event, memberPicks, scoring = DEFAULT_SCORING) {
  const cfg = { ...DEFAULT_SCORING, ...scoring }
  let points = 0, correct = 0, total = 0

  event.duals.forEach(dual => {
    if (event.pick_mode === 'matches') {
      const decided = (dual.matches || []).filter(mt => mt.winner)
      let dualCorrect = 0
      decided.forEach(mt => {
        total++
        if (memberPicks.byMatch?.[mt.id] === mt.winner) {
          points += cfg.matchWin
          correct++
          dualCorrect++
        }
      })
      if (decided.length >= 10 && dualCorrect === decided.length) points += cfg.perfectCard
    } else {
      if (!dual.winner || dual.winner === 'tie') return
      total++
      if (memberPicks.byDual?.[dual.id] === dual.winner) {
        points += cfg.dualWin
        correct++
      }
    }
  })

  return { points, correct, total }
}

// Has this event's pick window closed?
export function isEventLocked(event) {
  if (event.status === 'locked' || event.status === 'final') return true
  if (event.lock_at && new Date(event.lock_at).getTime() <= Date.now()) return true
  return false
}

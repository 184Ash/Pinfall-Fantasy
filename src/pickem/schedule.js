// ─── SCHEDULE DATASET ACCESS ──────────────────────────────────────────────────
// Wraps src/pickem/data/ncaa-d1-duals-2026-27.json (canonical 2026-27
// in-conference dual map — see docs/dual-schedule-scale.md). The JSON is
// ~108 KB, so it is loaded with a dynamic import the first time the slate
// builder opens rather than shipped in the main bundle.
//
// Dataset caveats that shape this module (as of the Aug 2026 build):
//   - Only ~28 of 282 duals have a published date. `week` is the dataset's
//     best placement on the shared WEEK_AXIS and is NULL for every Big Ten
//     dual (dates due Sept 2026) — those surface via unscheduledDuals().
//   - 15 MAC rows are matrix completions flagged probability:'unlikely';
//     they are excluded everywhere.
//   - status:'confirmed' + a date means a real announced dual; everything
//     else is projected and the UI must say so.

import { CONFERENCE_BY_ID, WEEK_AXIS, BOUTS_PER_DUAL, bandFor } from './conferences';

let cache = null;

export async function loadSchedule() {
  if (cache) return cache;
  const mod = await import('./data/ncaa-d1-duals-2026-27.json');
  const data = mod.default ?? mod;
  const teamById = Object.fromEntries(data.teams.map(t => [t.id, t]));
  // Drop the unlikely MAC matrix-completions once, up front.
  const duals = data.duals.filter(d => d.probability !== 'unlikely');
  cache = { ...data, teamById, duals };
  return cache;
}

export function teamName(schedule, teamId) {
  return schedule.teamById[teamId]?.name || teamId;
}

// ─── TEAM SCOPE ───────────────────────────────────────────────────────────────
// teamScope is settings_json.teamScope: { [conferenceId]: [teamId, ...] }.
// A conference with no entry follows ALL its teams. A dual stays in scope when
// it features at least one followed team — unfollowing Maryland never hides an
// Iowa-at-Maryland dual from an Iowa fan; what disappears are duals between
// two unfollowed teams.

export function teamsForConference(schedule, conferenceId) {
  return schedule.teams
    .filter(t => t.conference === conferenceId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function dualInTeamScope(dual, teamScope) {
  const followed = teamScope?.[dual.conference];
  if (!followed) return true;
  return followed.includes(dual.home) || followed.includes(dual.away);
}

/** Per-conference { kept, total } dual counts under the current team scope. */
export function keptDualStats(schedule, conferenceIds, teamScope) {
  const stats = Object.fromEntries(conferenceIds.map(id => [id, { kept: 0, total: 0 }]));
  schedule.duals.forEach(d => {
    const s = stats[d.conference];
    if (!s) return;
    s.total++;
    if (dualInTeamScope(d, teamScope)) s.kept++;
  });
  return stats;
}

// Mirrors conferences.js summarizeSelection() but scales each conference's
// weeklyDuals histogram by its kept-dual fraction. That keeps the numbers
// honest for team-filtered selections even where individual duals carry no
// week yet (all of the Big Ten until the Sept release) — the trim is applied
// proportionally, which is why callers should present these as ~estimates.
const PEAK_RANGE = ['2027-W01', '2027-W07']; // same peak window as conferences.js
export function summarizeScopedSelection(schedule, conferenceIds, teamScope, pickMode = 'duals') {
  const picked = conferenceIds.map(id => CONFERENCE_BY_ID[id]).filter(Boolean);
  const per = pickMode === 'matches' ? BOUTS_PER_DUAL : 1;
  if (!picked.length) {
    return { conferences: 0, teams: 0, duals: 0, bouts: 0, weeks: 0,
             typicalPerWeek: 0, peakPerWeek: 0, peakWeek: null,
             picksTypical: 0, picksPeak: 0, picksSeason: 0, band: bandFor(0), filtered: false };
  }

  const stats = keptDualStats(schedule, conferenceIds, teamScope);
  const fraction = (c) => {
    const s = stats[c.id];
    return s && s.total > 0 ? s.kept / s.total : 1;
  };

  const weekly = WEEK_AXIS.map((_, i) =>
    picked.reduce((sum, c) => sum + c.weeklyDuals[i] * fraction(c), 0));
  const duals = picked.reduce((s, c) => s + (stats[c.id]?.kept ?? c.dualCount), 0);
  const teams = picked.reduce((s, c) =>
    s + (teamScope?.[c.id] ? teamScope[c.id].length : c.teamCount), 0);
  const peak = Math.max(...weekly);
  const peakIdx = WEEK_AXIS
    .map((w, i) => (w.tag >= PEAK_RANGE[0] && w.tag <= PEAK_RANGE[1] ? i : -1))
    .filter(i => i >= 0);
  const busy = peakIdx.filter(i => weekly[i] > 0);
  const typical = busy.length ? busy.reduce((s, i) => s + weekly[i], 0) / busy.length : 0;
  const filtered = picked.some(c => teamScope?.[c.id]);

  return {
    conferences: picked.length,
    teams,
    duals,
    bouts: duals * BOUTS_PER_DUAL,
    weeks: weekly.filter(w => w >= 0.5).length,
    weekly,
    typicalPerWeek: Math.round(typical * 10) / 10,
    peakPerWeek: Math.round(peak),
    peakWeek: peak > 0 ? WEEK_AXIS[weekly.indexOf(peak)].tag : null,
    picksTypical: Math.round(typical * per),
    picksPeak: Math.round(peak * per),
    picksSeason: duals * per,
    band: bandFor(Math.round(typical * per)),
    filtered,
  };
}

// ─── SLATE QUERIES ────────────────────────────────────────────────────────────

/** Scheduled duals for one ISO-week tag, limited to the pool's conference + team scope. */
export function dualsForWeek(schedule, weekTag, conferenceIds, teamScope = null) {
  const scope = new Set(conferenceIds);
  return schedule.duals
    .filter(d => d.week === weekTag && scope.has(d.conference) && dualInTeamScope(d, teamScope))
    .sort((a, b) => a.conference.localeCompare(b.conference) || a.id.localeCompare(b.id));
}

/** In-scope duals the dataset couldn't place on a week yet (Big Ten, mostly). */
export function unscheduledDuals(schedule, conferenceIds, teamScope = null) {
  const scope = new Set(conferenceIds);
  return schedule.duals
    .filter(d => !d.week && scope.has(d.conference) && dualInTeamScope(d, teamScope))
    .sort((a, b) => a.conference.localeCompare(b.conference) || a.id.localeCompare(b.id));
}

/** Per-week in-scope dual counts across the whole axis, for the week selector. */
export function weekCounts(schedule, conferenceIds, teamScope = null) {
  const scope = new Set(conferenceIds);
  const counts = Object.fromEntries(schedule.weekAxis.map(w => [w.tag, 0]));
  schedule.duals.forEach(d => {
    if (d.week && scope.has(d.conference) && dualInTeamScope(d, teamScope))
      counts[d.week] = (counts[d.week] || 0) + 1;
  });
  return counts;
}

// ─── DISPLAY HELPERS ──────────────────────────────────────────────────────────

/** "Fri, Jan 8" for confirmed dates; null when the dual has no date yet. */
export function dualDateLabel(dual) {
  if (!dual.date) return null;
  return new Date(`${dual.date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/** "Jan 4 – 10" range label for a WEEK_AXIS entry. */
export function weekRangeLabel(axisEntry) {
  const opts = { month: 'short', day: 'numeric' };
  const mon = new Date(`${axisEntry.monday}T12:00:00`).toLocaleDateString(undefined, opts);
  const sun = new Date(`${axisEntry.sunday}T12:00:00`).toLocaleDateString(undefined, opts);
  return `${mon} – ${sun}`;
}

/** Default lock time for a week: Friday of that week, 6:00 PM local. */
export function defaultLockAt(axisEntry) {
  const friday = new Date(`${axisEntry.monday}T18:00:00`);
  friday.setDate(friday.getDate() + 4);
  const pad = n => String(n).padStart(2, '0');
  // datetime-local format, local time
  return `${friday.getFullYear()}-${pad(friday.getMonth() + 1)}-${pad(friday.getDate())}T18:00`;
}

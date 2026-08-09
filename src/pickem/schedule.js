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

// ─── SLATE QUERIES ────────────────────────────────────────────────────────────

/** Scheduled duals for one ISO-week tag, limited to the pool's conferences. */
export function dualsForWeek(schedule, weekTag, conferenceIds) {
  const scope = new Set(conferenceIds);
  return schedule.duals
    .filter(d => d.week === weekTag && scope.has(d.conference))
    .sort((a, b) => a.conference.localeCompare(b.conference) || a.id.localeCompare(b.id));
}

/** In-scope duals the dataset couldn't place on a week yet (Big Ten, mostly). */
export function unscheduledDuals(schedule, conferenceIds) {
  const scope = new Set(conferenceIds);
  return schedule.duals
    .filter(d => !d.week && scope.has(d.conference))
    .sort((a, b) => a.conference.localeCompare(b.conference) || a.id.localeCompare(b.id));
}

/** Per-week in-scope dual counts across the whole axis, for the week selector. */
export function weekCounts(schedule, conferenceIds) {
  const scope = new Set(conferenceIds);
  const counts = Object.fromEntries(schedule.weekAxis.map(w => [w.tag, 0]));
  schedule.duals.forEach(d => {
    if (d.week && scope.has(d.conference)) counts[d.week] = (counts[d.week] || 0) + 1;
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

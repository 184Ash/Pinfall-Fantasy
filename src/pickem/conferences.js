// ─── CONFERENCE PICK'EM CONSTANTS ─────────────────────────────────────────────
// 2026-27 NCAA D1 in-conference dual meets. Generated 2026-08-08 — do not
// hand-edit; regenerate from the schedule dataset.
//
// Scale, at a glance: 8 conferences · 77 teams · 282 in-conference duals ·
// 2,820 individual bouts. Turning everything on peaks at 47 duals in the
// week of Feb 1, 2027 — 470 picks that week in Full Card mode.
//
// CAVEAT: as of 2026-08-08 only 28 of 282 duals have a published date.
// `weeklyDuals` is the expected shape of the season, not a locked schedule.
// Most conferences release dates late Sept-Oct 2026; re-generate then.

export const DUAL_SEASON = '2026-27';
export const BOUTS_PER_DUAL = 10;

// Shared ISO-week axis. Every conference's `weeklyDuals` array is indexed
// against this, so a multi-conference selection is an element-wise sum.
export const WEEK_AXIS = [
  { tag: '2026-W46', monday: '2026-11-09' },
  { tag: '2026-W47', monday: '2026-11-16' },
  { tag: '2026-W48', monday: '2026-11-23' },
  { tag: '2026-W49', monday: '2026-11-30' },
  { tag: '2026-W50', monday: '2026-12-07' },
  { tag: '2026-W51', monday: '2026-12-14' },
  { tag: '2026-W52', monday: '2026-12-21' },
  { tag: '2026-W53', monday: '2026-12-28' },
  { tag: '2027-W01', monday: '2027-01-04' },
  { tag: '2027-W02', monday: '2027-01-11' },
  { tag: '2027-W03', monday: '2027-01-18' },
  { tag: '2027-W04', monday: '2027-01-25' },
  { tag: '2027-W05', monday: '2027-02-01' },
  { tag: '2027-W06', monday: '2027-02-08' },
  { tag: '2027-W07', monday: '2027-02-15' },
  { tag: '2027-W08', monday: '2027-02-22' },
];

export const CONFERENCES = [
  {
    id: 'big-ten',
    name: 'Big Ten',
    short: 'B1G',
    teamCount: 14,
    dualCount: 56,
    boutCount: 560,
    activeWeeks: 6,
    avgDualsPerWeek: 9.3,
    peakWeekDuals: 10,
    window: '2027-01-08/2027-02-14',
    roundRobin: false,
    broadcastTier: 'linear',
    scheduleMaturity: 75,
    tagline: 'Deepest league and the only one with real linear TV. The default pick.',
    weeklyDuals: [0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 10, 9, 10, 9, 0, 0],
  },
  {
    id: 'eiwa',
    name: 'Eastern Intercollegiate Wrestling Association',
    short: 'EIWA',
    teamCount: 12,
    dualCount: 42,
    boutCount: 420,
    activeWeeks: 11,
    avgDualsPerWeek: 3.8,
    peakWeekDuals: 9,
    window: '2026-11-13/2027-02-21',
    roundRobin: false,
    broadcastTier: 'stream',
    scheduleMaturity: 19,
    tagline: 'Twelve teams, two divisions, Fri-Sun sprawl. Army-Navy is the headliner.',
    weeklyDuals: [1, 1, 0, 0, 1, 5, 0, 0, 2, 5, 4, 3, 9, 7, 4, 0],
  },
  {
    id: 'mac',
    name: 'Mid-American Conference',
    short: 'MAC',
    teamCount: 11,
    dualCount: 40,
    boutCount: 400,
    activeWeeks: 11,
    avgDualsPerWeek: 3.6,
    peakWeekDuals: 6,
    window: '2026-12-03/2027-02-19',
    roundRobin: false,
    broadcastTier: 'stream',
    scheduleMaturity: 40,
    tagline: 'Partial round robin, heavy Thursday-night slate, streams scattered by host.',
    weeklyDuals: [0, 0, 0, 2, 2, 4, 0, 2, 2, 4, 3, 6, 6, 4, 5, 0],
  },
  {
    id: 'big-12',
    name: 'Big 12',
    short: 'B12',
    teamCount: 9,
    dualCount: 36,
    boutCount: 360,
    activeWeeks: 10,
    avgDualsPerWeek: 3.6,
    peakWeekDuals: 9,
    window: '2026-11-22/2027-02-21',
    roundRobin: true,
    broadcastTier: 'stream',
    scheduleMaturity: 22,
    tagline: 'Nine teams after realignment gutted it — a clean round robin, all on ESPN+.',
    weeklyDuals: [0, 0, 1, 0, 0, 1, 0, 0, 2, 7, 9, 5, 4, 4, 2, 1],
  },
  {
    id: 'pac-12',
    name: 'Pac-12 Conference',
    short: 'P12',
    teamCount: 9,
    dualCount: 36,
    boutCount: 360,
    activeWeeks: 10,
    avgDualsPerWeek: 3.6,
    peakWeekDuals: 6,
    window: '2026-12-04/2027-02-21',
    roundRobin: true,
    broadcastTier: 'stream',
    scheduleMaturity: 0,
    tagline: 'Rebuilt from four teams to nine. Brand new, so the schedule is the least certain.',
    weeklyDuals: [0, 0, 0, 1, 1, 2, 0, 0, 5, 3, 4, 6, 4, 5, 5, 0],
  },
  {
    id: 'socon',
    name: 'Southern Conference',
    short: 'SoCon',
    teamCount: 9,
    dualCount: 36,
    boutCount: 360,
    activeWeeks: 9,
    avgDualsPerWeek: 4.0,
    peakWeekDuals: 9,
    window: '2026-11-14/2027-02-21',
    roundRobin: true,
    broadcastTier: 'stream',
    scheduleMaturity: 0,
    tagline: 'Full round robin across nine southern schools. No TV, ESPN+ only.',
    weeklyDuals: [1, 0, 0, 0, 0, 1, 0, 0, 1, 4, 4, 5, 9, 7, 4, 0],
  },
  {
    id: 'acc',
    name: 'Atlantic Coast Conference',
    short: 'ACC',
    teamCount: 7,
    dualCount: 21,
    boutCount: 210,
    activeWeeks: 7,
    avgDualsPerWeek: 3.0,
    peakWeekDuals: 3,
    window: '2027-01-08/2027-02-19',
    roundRobin: true,
    broadcastTier: 'linear',
    scheduleMaturity: 14,
    tagline: 'Smallest slate in D1. Three duals a week, seven weeks, easy to keep up with.',
    weeklyDuals: [0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 0],
  },
  {
    id: 'ivy',
    name: 'Ivy League',
    short: 'IVY',
    teamCount: 6,
    dualCount: 15,
    boutCount: 150,
    activeWeeks: 5,
    avgDualsPerWeek: 3.0,
    peakWeekDuals: 5,
    window: '2027-01-22/2027-02-21',
    roundRobin: true,
    broadcastTier: 'stream',
    scheduleMaturity: 0,
    tagline: 'Fifteen duals in five weekends. The smallest, tidiest add-on there is.',
    weeklyDuals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 5, 2, 3, 1, 0],
  },
];

export const CONFERENCE_BY_ID = Object.fromEntries(CONFERENCES.map(c => [c.id, c]));

// Peak-season window (Jan 4 – Feb 21, 2027) — every conference is live here, so
// it is the honest basis for a "typical week" number in the settings UI.
const PEAK_RANGE = ['2027-W01', '2027-W07'];
const PEAK_IDX = WEEK_AXIS
  .map((w, i) => (w.tag >= PEAK_RANGE[0] && w.tag <= PEAK_RANGE[1] ? i : -1))
  .filter(i => i >= 0);

// Load bands, expressed in PICKS PER WEEK (not duals) so one set of thresholds
// works for both pick modes. Full Card multiplies dual count by 10, so the same
// conference selection lands several bands higher there — which is the whole
// point of showing this to the commissioner before they commit.
export const LOAD_BANDS = [
  { max: 10,  key: 'light',     label: 'Light',      blurb: 'A couple of minutes a week.' },
  { max: 30,  key: 'standard',  label: 'Standard',   blurb: 'The sweet spot for a casual pool.' },
  { max: 75,  key: 'heavy',     label: 'Heavy',      blurb: 'Committed players only.' },
  { max: 150, key: 'veryHeavy', label: 'Very heavy', blurb: 'Expect people to miss weeks.' },
  { max: Infinity, key: 'extreme', label: 'Extreme', blurb: 'Almost nobody finishes a card this size.' },
];

export function bandFor(picksPerWeek) {
  return LOAD_BANDS.find(b => picksPerWeek <= b.max);
}

/**
 * Roll up a conference selection the way the settings screen should display it.
 * @param {string[]} ids       selected conference ids
 * @param {'matches'|'duals'} pickMode  Full Card vs Duals Only
 */
export function summarizeSelection(ids, pickMode = 'duals') {
  const picked = ids.map(id => CONFERENCE_BY_ID[id]).filter(Boolean);
  if (!picked.length) {
    return { conferences: 0, teams: 0, duals: 0, bouts: 0, weeks: 0,
             typicalPerWeek: 0, peakPerWeek: 0, peakWeek: null,
             picksTypical: 0, picksPeak: 0, picksSeason: 0, band: LOAD_BANDS[0] };
  }

  const weekly = WEEK_AXIS.map((_, i) =>
    picked.reduce((sum, c) => sum + c.weeklyDuals[i], 0));

  const duals = picked.reduce((s, c) => s + c.dualCount, 0);
  const live = weekly.filter(Boolean);
  const peak = Math.max(...weekly);
  // Average over peak-window weeks that actually have duals — a conference that
  // finishes early (the Big Ten ends Feb 14) would otherwise read artificially light.
  const busy = PEAK_IDX.filter(i => weekly[i] > 0);
  const typical = busy.length ? busy.reduce((s, i) => s + weekly[i], 0) / busy.length : 0;
  const per = pickMode === 'matches' ? BOUTS_PER_DUAL : 1;

  return {
    conferences: picked.length,
    teams: picked.reduce((s, c) => s + c.teamCount, 0),
    duals,
    bouts: duals * BOUTS_PER_DUAL,
    weeks: live.length,
    weekly,
    typicalPerWeek: Math.round(typical * 10) / 10,
    peakPerWeek: peak,
    peakWeek: WEEK_AXIS[weekly.indexOf(peak)].tag,
    picksTypical: Math.round(typical * per),
    picksPeak: peak * per,
    picksSeason: duals * per,
    band: bandFor(Math.round(typical * per)),
  };
}

/** One-line summary for the toggle row itself. */
export function conferenceBlurb(id, pickMode = 'duals') {
  const c = CONFERENCE_BY_ID[id];
  if (!c) return '';
  const per = pickMode === 'matches' ? BOUTS_PER_DUAL : 1;
  return `${c.teamCount} teams · ${c.dualCount} duals · ~${Math.round(c.avgDualsPerWeek * per)} picks/week`;
}

/** Sentence for the running total under the toggle list. */
export function selectionSentence(ids, pickMode = 'duals') {
  const s = summarizeSelection(ids, pickMode);
  if (!s.duals) return 'Pick at least one conference to build a slate.';
  const mode = pickMode === 'matches' ? 'individual match picks' : 'dual picks';
  return `${s.conferences} conference${s.conferences > 1 ? 's' : ''} · ${s.teams} teams · `
    + `${s.picksSeason.toLocaleString()} ${mode} across ${s.weeks} weeks. `
    + `Typical week: ${s.picksTypical}. Busiest week: ${s.picksPeak}. `
    + `${s.band.label} — ${s.band.blurb}`;
}

// Suggested starting points for the commissioner.
export const CONFERENCE_PRESETS = [
  { id: 'tv',       label: 'Televised',  ids: ['big-ten', 'acc'],
    note: 'The two leagues with real linear TV — pick only what you can watch live.' },
  { id: 'bluechip', label: 'Blue chip',  ids: ['big-ten', 'big-12'],
    note: 'Where the national title actually gets decided.' },
  { id: 'east',     label: 'East coast', ids: ['eiwa', 'acc', 'ivy'],
    note: 'Army-Navy, the Ivy round robin and the ACC.' },
  { id: 'all',      label: 'Everything', ids: CONFERENCES.map(c => c.id),
    note: 'All 77 programs. Only do this in Duals Only mode.' },
];

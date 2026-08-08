// ─── PICK'EM CONSTANTS ────────────────────────────────────────────────────────
import { WEIGHT_CLASSES } from '../constants';

export { WEIGHT_CLASSES };

export const PICKEM_SEASON = '2026-27';

// Gate mirrors LEAGUE_CREATION_OPEN — the pick'em product launches open.
export const PICKEM_CREATION_OPEN = true;

// Per-event pick modes
export const PICK_MODES = {
  matches: { label: 'Full Card', desc: 'Pick the winner of all 10 matches in each dual' },
  duals:   { label: 'Duals Only', desc: 'Pick the team winner of each dual meet' },
};

// Result win types (NCAA dual scoring) — used for results entry + display now,
// reserved for a predicted-win-type bonus later.
export const WIN_TYPES = [
  { code: 'DEC', label: 'Decision',       teamPts: 3 },
  { code: 'MD',  label: 'Major Decision', teamPts: 4 },
  { code: 'TD',  label: 'Tech Fall',      teamPts: 5 },
  { code: 'F',   label: 'Fall',           teamPts: 6 },
  { code: 'FFT', label: 'Forfeit',        teamPts: 6 },
  { code: 'INJ', label: 'Injury Default', teamPts: 6 },
  { code: 'DQ',  label: 'Disqualification', teamPts: 6 },
];

// Default scoring — stored on the pool at creation (settings_json.scoring) so
// each pool can tune it later without a code change.
export const DEFAULT_SCORING = {
  matchWin: 1,     // per correct match pick ('matches' mode)
  perfectCard: 3,  // bonus for a perfect 10/10 card on a dual ('matches' mode)
  dualWin: 2,      // per correct dual-winner pick ('duals' mode)
};

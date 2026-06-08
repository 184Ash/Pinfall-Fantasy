// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export const WEIGHT_CLASSES = [125,133,141,149,157,165,174,184,197,285];
// Module-level defaults so Vite's bundler can never create a TDZ in BoardPage
export const DEFAULT_WC_PAGES  = Object.fromEntries(WEIGHT_CLASSES.map(w=>[w,0]));
export const DEFAULT_WC_HIDDEN = Object.fromEntries(WEIGHT_CLASSES.map(w=>[w,false]));

export const TEAM_COLORS = [
  {bg:"#C8102E",glow:"#C8102E55",text:"#ff6b80"},
  {bg:"#1A56DB",glow:"#1A56DB55",text:"#6ba3ff"},
  {bg:"#057A55",glow:"#057A5555",text:"#34d399"},
  {bg:"#D97706",glow:"#D9770655",text:"#fbbf24"},
  {bg:"#7E3AF2",glow:"#7E3AF255",text:"#c084fc"},
  {bg:"#0694A2",glow:"#0694A255",text:"#22d3ee"},
  {bg:"#BE185D",glow:"#BE185D55",text:"#f472b6"},
  {bg:"#059669",glow:"#05966955",text:"#6ee7b7"},
  {bg:"#B45309",glow:"#B4530955",text:"#f59e0b"},
  {bg:"#1E429F",glow:"#1E429F55",text:"#93c5fd"},
  {bg:"#9B1C1C",glow:"#9B1C1C55",text:"#fca5a5"},
  {bg:"#5521B5",glow:"#5521B555",text:"#a78bfa"},
];

export const DEFAULT_TEAMS = [
  "Raging Bulls","Iron Wolves","Thunder Hawks","Steel Bears",
  "Crimson Eagles","Gold Rush","Blue Devils","Night Owls","Blaze Kings","Silver Foxes",
];

// Picks per team: 10 weight slots + 1 bonus "dark horse" (can be toggled off)
export const PICKS_PER_TEAM_BASE = 10; // without bonus
export const PICKS_PER_TEAM_BONUS = 11; // with bonus
export const TEAM_SOFT_CAP = 20; // warn above this
export const TEAM_HARD_CAP = 30; // block above this

export const PAGE_SIZE = 12; // wrestlers per page per weight column

// Off-season gate: when false, the public app is a read-only showcase and new
// league creation is disabled (the live DB enforces read-only RLS). Flip to true
// and redeploy when a new tournament season opens.
export const LEAGUE_CREATION_OPEN = false;

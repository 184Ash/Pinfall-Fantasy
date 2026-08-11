# Pinfall Pick'em — dashboard design brief

**Paste this whole document into Claude (or an artifact prompt) as context for
designing the dashboard.** It contains the product model, the exact visual
language of the existing app, the real data shape, and every metric that is
actually computable from that data.

---

## 1. The product

**Pinfall Fantasy** is a fan-built NCAA Division I wrestling platform with two
game types:

1. **NCAA Championship Draft** (shipped, runs each March) — a live snake draft
   of wrestlers across all 10 weight classes for the national tournament, with
   automated scoring from the live bracket.
2. **Dual Meet Pick'em** (new, for the 2026-27 season) — the subject of this
   brief.

**How the pick'em works.** A commissioner creates a **pool** (a pool is a URL —
a 5-character join code; members join with a display name and a personal access
code). Each week the commissioner posts an **event** = one week's slate of
**duals** (team-vs-team meets). Members pick winners before the slate locks.
Two pick modes, set per week:

| Mode | What members pick | Default scoring |
|---|---|---|
| **Full Card** (`matches`) | The winner of all 10 individual bouts in each dual | 1 pt per correct bout, +3 bonus for a perfect 10/10 card |
| **Duals Only** (`duals`) | Just the winning team of each dual | 2 pts per correct dual |

Key rule: **a pick is a team side** (`home` or `away`) at a given weight, not a
wrestler. Lineups shown in the UI are the *expected* matchup; if a wrestler is
swapped or injured, the pick still stands. This matters for the dashboard: never
present picks as "you picked wrestler X."

**Season shape (2026-27):** 8 conferences, 77 teams, ~282 in-conference duals,
2,820 individual bouts. Season runs Nov 9, 2026 – Feb 21, 2027, but **89% of all
duals fall between Jan 4 and Feb 21** — the busiest week is Feb 1 (47 duals).
November/December are nearly empty. A dashboard should not look broken in a
sparse December week.

**Pool scope.** Each pool picks which conferences are in play, and optionally
which *teams* within each conference to follow (a dual stays in the slate if it
features at least one followed team). So one pool might be Big Ten only; another
might be all 8 conferences in Duals Only mode.

Conferences, for reference (teams / in-conference duals):
Big Ten (14/56) · EIWA (12/42) · MAC (11/40) · Big 12 (9/36) · Pac-12 (9/36) ·
SoCon (9/36) · ACC (7/21) · Ivy (6/15). Only the Big Ten and ACC have linear TV.

---

## 2. Visual language (match this exactly)

The app is dark, high-contrast, gold-accented — a wrestling-mat/scoreboard feel,
never a SaaS-analytics feel. Sharp corners or small radii; no soft shadows, no
pastel. Uppercase letter-spaced micro-labels are the signature.

### Color tokens

```
/* surfaces */
--bg-app:        #070a0e   /* app background (near-black) */
--bg-landing:    #1E2128   /* marketing background (charcoal) */
--surface:       #0b0f14   /* cards */
--surface-alt:   #16191F   /* landing cards */
--surface-head:  #0a1018   /* card headers, table headers */
--border:        #1a1f26   /* default border */
--border-input:  #1e2530   /* inputs, secondary borders */
--border-faint:  #131820   /* row dividers */

/* gold — the brand */
--gold:          #C9A84C   /* primary accent, key numbers, active state */
--gold-bright:   #E2C06A   /* hover */
--gold-dim:      #8C6E2A   /* secondary accent */
--gold-label:    #6a5a30   /* micro-label text (olive-gold) */

/* text */
--text-primary:   #E8E4DC  /* headings on landing */
--text-body:      #d0c8b4  /* body text in app (warm bone) */
--text-secondary: #9aa4ae
--text-tertiary:  #6a7480
--text-faint:     #4a5260

/* status */
--green:  #34d399   /* correct pick, win, "light" load */
--red:    #f87171   /* incorrect pick, danger */
--red-bg: #1e0a0a   /* error background */  --red-border: #7f1d1d
--green-bg: #0a1e14  --green-border: #14532d
--amber:  #d97706   /* warning, "heavy" load */
--purple/blue accents exist for team colors only (see below)
```

Team color palette (used in the draft product for participant identity — reuse
for member avatars/rows if helpful):
`#C8102E #1A56DB #057A55 #D97706 #7E3AF2 #0694A2 #BE185D #059669 #B45309 #1E429F #9B1C1C #5521B5`

### Typography

- **Bebas Neue** — big display numbers and marketing headlines (tight, condensed, uppercase)
- **Oswald** — UI chrome: tabs, buttons, micro-labels, stat numbers. Usually uppercase with `letter-spacing: .08em–.25em`
- **Barlow Condensed** — dense data: table rows, names, descriptions
- **Barlow** — long-form paragraphs (marketing only)

Micro-label pattern used everywhere (copy it):
`font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: #6a5a30`

### Component patterns already in the app

- **Cards**: `background: #0b0f14; border: 1px solid #1a1f26; border-radius: 10px; overflow: hidden` with a `#0a1018` header strip
- **Primary button**: gold fill, near-black text, uppercase, `letter-spacing: .08em`
- **Ghost button**: transparent, gold text, `1px solid #c9a84c44`
- **Tabs**: text buttons with a 2px gold bottom border when active
- **Status colors carry an icon or label, never color alone** (accessibility rule
  we already follow — e.g. load bands render as "⚠ VERY HEAVY", not just red)
- **Pick buttons**: two side-by-side team buttons with the weight class centered
  between them; selected = gold border/tint; after results, correct = green
  tint, wrong = red tint

---

## 3. Data model (what the dashboard can read)

Postgres (Supabase). Simplified, with the fields that matter for display:

```
pickem_pools
  id            TEXT      -- 5-char join code, e.g. "K7M2Q"
  name          TEXT      -- "Hawkeye Homies Pick'em"
  season        TEXT      -- "2026-27"
  settings_json JSONB     -- { scoring: {matchWin, perfectCard, dualWin},
                            --   conferences: ["big-ten","acc"],
                            --   teamScope: { "big-ten": ["iowa","penn-state"] },
                            --   defaultPickMode: "matches" }

pickem_members
  id, pool_id, name, role ("commissioner" | "member"), email, created_at

pickem_events            -- one per week
  id, pool_id, week_number, title, pick_mode ("matches" | "duals"),
  lock_at TIMESTAMPTZ, status ("upcoming" | "locked" | "final")

pickem_duals             -- team vs team, belongs to an event
  id, event_id, dual_order, home_team TEXT, away_team TEXT,
  home_score INT, away_score INT, winner ("home" | "away" | "tie" | null),
  conference TEXT,       -- e.g. "big-ten"
  source_dual_id TEXT    -- link back to the schedule dataset

pickem_matches           -- 10 per dual in Full Card mode
  id, dual_id, match_order, weight INT (125,133,141,149,157,165,174,184,197,285),
  home_wrestler TEXT, away_wrestler TEXT,   -- EXPECTED lineup, may be null
  winner ("home" | "away" | null),
  win_type ("DEC"|"MD"|"TD"|"F"|"FFT"|"INJ"|"DQ")

pickem_picks
  id, pool_id, member_id,
  match_id  (set in Full Card mode)  XOR  dual_id (set in Duals Only mode),
  pick ("home" | "away"), updated_at
```

Win types and their NCAA dual team points: DEC 3 · MD 4 · TD (tech fall) 5 ·
F (fall) 6 · FFT 6 · INJ 6 · DQ 6.

Only events with `status = "final"` count toward standings. Scoring is computed
client-side from raw picks, so any scoring change recomputes history.

---

## 4. Metrics that are actually computable (the good stuff)

This is the menu the dashboard should choose from. Everything here derives from
the tables above with no new data collection.

**Per member, season-level**
- Total points; rank; rank change vs last week
- Correct / total picks; **accuracy %**
- Perfect cards (10/10 on a dual in Full Card mode)
- Week wins (weeks where they had the top score)
- Best week / worst week
- Current streak (consecutive correct picks), longest streak
- Points by week → sparkline or bar series
- Cumulative points by week → line chart vs the pool average

**Per member, sliced (this is what makes it feel smart)**
- **Accuracy by weight class** — matches carry `weight`, so "you're 78% at
  heavyweight, 41% at 125" is a real, and genuinely interesting, stat
- **Accuracy by conference** — duals carry `conference`
- **Accuracy by team** — "you've picked Iowa 14 times, right 11"
- **Favorite vs underdog behavior** — compare a member's pick against the pool
  consensus; measure how often they go against the field and win ("contrarian
  hit rate"). Pure gold for a pool leaderboard.
- **Bonus-type accuracy** — pair picks with `win_type` to show, e.g., how often
  the bouts they got wrong were bonus-point results

**Pool-level**
- Standings table (points, accuracy, perfect cards, week wins)
- Weekly winner history
- **Consensus board** — for each dual/bout: what % of the pool took each side.
  Only reveal after lock (before lock, picks are private)
- Most-agreed and most-divisive picks of the week
- Pool-wide accuracy per week (was it a chalk week or an upset week?)
- Participation: picks submitted vs expected, per member per week
- Biggest upset of the week (the dual where the field was most wrong)
- Season arc: total picks made, bouts scored, duals covered

**Live/pending state**
- Countdown to `lock_at`; how many of your picks are still missing
- This week's slate at a glance (duals, conferences, TV flags)
- After results land but before finalize: provisional standings

---

## 5. What to design

### A. League (pool) dashboard — the "home" view

Replaces/absorbs the current Standings tab. Suggested composition:

1. **Header strip**: pool name, season, week N of the season, next lock
   countdown, your rank + points (personal anchor in a shared view)
2. **Standings table**: rank, member, points, accuracy %, perfect cards, week
   wins, and a small points-by-week sparkline per row. Highlight the current
   user's row in gold tint. Medals for top 3 once ≥1 week is final.
3. **Race chart**: cumulative points by week, one line per member (or top 5 +
   "you" if the pool is large). This is the single most compelling visual for a
   season-long pool.
4. **This week panel**: the slate with each dual, lock state, and — after lock —
   the consensus split bar per dual (e.g. `IOWA 78% ▓▓▓▓▓▓▓░░ 22% PSU`)
5. **Week winners strip**: a row of week chips showing who won each week
6. **Pool pulse**: chalk-vs-upset meter for the week, participation %, biggest
   upset, most divisive pick

### B. Member ("team") dashboard — one per participant

In fantasy terms this is a participant's "team page." Suggested composition:

1. **Identity header**: name, rank, points, accuracy %, streak; commissioner
   badge if applicable
2. **Form line**: last 6 weeks as W/L-style chips with points per week
3. **Accuracy by weight class**: a 10-row horizontal bar chart (125 → 285). This
   is the signature visual of the member page — nothing else in wrestling
   fantasy shows it.
4. **Accuracy by conference**: small multiples or a compact bar set
5. **Team affinity**: teams picked most often, with hit rate — reveals the
   homer/contrarian personality
6. **Contrarian index**: how often they diverge from consensus, and their win
   rate when they do
7. **Pick log**: recent picks with ✓/✗, weight, dual, win type of the actual
   result. Dense, Barlow Condensed, scannable.
8. **Head-to-head selector**: compare this member to any other on the same axes

### C. Optional third view — wrestling team page

The data supports a page per *wrestling program* (Iowa, Penn State): their duals
in the pool's scope, results, and how the pool collectively picked them (pool
faith vs actual record). Design this only if it doesn't dilute A and B.

---

## 6. Constraints

- **Mobile-first matters.** Members make picks on phones during dual weekends;
  the dashboard will be read on phones. Tables must degrade to stacked cards;
  charts must survive a 375px viewport.
- **Dark theme only** — the app has no light mode. Design for #070a0e.
- **No external asset dependencies** (self-contained CSS/SVG; fonts are the four
  Google fonts named above).
- **Sparse-data grace**: in November a pool may have 1 finalized week and 3
  members. Every view needs a credible empty/early state, not a broken grid.
- **Two pick modes**: Duals Only pools have NO per-weight data — the weight-class
  chart and bout-level metrics must hide cleanly, not render empty axes.
- **Accessibility**: never encode meaning in color alone (pair with icon/label);
  maintain contrast on the dark background.
- Existing stack is React + inline styles/CSS strings (no Tailwind, no component
  library) — but for design exploration, use whatever communicates best.

---

## 7. Mock data (realistic shapes to design against)

```json
{
  "pool": {
    "id": "K7M2Q",
    "name": "Hawkeye Homies Pick'em",
    "season": "2026-27",
    "settings": {
      "scoring": { "matchWin": 1, "perfectCard": 3, "dualWin": 2 },
      "conferences": ["big-ten", "big-12"],
      "defaultPickMode": "matches"
    }
  },
  "members": [
    { "id": "m1", "name": "Jake",  "role": "commissioner" },
    { "id": "m2", "name": "Katie", "role": "member" },
    { "id": "m3", "name": "Dev",   "role": "member" },
    { "id": "m4", "name": "Sam",   "role": "member" }
  ],
  "standings": [
    { "memberId": "m2", "rank": 1, "points": 128, "correct": 116, "total": 150,
      "accuracy": 0.773, "perfectCards": 2, "weekWins": 3,
      "byWeek": [14, 22, 19, 26, 21, 26], "rankChange": 1 },
    { "memberId": "m1", "rank": 2, "points": 121, "correct": 112, "total": 150,
      "accuracy": 0.747, "perfectCards": 1, "weekWins": 2,
      "byWeek": [18, 20, 17, 24, 19, 23], "rankChange": -1 },
    { "memberId": "m3", "rank": 3, "points": 104, "correct": 98, "total": 150,
      "accuracy": 0.653, "perfectCards": 0, "weekWins": 1,
      "byWeek": [12, 18, 21, 15, 20, 18], "rankChange": 0 },
    { "memberId": "m4", "rank": 4, "points": 89, "correct": 84, "total": 140,
      "accuracy": 0.600, "perfectCards": 0, "weekWins": 0,
      "byWeek": [10, 16, 14, 19, 12, 18], "rankChange": 0 }
  ],
  "currentEvent": {
    "id": "e7", "weekNumber": 7, "title": "Week of Feb 1 — B1G/B12 slate",
    "pickMode": "matches", "lockAt": "2027-02-05T18:00:00-06:00",
    "status": "upcoming",
    "duals": [
      { "id": "d1", "conference": "big-ten", "awayTeam": "Iowa", "homeTeam": "Penn State",
        "consensus": { "away": 0.25, "home": 0.75 },
        "matches": [
          { "id": "x1", "weight": 125, "awayWrestler": "Drake Ayala", "homeWrestler": "Luke Lilledahl" },
          { "id": "x2", "weight": 133, "awayWrestler": "Cullan Schriever", "homeWrestler": "Braeden Davis" }
        ] },
      { "id": "d2", "conference": "big-12", "awayTeam": "Oklahoma State", "homeTeam": "Iowa State",
        "consensus": { "away": 0.5, "home": 0.5 }, "matches": [] }
    ]
  },
  "memberDetail": {
    "memberId": "m2", "name": "Katie",
    "accuracyByWeight": [
      { "weight": 125, "correct": 9,  "total": 15 }, { "weight": 133, "correct": 11, "total": 15 },
      { "weight": 141, "correct": 12, "total": 15 }, { "weight": 149, "correct": 10, "total": 15 },
      { "weight": 157, "correct": 13, "total": 15 }, { "weight": 165, "correct": 12, "total": 15 },
      { "weight": 174, "correct": 11, "total": 15 }, { "weight": 184, "correct": 12, "total": 15 },
      { "weight": 197, "correct": 13, "total": 15 }, { "weight": 285, "correct": 13, "total": 15 }
    ],
    "accuracyByConference": [
      { "conference": "big-ten", "label": "B1G", "correct": 68, "total": 90 },
      { "conference": "big-12",  "label": "B12", "correct": 48, "total": 60 }
    ],
    "teamAffinity": [
      { "team": "Iowa", "picked": 14, "correct": 11 },
      { "team": "Penn State", "picked": 12, "correct": 11 },
      { "team": "Oklahoma State", "picked": 9, "correct": 6 }
    ],
    "contrarian": { "againstConsensus": 22, "correctAgainstConsensus": 12 },
    "recentPicks": [
      { "week": 6, "dual": "Iowa at Penn State", "weight": 174, "pick": "away",
        "result": "away", "winType": "MD", "correct": true },
      { "week": 6, "dual": "Iowa at Penn State", "weight": 184, "pick": "home",
        "result": "away", "winType": "F", "correct": false }
    ]
  }
}
```

---

## 8. The ask

Design **(A)** the league dashboard and **(B)** the member dashboard as a single
coherent system — shared header, shared card language, shared chart styling —
that looks like it was always part of Pinfall Fantasy. Prioritize:

1. The season race (cumulative points) as the emotional centerpiece of A
2. Accuracy-by-weight-class as the signature insight of B
3. Consensus/contrarian data as the social hook that makes people talk
4. Legibility on a phone during a Friday-night dual

Deliver as a self-contained interactive artifact using the mock data above.

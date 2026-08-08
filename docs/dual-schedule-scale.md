# 2026-27 NCAA D1 dual meets — scale analysis for the conference pick'em

Built **Aug 8, 2026**. In-conference duals only, per your scoping call.

---

## The headline

| | |
|---|---|
| Conferences | **8** |
| Programs | **77** |
| In-conference duals | **282** |
| Individual bouts (10 per dual) | **2,820** |
| Busiest week | **47 duals** (week of Feb 1, 2027) |
| Season window | Nov 9, 2026 – Feb 28, 2027 |

There are no D1 independents. All 77 programs sit in one of eight conferences, which is
convenient — a conference toggle is a complete partition of the sport, not a filter with
a leftover bucket.

**The number that should drive the UI:** turn everything on in Full Card mode and the week
of Feb 1 asks each player for **470 individual picks**. That is not a pool, it is a data
entry job. The whole point of the toggle screen is to stop someone from wandering into it.

---

## Per-conference cost of one toggle

| Conf | Teams | Duals | Bouts | Active weeks | Duals/wk | Peak wk | Format | TV |
|---|---:|---:|---:|---:|---:|---:|---|---|
| **Big Ten** | 14 | 56 | 560 | 6 | 9.3 | 10 | 8 duals each, not a round robin | **Linear (BTN)** |
| **EIWA** | 12 | 42 | 420 | 11 | 3.8 | 9 | 2 divisions, 5 required + optional crossover | Stream |
| **MAC** | 11 | 40–55 | 400–550 | 11 | 3.6 | 6 | Partial round robin, 8–9 of 10 opponents | Stream |
| **Big 12** | 9 | 36 | 360 | 10 | 3.6 | 9 | Full round robin | Stream |
| **Pac-12** | 9 | 36 | 360 | 10 | 3.6 | 6 | Full round robin *(projected)* | Stream |
| **SoCon** | 9 | 36 | 360 | 9 | 4.0 | 9 | Full round robin | Stream |
| **ACC** | 7 | 21 | 210 | 7 | 3.0 | 3 | Full round robin | **Linear (ACCN)** |
| **Ivy** | 6 | 15 | 150 | 5 | 3.0 | 5 | Full round robin | Stream |

Three things fall out of this table that are worth surfacing in the product:

**The Big Ten is a different animal.** It is not just the biggest — it is the most
*concentrated*. Fifty-six duals crammed into six weekends means it alone runs ~9 duals a
week, more than double any other league, and it is the only conference where a single
toggle pushes Full Card mode into "very heavy" on its own. Every other conference spreads
a smaller slate over 9–11 weeks.

**Your televised-only user is really a Big Ten + ACC user.** Only those two have linear TV
inventory — roughly 19 of 56 Big Ten conference duals on BTN, about 3 ACC duals on ACC
Network via Friday Night Duals. Everything else in D1 is streaming, and streaming rights
follow the *home* school rather than the conference, so a MAC dual might be on ESPN+,
FloWrestling or a PSAC school stream depending on whose gym it's in. That fragmentation is
worth a tooltip; "can I watch this live" is genuinely harder than it sounds outside those
two leagues.

**Small conferences are cheap add-ons and you should say so.** The Ivy is 15 duals across
five weekends. The ACC is 21 across seven. Adding either to a Big Ten pool barely moves the
weekly number, and both add real marquee content. A commissioner scanning the list has no
way to know that a nine-team conference (SoCon, 36 duals) costs more than double a
seven-team one (ACC, 21) — round robin math is not intuitive, so the per-week figure needs
to be on the toggle itself.

---

## What the two pick modes actually cost

Same conference selection, two very different products:

| Selection | Teams | Duals | **Duals Only** typ/peak | **Full Card** typ/peak |
|---|---:|---:|---|---|
| Big Ten only | 14 | 56 | 9 / 10 · *Light* | 93 / 100 · *Very heavy* |
| ACC only | 7 | 21 | 3 / 3 · *Light* | 30 / 30 · *Standard* |
| Ivy only | 6 | 15 | 3 / 5 · *Light* | 30 / 50 · *Standard* |
| Big Ten + Big 12 | 23 | 92 | 13 / 19 · *Standard* | 127 / 190 · *Very heavy* |
| Big Ten + ACC ("televised") | 21 | 77 | 11 / 13 · *Standard* | 110 / 130 · *Very heavy* |
| B1G + B12 + ACC + EIWA | 42 | 155 | 21 / 26 · *Standard* | 206 / 260 · *Extreme* |
| Everything | 77 | 282 | 36 / 47 · *Heavy* | 364 / 470 · *Extreme* |

The 10× multiplier is the entire story. **In Duals Only, all eight conferences is a
perfectly reasonable pool** — 36 picks in a typical week is a few minutes of tapping. In
Full Card, *a single conference* can be too much.

This asymmetry means the two settings are not independent, and the UI shouldn't present
them as if they are. Pick mode should come **first**, and it should re-price every
conference toggle underneath it.

Your existing schema already supports the right escape hatch: `pick_mode` lives on
`pickem_events`, not on the pool. So a commissioner can run Full Card on a three-dual ACC
week and drop to Duals Only when the Big Ten stacks ten duals on one weekend. That is a
genuinely good feature and it is currently invisible — worth surfacing in the settings copy.

---

## Marginal cost: adding a second conference to a Big Ten pool

Starting from Big Ten alone (56 duals, peak 10/wk):

| Add | Season duals | Peak week | Full Card peak |
|---|---:|---:|---:|
| + ACC | 77 (+21) | 13 (+3) | 130 picks |
| + Ivy | 71 (+15) | 14 (+4) | 140 picks |
| + Pac-12 | 92 (+36) | 15 (+5) | 150 picks |
| + MAC | 96 (+40) | 16 (+6) | 160 picks |
| + Big 12 | 92 (+36) | 19 (+9) | 190 picks |
| + SoCon | 92 (+36) | 19 (+9) | 190 picks |
| + EIWA | 98 (+42) | 19 (+9) | 190 picks |

Note that Pac-12 and Big 12 have identical season totals (36 duals each) but the Big 12
costs nearly twice as much in the peak week. Season totals lie; **peak week is the number
that determines whether people actually finish their picks.** Lead with it.

---

## The season is not flat — plan for the January–February wall

All eight conferences on, duals per week:

```
Nov 09   2  ██
Nov 16   1  █
Nov 23   1  █
Nov 30   3  ███
Dec 07   4  ████
Dec 14  13  █████████████
Dec 21   0
Dec 28   2  ██
Jan 04  24  ████████████████████████
Jan 11  35  ███████████████████████████████████
Jan 18  41  █████████████████████████████████████████
Jan 25  42  ██████████████████████████████████████████
Feb 01  47  ███████████████████████████████████████████████  ← peak
Feb 08  42  ██████████████████████████████████████████
Feb 15  24  ████████████████████████
Feb 22   1  █
```

Roughly **89% of all in-conference duals happen in the seven weeks from Jan 4 to Feb 21.**
November and December are nearly empty — a handful of early Big 12, SoCon and EIWA duals,
plus a Dec 14 cluster — and everything stops for finals the week of Dec 21.

Product implications:

- A pool that launches in November will feel dead for six weeks, then triple in a fortnight.
  Consider seeding the early weeks with non-conference duals (Iowa–Iowa State, the CKLV
  and Southern Scuffle brackets) or just telling the commissioner plainly that the season
  starts slow.
- The "typical week" number shown in settings should average the **Jan 4 – Feb 21 window
  only**. Averaging across the whole season understates the real load by ~40% and sets a
  false expectation.
- Feb 22 onward is conference tournaments, then NCAAs Mar 18–21 in St. Louis. There is a
  natural pool end date at Feb 21 and a separate bracket-shaped product after it.

---

## Recommended settings UI

### Order of operations

1. **Pick mode** (Full Card / Duals Only) — first, because it 10×'s everything below.
2. **Conference toggles** with live per-conference cost.
3. **Running total** that updates on every toggle, expressed in *picks per week*, not duals.
4. **A load verdict** with an icon and a label, not just a color.

### Load bands (in picks per week, so one set of thresholds serves both modes)

| Band | Picks/wk | Copy |
|---|---|---|
| Light | ≤ 10 | "A couple of minutes a week. Nobody will fall behind." |
| Standard | ≤ 30 | "The sweet spot for a casual pool." |
| Heavy | ≤ 75 | "Committed players only. Consider trimming a conference or switching to Duals Only." |
| Very heavy | ≤ 150 | "Expect people to miss weeks. Autopick or partial credit becomes close to mandatory." |
| Extreme | > 150 | "Almost nobody finishes a card this size. Strongly consider Duals Only." |

These are shipped in `conferences.js` as `LOAD_BANDS` + `bandFor()`.

### Copy for the toggle rows

Each row needs three facts, in this order — identity, size, cost:

```
B1G   [TV]     14 teams · 56 duals · ~93 picks/week
               Deepest league, only one with real linear TV.
```

The picks-per-week figure recalculates with the pick mode. `conferenceBlurb(id, mode)`
returns exactly this string.

### Running total

```
2 conferences · 21 teams · 770 individual match picks across 11 weeks.
Typical week: 110. Busiest week: 130.
Very heavy — expect people to miss weeks.
```

`selectionSentence(ids, mode)` returns this.

### Three presets worth shipping

- **Televised** — Big Ten + ACC. "Only what you can watch live." This is the request you
  anticipated, and the data says it is a real, clean category of exactly two conferences.
- **Blue chip** — Big Ten + Big 12. Where the team title gets decided.
- **Everything** — with a hard-coded warning if Full Card is on.

### One guardrail I'd add

Block or hard-warn on **Full Card + more than 2 conferences**. At three conferences the
worst-case peak is 280 picks in a week; at four it is 340. The `matches` mode auto-scaffolds
10 rows per dual in `pickem_matches`, so a commissioner who checks all eight boxes in Full
Card mode generates **2,820 match rows** and a picks table that could reach 2,820 × members.
That is fine for Postgres and rough for a phone rendering `PicksTab`.

---

## Data confidence — read this before you ship the dataset

**It is August. Almost nothing is published yet.** This is the single biggest caveat.

| Conf | Dates published | Pairings official | Status |
|---|---|---|---|
| MAC | 16 / 40 | 16 / 40 | Lock Haven + Edinboro full slates posted |
| EIWA | 9 / 42 | 8 / 42 | Franklin & Marshall only; Army–Navy via WrestleStat |
| ACC | 3 / 21 | 3 / 21 | UNC home slate only (July 28) |
| Big Ten | 0 / 56 | 42 / 56 | Opponent rotation released June 18; dates due Sept |
| Big 12 | 0 / 36 | 8 / 36 | Iowa State + Northern Iowa home opponents only |
| Pac-12 | 0 / 36 | 0 / 36 | Nothing — the *format itself* is projected |
| SoCon | 0 / 36 | 0 / 36 | Nothing |
| Ivy | 0 / 15 | 0 / 15 | Nothing |

**28 of 282 duals have a real date. 77 of 282 have an officially sourced pairing.**

Every dual carries `status` (confirmed/tbd) and `confidence` (official/projected) so you can
render the difference rather than pretending it away.

### How the projections were built, by conference

- **Big Ten** — the June 18 opponent rotation pins 42 of 56 pairings with home/away. The
  other 14 were solved among the seven schools that never published, using each team's
  remaining dual count, the protected Michigan–Michigan State rivalry, and the year-over-year
  home/away flip. The solution puts all 14 teams at exactly 4H/4A, which is a real
  consistency check but not a uniqueness proof. Treat those 14 as ~70% confidence.
- **Round-robin conferences (Big 12, ACC, SoCon, Ivy)** — pairings are certain because the
  format demands them. Venues come from flipping 2025-26. That heuristic validated 6-for-6
  against F&M's published EIWA slate, 3-for-3 against UNC's ACC slate, and 8-for-8 against
  the MAC's published duals — it is the most reliable inference in the whole dataset.
- **Pac-12** — the weakest block by a wide margin. The league went from four teams to nine
  and has announced *no scheduling model*. The round robin is inferred from a single report
  that Cal Poly goes from one home conference dual to four; in a nine-team league, 4H+4A is
  exactly a round robin. Plausible, but if the Pac-12 adopts a partial model instead, expect
  ~24 duals rather than 36. Do not present Pac-12 pairings as fact.
- **MAC** — a partial round robin, so the 11-team matrix (55 pairings) over-counts. 40 are
  positively expected; 15 are flagged `probability: "unlikely"` and excluded from all
  totals. The true number is probably ~46. SIUE (5) and Rider sit at the bottom of the range
  and will likely pick up a dual or two each.
- **EIWA** — 30 intra-division duals are required; the ~12 cross-division duals are optional
  but count in the conference record. Two divisional pairings (Drexel–Sacred Heart,
  Army–Morgan State) were never contested in 2025-26 and may not be again.

### Known soft spots, ranked

1. **Pac-12, everything.** Format, pairings, venues, dates. Re-scrape before you rely on it.
2. **The 14 derived Big Ten pairings** among Illinois, Indiana, Michigan, Michigan State,
   Nebraska, Ohio State, Wisconsin.
3. **MAC per-team counts.** SIUE at 5 duals is likely 1–2 low.
4. **EIWA "5 required divisional duals"** is inferred from F&M's schedule, not read off an
   EIWA release (eiwawrestling.org blocks fetches). Consistent with everything observed, but
   unsourced.
5. **All SoCon and Ivy dates.** Structurally solid, calendrically invented.

### When to re-run

**Late September / early October 2026.** Precedent is unambiguous: the 2025-26 Big Ten
schedule dropped Sept 23–29, the BTN TV slate Oct 29, and most Big 12 / Pac-12 / SoCon
schedules land late Sept through late Oct. A second pass in early November catches the ESPN
and BTN broadcast assignments, which is what a "televised only" filter actually needs.

---

## What changed in the sport since last season

Worth knowing because a lot of published lists are stale:

- **The Pac-12 rebuilt its wrestling league from 4 teams to 9**, adding Northern Illinois
  (from the MAC) and Air Force, Northern Colorado, North Dakota State and South Dakota State
  (all from the Big 12).
- **The Big 12 fell from 14 wrestling schools to 9** — those four departures plus
  **California Baptist discontinuing wrestling** after 2025-26.
- **The MAC dropped from 12 to 11** with Northern Illinois leaving. Cleveland State was
  already gone (cut after 2024-25).
- **The Ivy League is a separate conference now**, not an EIWA sub-group. The six Ivies left
  after 2023-24 and have run their own championship since 2024-25. The EIWA is 12 teams with
  zero Ivy members.

Net effect: 78 programs in 2025-26 → 77 in 2026-27. Five programs changed conferences.

A verification pass adversarially re-checked all of the above against primary sources and
confirmed every claim. One warning it surfaced: **both Wikipedia and FloWrestling's D1 team
lists omit SIU Edwardsville**, so they total 77 for 2025-26 when the real figure was 78. If
you ever regenerate team lists from those sources, SIUE will silently vanish.

---

## Files

| File | What it is |
|---|---|
| `ncaa-d1-duals-2026-27.json` | The full dataset — conferences, teams, 297 dual rows, weekly histograms, week axis |
| `ncaa-d1-duals-2026-27.csv` | Same duals, flat, for spreadsheets or a SQL import |
| `conferences.js` | Drop-in ES module for `src/pickem/` — constants, load bands, `summarizeSelection()`, `conferenceBlurb()`, `selectionSentence()`, presets |
| `conference-load-explorer.html` | Interactive toggle preview — the settings screen, prototyped |

### The bit that makes the UI easy

Every conference carries a `weeklyDuals` array indexed against a shared 16-week `weekAxis`.
A multi-conference selection is an **element-wise sum** — no date parsing, no grouping, no
query. That is what `summarizeSelection()` does, and it is why the running total can
recalculate on every toggle without touching the database.

```js
import { summarizeSelection, selectionSentence } from './conferences';

const s = summarizeSelection(['big-ten', 'acc'], 'matches');
// { duals: 77, bouts: 770, typicalPerWeek: 11, picksTypical: 110,
//   picksPeak: 130, peakWeek: '2027-W03', band: { label: 'Very heavy', … } }

selectionSentence(['big-ten', 'acc'], 'matches');
// "2 conferences · 21 teams · 770 individual match picks across 11 weeks. …"
```

### Suggested schema follow-ons

Nothing here requires a migration — `pickem_pools.settings_json` can hold the selection:

```json
{
  "scoring": { "matchWin": 1, "perfectCard": 3, "dualWin": 2 },
  "conferences": ["big-ten", "acc"],
  "defaultPickMode": "duals"
}
```

The one thing worth considering is a `conference` column on `pickem_duals`. Right now duals
carry only `home_team` / `away_team` text, so filtering a slate by conference means a
client-side lookup against this dataset. A denormalized `conference TEXT` (plus maybe
`source_dual_id` pointing at an id like `big-ten-013`) would let you auto-populate a week's
slate straight from the schedule table once real dates land — which is the natural next
feature after this one.

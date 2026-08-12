# Dual Meet Pick'em (2026-27) — design notes

A second league type alongside the NCAA Championship draft. A commissioner
creates a **pool**, shares a link, and each week posts a slate of dual meets.
Members pick winners before the slate locks; standings accumulate all season.
Same product DNA as the draft: no accounts, a pool is a URL, dark/gold UI.

## Pick modes (per week, toggleable)

| Mode | What members pick | Scoring (defaults) |
|---|---|---|
| **Full Card** (`matches`) | Winner of all 10 individual matches in each dual | 1 pt per correct match, +3 for a perfect 10/10 card |
| **Duals Only** (`duals`) | Just the team winner of each dual on the slate | 2 pts per correct dual |

Scoring lives in `pickem_pools.settings_json.scoring` so a pool can tune values
later without a schema change (`matchWin`, `perfectCard`, `dualWin`).
`predicted_win_type` is reserved on the picks table for a future
"call the pin" bonus.

## Pool scope (conferences)

A pool's slate is scoped by conference: `settings_json.conferences` holds an
array of conference ids from `src/pickem/conferences.js` (the 2026-27 schedule
dataset — see `docs/dual-schedule-scale.md` for the full scale analysis).
`ConferencePicker` renders the selection UI on the create page and in the
Manage tab's Pool Scope card: presets, per-conference picks/week pricing that
follows the pick mode, a running load-band total (icon + label, not color
alone), a projected-schedule caveat, and a hard warning on Full Card +
3-plus conferences (peak weeks blow past 250 picks).

Each conference row also breaks out into a **team follow list** (chevron on
the right): `settings_json.teamScope` maps conference id → followed team ids
(no entry = all teams). A dual stays in scope when it features **at least one
followed team**, so unfollowing teams drops only their head-to-heads with
other unfollowed teams. Team-filtered load numbers are ~estimates — each
conference's weekly histogram is scaled by its kept-dual fraction
(`summarizeScopedSelection` in `schedule.js`), which also keeps undated Big
Ten duals priced honestly. The slate builder applies the same filter to its
week counts and dual lists.

## Slate builder (Manage → New Week → From Schedule)

`SlateBuilder` builds a week straight from the dataset: pick a season week
(each shows its in-scope dual count), duals pre-select with CONFIRMED /
PROJECTED badges and real dates where they exist, undated duals (all of the
Big Ten until the September release) live in a "not yet scheduled" bucket,
and title + Friday-6pm lock prefill from the week. Creation bulk-inserts the
event, duals (tagged `conference` + `source_dual_id` for later re-sync), and
scaffolded matches in Full Card mode. `src/pickem/schedule.js` dynamic-imports
the 108 KB JSON so it never ships in the main bundle. Manual week entry
remains as a fallback tab.

Scoring is commissioner-editable in the Manage tab (Scoring card); standings
recompute from raw picks, so changes apply retroactively. Pool settings load
with pool state and refresh over Realtime, so scope/scoring edits propagate
to every device without a reload. Finalized weeks show a "Week won by" banner
in Results.

## Data model (`supabase/pickem_schema.sql`)

```
pickem_pools    id (join code) · name · season · settings_json · commissioner_email
pickem_members  pool_id · name · role (commissioner|member)      ← created on join
pickem_events   pool_id · week_number · title · pick_mode · lock_at · status
pickem_duals    event_id · home/away team · scores · winner
pickem_matches  dual_id · weight · home/away wrestler · winner · win_type
pickem_picks    pool_id · member_id · (match_id XOR dual_id) · pick (home|away)
```

- Event status: `upcoming → locked → final`. Picks lock at `lock_at` or when the
  commissioner locks manually; only `final` events count in standings.
- Adding a dual in Full Card mode auto-scaffolds one match per weight class
  (125…285); wrestler names are optional flavor.
- Picks upsert on `(member_id, match_id)` / `(member_id, dual_id)` — members can
  change picks freely until lock.
- Standings are computed client-side (`src/pickem/pickemScoring.js`) — pool data
  is small, no server scoring pipeline needed (unlike the draft's global sync).

## Frontend (`src/pickem/`)

- `CreatePoolPage` → `/pickem/create` — mirrors the draft's create flow.
- `PoolPage` → `/pickem/:joinCode` — join by name (frictionless), trust-based
  rejoin list, then renders the app.
- `PickemApp` — tabs: **Make Picks · Standings · Results · Manage** (comm only).
  One Supabase Realtime channel per pool; debounced full-state reload on any
  change (picks, events, duals, matches, members).
- Sessions: `pinfall_pickem_<POOLID>` in localStorage — independent of the
  draft session, and a user can be in multiple pools at once.

## Member accounts (access codes)

Unlike the one-weekend draft, a pick'em pool runs Nov–Feb, so members have
lightweight accounts:

- **Join** = name + optional recovery email + an **access code** the member
  creates (min 4 chars, generate button). Only a salted SHA-256 hash is stored
  (`passcode_hash`/`passcode_salt` on `pickem_members`, hashed client-side via
  Web Crypto in `src/pickem/passcode.js`).
- **Commissioner backup**: on every code create/change/reset, the plaintext is
  emailed to the pool's commissioner email via `api/pickem-notify.js`
  (Resend REST; needs `RESEND_API_KEY` + `PICKEM_EMAIL_FROM`, degrades to a
  no-op without them). The endpoint **authenticates the payload server-side**
  (member must exist in the pool and the submitted code must match the stored
  hash) so the recovery channel can't be spammed or poisoned with forged
  codes by anyone holding the pool URL. This backup is the product's recovery
  model — which is why the UI tells members not to reuse a real password. The
  commissioner has **no in-UI controls** over other members' accounts; their
  power is the inbox. If the pool has no commissioner email, the UI drops the
  backup promise and pushes members toward recovery emails instead.
- **Returning device**: pick your name → enter your code (verifies against the
  hash; restores your real role, including commissioner). Sessions stay in
  per-pool localStorage as the convenience layer.
- **Forgot code**: Supabase Auth email OTP (`signInWithOtp` → `verifyOtp`,
  then sign-out — pick'em identity lives in `pickem_members`, not Auth). The
  Supabase **Magic Link email template must include `{{ .Token }}`** for the
  6-digit code to appear. Multiple members on one email (parent + kid) get a
  chooser after verification. No email on file → commissioner backup.
- **Legacy members** (rows predating accounts, NULL hash) claim a code on
  their next rejoin; the Account modal (header ⚙) lets anyone change their
  code or recovery email later.

## Security model

Permissive RLS and client-side enforcement, same as the draft product — fine
for private groups, with the same hardening roadmap (server-side writes, RLS
per role). Access codes stop casual identity mixups; they are not hardened
auth: the DB is writable with the anon key, so codes are advisory against a
motivated attacker with the pool URL. The legacy-claim step is a one-time
trust window during migration.

## Lineups are projected; picks are team sides

Decision (Aug 2026): in Full Card mode a pick is stored as `home`/`away` per
weight — the wrestler names on `pickem_matches` are the **expected matchup**,
shown as guidance and editable by the commissioner at any time (injuries,
substitutions, before or after lock). Lineup edits never touch picks: if the
projected starter doesn't wrestle, members are still locked into the team
side they chose. The picks UI and the admin match editor both say this
explicitly.

## Results archive (`/results` + Archive tab)

A public, browsable archive of every 2026-27 D1 in-conference dual — the
"one stop shop" alternative to digging through FloWrestling and eight
athletics sites. `ResultsArchive.jsx` merges two sources:

1. **the schedule dataset** — all 282 duals, so the page is a useful
   *schedule browser* before any results exist (each row is badged
   SCHEDULED vs PROJECTED), and
2. **`pickem_dual_results`** — a **global, pool-agnostic** table with one
   row per real-world dual, keyed by `source_dual_id`. Same idea as the
   draft product's `global_scores`.

Filters: conference, team (scoped to the chosen conference), week, and a
results-only toggle. Rows expand to per-bout detail when bouts are known.
Renders standalone at `/results` (no pool needed) and as the **Archive**
tab inside a pool.

### How results get into the archive

`pickem_duals` is per-pool, so three pools running Iowa–Penn State hold
three private copies. Finalizing a week calls
`api/pickem-publish-results.js`, which reads that pool's rows server-side
and upserts the duals that carry a `source_dual_id` into the global table.
Every commissioner entering results therefore crowdsources the archive —
and the same table later becomes the scraper's write target and a
slate pre-fill source.

Provenance rules (in the function):

- **Precedence** `scrape` > `manual` > `pool` — a pool report never
  overwrites a scraped row.
- A second pool **agreeing** raises `report_count` (displayed as "3×"
  confidence); a second pool **disagreeing** keeps the incumbent row and
  sets `disputed` (displayed as ⚠).
- Agreement is judged on **outcome only** (dual winner + per-bout winners),
  never on scores — consistent with the tech-fall note below.
- Writes use the service role; clients have read-only RLS.

The archive degrades gracefully: if the results table is empty or
unreachable, it still renders the full schedule with "0 with results".

### Pulling archive results into a pool

The flow also runs in reverse: in Manage, a week whose schedule-linked
duals already have archive results shows a **⇩ Pull Known Results** banner
(and each dual editor gets its own per-dual button, with the "3×"
report-count when several pools agree). Semantics are **fill-the-blanks**
(`archiveApply.js`, pure + unit-tested): the dual winner, team scores,
per-bout winners/win types and expected-lineup names each apply only where
the local value is empty — nothing a commissioner typed is ever
overwritten. One archive lookup covers all weeks; if the archive is
unreachable the buttons simply don't appear.

## Results ingestion — designed, not yet built

The plan for automating results (buildable once real 2026-27 duals exist to
test against, ~Nov 2026):

1. **Sources**: every program posts dual results on its athletics site (the
   large majority run on Sidearm Sports, which has fairly consistent
   schedule/result markup). The October dataset regen should add a per-team
   `resultsUrl` to the dataset — that's the scrape registry.
2. **Two-sided reconciliation** (the accuracy idea): every dual appears on
   BOTH teams' sites. A server function fetches both pages for duals in
   locked non-final events (matched via `source_dual_id`), parses team scores
   and per-bout lines (weight, winning side, win type), and compares:
   both agree → staged as confirmed; partial agreement → staged with gaps;
   disagreement → flagged conflict showing both versions.
3. **Commissioner review queue**: nothing auto-finalizes. Staged results
   appear in Manage with one-click apply per dual; conflicts render side by
   side. The commissioner stays the source of truth — the scraper is an
   assistant, same philosophy as the accounts model.
4. **Storage**: a pool-agnostic `pickem_result_staging` table keyed by
   `source_dual_id` (one scrape serves every pool, like the draft's
   `global_scores`), written server-side with the service role, read-only to
   clients.
5. **Why it's robust**: because picks are team sides per weight, scoring only
   needs (weight, winner side, win type) — not wrestler-name matching. The
   draft's Levenshtein matcher (`src/fuzzyMatch.js`) can still assist for
   displaying actual-vs-expected wrestlers, but scraping fragility never
   blocks scoring.

### Field notes — validated Aug 2026 against okstate.com + gostanford.com (2025-26)

Scanned Oklahoma State's Stanford dual (Nov 7, 2025) end to end on both
schools' sites. Findings that shape the scraper:

**Where the data lives (Sidearm sites):**

1. **Schedule page = dual-level source of truth.** okstate.com is Sidearm's
   Nuxt platform; the schedule page embeds a serialized state object (also
   served as `_payload.json`) with, per event: date, opponent (id, title, and
   the opponent's own athletics **website URL** — the two-source registry
   builds itself), home/away/neutral, status (including postponements), a
   result object `{status: "W", team_score: "33", opponent_score: "7"}`, and
   the recap URL. This alone fully powers **Duals Only** scoring.
2. **Recap articles = the only bout-level source.** No box scores for
   wrestling (Game Center is empty; `boxscore` is null in the state). Every
   recap ends with a structured block, one line per weight, server-rendered
   in the HTML. Home wrestlers carry `rel="smarttag"` roster links with
   stable IDs.
3. **Recap gaps are real**: OSU published no recap for its only loss (Iowa).
   The loser's site often skips the article — but the *winner's* site has it,
   which is why two sources per dual isn't just accuracy, it's coverage.

**The per-line format and its dialects** (same bout, two sites):

```
okstate.com:   125: No. 2 Troy Spratley (OSU) TF Adam Mattin (STAN), 20-5, 5:21
gostanford.com: 125: #2 Troy Spratley (OSU) tech. fall Adam Mattin (STAN), 21-5 (5:21)
```

- Shape: `WEIGHT: [rank] Winner (ABBR) TYPE [rank] Loser (ABBR), score[, time]`
- Dialects observed: `No. 2` vs `#2`; `TF`/`MD`/`dec.`/`fall` vs
  `tech. fall`/`maj. dec.`; `HWT:` vs `285:`; time as `, 5:21` vs ` (5:21)`.
  Strip rank tokens first, then normalize the type verb to our WIN_TYPES.
- Winner **team side** comes from the parenthesized abbreviation — only two
  appear per dual; map to home/away by matching against the team names.
- **A real score delta found in the wild**: OSU listed the 125 bout as 20-5,
  Stanford as 21-5 (ranks disagreed too — polls move week to week). Both
  agreed on weight, winner, side, win type, and the 33-7 dual score. Note:
  off-by-one tech-fall scores like this are *common and benign* — a tech
  fall ends the moment the 15-point margin is reached, and a riding-time
  point tallied at the conclusion may or may not make one site's final
  score. It changes nothing about the result. So: reconcile on
  (weight, winner side, win type) + dual score; treat bout scores and ranks
  as display-only and never let them block agreement — especially on TF
  lines, where a one-point spread between sources is expected noise.
- Sidearm has at least two generations in the wild (OSU's Nuxt build vs
  Stanford's older platform with different URL schemes — e.g.
  `/sports/wrestling/schedule/2025-26` 404s on Stanford). Plan for a thin
  per-site adapter that finds the schedule + recap URLs, with the line
  parser shared.

## Not built yet / ideas parking lot

- Win-type prediction bonus ("call the pin")
- Season week-win counts on the standings tab (per-week winners already show
  in Results)
- Auto-import dual results (Flo API, like the draft's sync pipeline)
- Dataset regeneration in late Sept / early Oct 2026 when real schedules
  publish (see dual-schedule-scale.md); `source_dual_id` on pool duals lets
  built slates re-sync to updated dates
- Locking picks per-dual instead of per-week (staggered start times)
- Locking picks per-dual instead of per-week (staggered start times)
- Hide others' picks until lock (currently only your own picks render anyway)

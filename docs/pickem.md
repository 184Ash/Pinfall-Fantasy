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

## Security model

Identical to the draft product (permissive RLS, join-code-as-credential) — fine
for private groups, with the same hardening roadmap. Known soft spot: the
rejoin list restores any member by tap (member role only; commissioner access
persists only via the creating device's localStorage).

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

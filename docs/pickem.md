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
- Weekly winner highlight + season week-win counts
- Commissioner-editable scoring values in the Manage tab
- Auto-import dual results (Flo API, like the draft's sync pipeline)
- Locking picks per-dual instead of per-week (staggered start times)
- Hide others' picks until lock (currently only your own picks render anyway)

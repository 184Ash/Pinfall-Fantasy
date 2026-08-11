# Pick'em Build Guide — from branch to finished product

The roadmap for taking the `pickem-pool` branch to a live 2026-27 season.
Written Aug 2026. Companion docs: [pickem.md](pickem.md) (architecture +
decisions), [dual-schedule-scale.md](dual-schedule-scale.md) (schedule data
analysis).

---

## Where things stand

**Built and pushed** (8 commits on `pickem-pool`):

- Core product: pools as URLs, weekly events → duals → matches, two pick
  modes (Full Card / Duals Only), optimistic picks with realtime sync,
  standings, results with week winners, commissioner Manage tab
- Conference scoping with per-conference **team follow lists**, load-band
  pricing, presets, Full Card guardrails
- **Slate builder**: build a week straight from the 297-dual schedule
  dataset, confirmed/projected badges, unscheduled bucket for the Big Ten
- **Member accounts**: access codes (salted hashes), commissioner email
  backups, email OTP reset, legacy claim, account modal — hardened by a
  20-agent adversarial review (15 findings fixed)
- Landing page with both league types

**Designed, not built**: results scraping + reconciliation (validated
against okstate.com/gostanford.com — see field notes in pickem.md).

**Pending infrastructure**: Supabase tables, Realtime, email template,
Resend key. That's Phase 1.

---

## Phase 1 — Stand up the backend (~30 min, do anytime)

Everything on the branch runs against Supabase infrastructure that doesn't
exist yet. In order:

1. **Create the tables.** Supabase dashboard → SQL editor → paste and run
   [supabase/pickem_schema.sql](../supabase/pickem_schema.sql) (the
   consolidated file — it already includes the conference/source columns
   and the account columns, so fresh setups skip the two migration files).
2. **Enable Realtime.** Dashboard → Database → Replication → add all six:
   `pickem_pools`, `pickem_events`, `pickem_duals`, `pickem_matches`,
   `pickem_picks`, `pickem_members`. (Forgetting `pickem_pools` silently
   breaks live scope/scoring propagation.)
3. **Email OTP template.** Dashboard → Authentication → Email Templates →
   Magic Link → make sure the body includes `{{ .Token }}` (the 6-digit
   code the forgot-code flow asks for). Keep the link too if you want.
4. **Resend key (optional but recommended).** Free account at resend.com →
   API key → set `RESEND_API_KEY` (and optionally `PICKEM_EMAIL_FROM`) in
   Vercel → Project → Settings → Environment Variables, and in `.env.local`
   for local testing. Without it everything works except commissioner
   backup emails — the UI copy adjusts automatically.
5. **Smoke test locally.** `npm run dev` → create a pool → open the pool
   link in a private window → join as a second member → make picks both
   ways → confirm they appear live on the other window.

## Phase 2 — Dry-run a full fake week (~1 hour, right after Phase 1)

Prove the whole loop before real duals exist. In a throwaway pool:

1. Manage → New Week → **From Schedule** → pick a January week → build it
   (Full Card).
2. Make picks as two members; change a pick; confirm the lock countdown.
3. Lock the week manually → verify members can no longer pick.
4. Enter results in the admin dual editor (winners + win types + dual
   score) → Finalize → check Standings points, Results ✓/✗ marks, and the
   "Week won by" banner.
5. Test the account loop: sign out (Account modal) → rejoin by name + code
   → forgot-code email reset (needs a real email on the member).
6. Test the scoring editor: change `matchWin` → standings recompute.
7. Delete the test week and pool data when done.

Anything that feels wrong here is a bug worth fixing before November —
file it while it's cheap.

## Phase 3 — Late Sept/Oct 2026: real schedule data

The dataset was built in August when only 28 of 282 duals had dates
([dual-schedule-scale.md](dual-schedule-scale.md) has per-conference
release timing — Big Ten dates drop ~Sept 23-29).

1. **Re-scrape and regenerate** `src/pickem/data/ncaa-d1-duals-2026-27.json`
   and `src/pickem/conferences.js` (generated file — never hand-edit).
   Priorities from the analysis: Pac-12 (weakest block — verify the round
   robin actually happened), the 14 derived Big Ten pairings, MAC counts.
2. **Add a per-team `resultsUrl`** (athletics-site wrestling page) to the
   dataset — this becomes the scraper registry in Phase 4.
3. A second pass in **early November** catches BTN/ESPN broadcast
   assignments, which is what makes the "Televised" preset honest.
4. Sanity-check the slate builder afterward: the Big Ten "not yet
   scheduled" bucket should drain into dated weeks.

## Phase 4 — November: the results pipeline

Build the scraper once real 2025-26-style results pages exist for 2026-27
(first duals Nov 9). The design is validated — see the field notes in
[pickem.md](pickem.md). Build order:

1. **Staging table** — pool-agnostic, keyed by `source_dual_id` (one scrape
   serves every pool, like the draft's `global_scores`):
   ```sql
   CREATE TABLE pickem_result_staging (
     source_dual_id TEXT PRIMARY KEY,
     home_score INT, away_score INT, winner TEXT,
     bouts_json JSONB,          -- [{weight, winner, win_type}]
     sources TEXT[],            -- which sites contributed
     sources_agree BOOLEAN,
     conflict_json JSONB,       -- both versions when they disagree
     scraped_at TIMESTAMPTZ DEFAULT now()
   );
   -- service_role writes; anon read-only (policy like global_scores)
   ```
2. **Serverless function** `api/sync-pickem-results.js` — for duals in
   locked, non-final events with a `source_dual_id`: fetch both teams'
   pages, parse, reconcile, upsert staging rows.
3. **Per-site adapters, shared parser.** Two Sidearm generations exist
   (okstate = Nuxt with `_payload.json` schedule state; Stanford = older
   platform, different URLs). Adapter finds the schedule + recap URLs;
   one shared regex parses the per-weight lines. Normalization table:
   `dec./dec → DEC`, `MD/maj. dec. → MD`, `TF/tech. fall → TD`,
   `fall/pinned → F`, plus FFT/INJ/DQ. Strip rank tokens (`No. 2`, `#2`)
   first. `HWT:` = 285.
4. **Reconciliation rule** (from the field notes): agree on
   (weight, winner side, win type) + dual score → auto-stage as confirmed.
   Bout scores and rankings are display-only — off-by-one TF scores are
   expected noise (riding time at the buzzer), never a conflict.
5. **Commissioner review queue** in Manage: staged results per dual with
   one-click Apply; conflicts render both versions side by side. Nothing
   auto-finalizes — the commissioner stays the source of truth.
6. Test live against the first real weekend, tune the parser, then wire a
   Vercel cron (or keep it button-triggered like the draft's sync).

## Phase 5 — Hardening (before opening beyond your own group)

In priority order, from the code-review backlog:

1. **Server-side write authorization** — the big one. RLS is wide open, so
   any client with the pool URL can technically write results or others'
   picks. Move pick-writes and admin mutations behind serverless functions
   that validate member id + lock state, then tighten RLS. (Same roadmap
   item as the draft product.)
2. **Lock enforcement in the DB** — a trigger or RPC rejecting pick writes
   after `lock_at` closes the obvious cheat without waiting for #1.
3. **Duplicate join names** — reject a second "Jake" per pool at join.
4. **Scoring tests** — `pickemScoring.js`, `summarizeScopedSelection`, and
   the future results parser are pure functions; a small vitest suite
   prevents scoring disputes mid-season.
5. **Code-split the two products** — `React.lazy` per route; the shared
   bundle is ~675 KB because draft + pick'em load together.
6. **Commissioner recovery parity** — the recovery email is stored but has
   no magic-link flow like the draft side; wire it or drop the field.

## Phase 6 — Launch

**Merge checklist** (merging to `main` puts the pick'em button on the live
landing page — `PICKEM_CREATION_OPEN` is already `true`):

- [ ] Phase 1 infrastructure done in the *production* Supabase project
- [ ] Vercel env vars set (Resend key)
- [ ] Dry-run week completed on the preview deployment
- [ ] October dataset regen landed (or accept projected-only slates)
- [ ] Open a PR from `pickem-pool` for a final full-diff review, merge

**Season operating rhythm** (the commissioner's week):

| Day | Action |
|---|---|
| Mon/Tue | Build next week's slate from the schedule (5 min with the builder) |
| Fri ~6pm | Picks lock (prefilled default; adjust for Thu MAC duals) |
| Sat/Sun | Results land — scraper stages them (Phase 4) or enter manually (~2 min/dual) |
| Sun/Mon | Finalize → standings update, week winner crowned |

**Season calendar**: first duals Nov 9 · Nov/Dec is sparse (consider
seeding non-conference marquees — Iowa–Iowa State, CKLV) · dead week Dec 21
· the wall: **Jan 4 – Feb 21 is 89% of the season** · natural finale
Feb 21 → flip the pool read-only and crown the champion (a season-archive
state like the draft's off-season mode is a small build).

## Feature backlog (ideas, prioritized)

**High value, low effort — do during the season:**

- **Pick deadline reminders** — Vercel cron emails members with missing
  picks a few hours before lock. The #1 killer of season pools is silent
  no-shows.
- **Show the field after lock** — "7 of 9 took Iowa" per dual. Trash-talk
  fuel; picks stay hidden before lock.
- **Week-win counts on Standings** — the Results tab already crowns weekly
  winners; tally them in a column.
- **Best-pick-rate trophy** — accuracy % alongside total points, so a
  missed week doesn't end someone's season.

**Medium:**

- **"Call the pin" bonus** — predict the win type for +1
  (`predicted_win_type` column is already reserved on picks).
- **Survivor side-pot** — one dual winner per week, can't reuse a team;
  cheap to build on existing tables.
- **Per-dual locks** — `lock_at` per dual instead of per week, for
  Thursday MAC duals vs Sunday B1G duals in the same slate.
- **Non-conference marquee support in the dataset** — fixes the empty
  Nov/Dec problem properly.

**Bigger swings:**

- **March product** — the season ends Feb 21; conference tournaments and
  NCAAs are bracket-shaped, and the draft product already owns March. A
  "season pass" that chains pick'em → draft league is the natural arc.
- **Multi-pool profiles** — one identity across pools (the per-pool
  session/account design deliberately doesn't block this later).

---

*Everything referenced lives on the `pickem-pool` branch. Regenerate the
schedule dataset before trusting any of its dates; the projected-vs-
confirmed badges in the slate builder tell you which is which.*

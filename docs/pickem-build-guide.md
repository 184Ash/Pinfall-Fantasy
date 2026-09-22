# Pick'em Build Guide — from branch to finished product

The roadmap for taking the `pickem-pool` branch to a live 2026-27 season.
Written Aug 2026, **updated Sept 21, 2026**. Companion docs:
[pickem.md](pickem.md) (architecture, decisions, field notes),
[dual-schedule-scale.md](dual-schedule-scale.md) (August schedule analysis),
[pickem-dashboard-brief.md](pickem-dashboard-brief.md) (dashboard design brief).

---

## Where things stand (Sept 21)

**Built and pushed** (12 commits on `pickem-pool`):

- Core product: pools as URLs, weekly events → duals → matches, Full Card /
  Duals Only pick modes, optimistic picks with realtime sync, standings,
  results with week winners, commissioner Manage tab
- Conference scoping with per-conference **team follow lists**, load-band
  pricing, presets, Full Card guardrails
- **Slate builder**: build a week from the schedule dataset with
  confirmed/projected badges and an unscheduled bucket
- **Member accounts**: access codes (salted hashes), commissioner email
  backups via `api/pickem-notify.js`, email OTP reset, legacy claim, account
  modal — hardened by a 20-agent adversarial review (15 findings fixed)
- **Global results archive** (`pickem_dual_results`, one row per real-world
  dual, provenance `scrape > manual > pool`, `report_count`, `disputed`),
  the public `/results` page + Archive tab, and **pull-known-results** in
  Manage (fill-the-blanks, unit-tested planner in `archiveApply.js`)

**Live on `main`**: the landing page teaser — Dual Meet Pick'em "Coming Soon"
card and the draft card's Stay Tuned modal (March 18–20, 2027, St. Louis).
No 2026-league references remain anywhere.

**Infrastructure — done this month** (production Supabase project
`ftmggbebgvxwuuucptpb`, now on Pro):

- All 7 `pickem_*` tables created; columns verified over REST
- Realtime enabled on the six live tables (archive correctly excluded)
- Magic Link email template carries `{{ .Token }}`
- Legacy JWT keys were disabled by the Pro upgrade → publishable key set in
  `.env.local` and all three Vercel environments; new secret key in
  production + preview; production redeployed and its bundle verified
- Database-layer smoke test passed (pool + hashed member round trip;
  archive rejects anonymous writes; cascade cleanup)
- Vercel CLI installed and logged in; `pickem-pool` preview deploys with the
  new keys (previews sit behind Vercel's login wall — see Phase 2)

**Schedule tooling** (in `scripts/schedules/`, not yet committed):
`scrape-duals.mjs` with `fetch` / `parse` / `composites` / `compare` stages.
Sept 21 run: 34 of 77 programs posted, 325 distinct duals, 166 in-conference,
every site parsed through a structured source (Sidearm-Nuxt, WMT, classic
Sidearm, JSON-LD — no text fallback). Findings are in Phase 3 below.

**Still open**: Resend key + custom SMTP (optional), the UI dry-run week,
the October dataset regeneration, and the results pipeline.

---

## Phase 1 — Backend — DONE

Only the optional email piece remains:

- **Resend** (free tier): API key → `vercel env add RESEND_API_KEY
  production` and `… preview` (paste at the prompt; the value never needs
  to pass through a chat), plus `.env.local`. Then Supabase → Authentication
  → Emails → **SMTP Settings** → host `smtp.resend.com`, port `465`, user
  `resend`, password = the API key. One account then serves both the
  commissioner backup emails and the OTP codes, and the built-in mailer's
  few-per-hour limit disappears. Until the `pinfallfantasy.com` domain is
  verified in Resend, it only delivers to your own address — fine for
  testing, do the verification before real members join.

## Phase 2 — Dry-run a full fake week (~1 hour) — PENDING

Prove the whole loop on real infrastructure. Two ways to run it:

- **Locally** (`npm run dev`) against production — test pools are cheap to
  delete afterward.
- **On the preview deployment** — realistic (phones, other people), but
  Deployment Protection means members hit a Vercel login. Either disable
  "Vercel Authentication" for previews in Settings → Deployment Protection
  (the URLs are unguessable anyway) or use a per-deployment Share link.

The script, in a throwaway pool:

1. Manage → New Week → **From Schedule** → a January week → build (Full Card).
2. Make picks as two members; change a pick; confirm the lock countdown.
3. Lock manually → verify members can no longer pick.
4. Enter results (winners, win types, dual score) → Finalize → check
   Standings, Results ✓/✗, and the "Week won by" banner.
5. **Archive loop**: `/results` should show the finalized duals. Create a
   second test pool, build the same week, and confirm the ⇩ Pull Known
   Results banner fills it — the one flow that couldn't be exercised from
   the sandbox.
6. Account loop: sign out → rejoin by name + code → forgot-code email reset
   (needs a real email on the member).
7. Scoring editor: change `matchWin` → standings recompute.
8. Delete the test pools.

## Phase 3 — Schedule data: now through October

### What the Sept 21 scrape established

| Conf | Posted | In-conf duals | Pairings vs projection | Venue flips | Composite |
|---|---|---|---|---|---|
| ACC | 3 (+ composite has UNC, VT) | 15 | 15/15 | 0 | partial (2 of 7 members) |
| Big 12 | 3 (+UNI partial) | 21 | 21/21 | 2 | feed empty |
| Pac-12 | 5 | 30 | 30/30 | **11** | feed empty |
| SoCon | 3 | 22 | 22/22 | 0 | 2027 page empty |
| Ivy | 1 | 5 | 5/5 | 0 | none |
| EIWA | 5 | 27 | 25/27 (+2 crossovers, −2) | 1 | none (404) |
| MAC | 6 | 38 | 38/38 | 4 | **full** (40 duals) |
| Big Ten | 7 partial | 8 (Purdue, placeholder dates) | 8/8 | 0 | 2027 page empty |

- **Pairings are right.** 160 of 162 in-conference duals were in the
  projection; the round-robin inference held everywhere it applied.
- **Pac-12 is a full 9-team round robin** — five posted teams each list
  exactly 8 conference duals against the other 8 members; 30 distinct duals
  is exactly 5×8 − 10. The composite feed exists but is empty, so this rests
  on school pages — which the MAC composite validated at 100% on venues.
- **Venues are the projection's weak spot**, concentrated in the Pac-12
  (11 of 30 flipped: the "flip last year's venue" heuristic had nothing to
  flip for a rebuilt league). Elsewhere: MAC 4, Big 12 2, EIWA 1, others 0.
  The MAC composite confirmed every flip the scrape reported.
- **MAC is fuller than projected**: five "unlikely" pairings are scheduled
  (George Mason at SIUE, GMU at Kent State, Bloomsburg at SIUE, SIUE at
  Rider, Clarion at CMU); posted MAC schools show 8–9 conference duals each.
  Five projected pairings are absent (Ohio at Bloomsburg, GMU at Rider, GMU
  at Clarion, CMU at GMU; SIUE at CMU is on SIUE's page but not the composite).
- **EIWA crossovers moved**: Navy–Drexel and Bucknell–Binghamton exist but
  weren't projected; Morgan State's projected duals at Drexel and Hofstra
  aren't on its schedule.
- **Projected weeks were guesses** where no dates existed (Big 12 3/21,
  Pac-12 7/30 in the projected week) and decent where they did (EIWA 18/25,
  Ivy 5/5). Real dates now exist for 166 in-conference duals vs 28 in August.
- **Big Ten**: Purdue's 8 conference duals carry placeholder dates Jan 1–8
  (one per day) — pairings and venues match the June rotation; ignore the
  dates. The conference's composite 2027 page exists but held 0 games.
- Two school-page disagreements to resolve by hand: Little Rock–Air Force
  Nov 20 (each lists itself away) and NDSU–Air Force (Jan 29 vs Jan 30).
- **Big 12 announced a Nov 7 start** — the dataset's week axis begins with
  the week of Nov 9 (2026-W46). The regen must extend `WEEK_AXIS` back one
  week (2026-W45, Nov 2–8) or early duals fall off the slate builder.

### The weekly loop (5 minutes, until the season starts)

```
cd scripts/schedules
node scrape-duals.mjs fetch --only=<slug>   # for each newly UPDATED school
node scrape-duals.mjs parse
node scrape-duals.mjs composites --refetch  # ACC/MAC feeds; Big 12/Pac-12 when they populate
node scrape-duals.mjs compare
```

New schools come from the Flo tracker's row-by-row UPDATED markers
(flowrestling.org/articles/16117397); add a line to `SCHOOLS`, using the
dataset team id as the slug where it differs. Watch for: Big Ten dates (the
partial flags flip to UPDATED), the Big 12 and Pac-12 composite feeds
populating, and the SoCon/Big Ten 2027 pages filling in.

### The regeneration script — to build (JS, alongside the scraper)

`scripts/schedules/regen-dataset.mjs` merges scrape + composite into a new
`ncaa-d1-duals-2026-27.json` and regenerates `conferences.js`. Rules:

1. **Preserve dual ids.** `source_dual_id` links pool duals and the archive
   to the dataset — never renumber. Match scraped duals to existing rows by
   unordered pairing; only genuinely new pairings get new ids.
2. Per matched row: set `home`/`away` from the best source (composite >
   school scrape), `date`, `week` (ISO tag), `status: 'confirmed'`,
   `confidence: 'official'`. Flip `probability: 'unlikely'` → `'scheduled'`
   when seen. Leave unseen rows as projected; mark projected pairings that a
   fully-posted school contradicts as `'unlikely'`.
3. Add a per-team `resultsUrl` (the athletics schedule page — the scraper's
   `SCHOOLS` urls are the seed) for Phase 4.
4. Rebuild each conference's `weeklyDuals` histogram from real dates where
   they exist, projected placement otherwise; recompute `dualCount`,
   `confirmedDateCount`, `scheduleMaturity`.
5. Extend `WEEK_AXIS` to start at 2026-W45.
6. Emit `conferences.js` from the same data (it is generated — never
   hand-edit), then run `node scrape-duals.mjs compare` again: it should
   report zero flips and zero missing pairings against the new dataset.

Language note: the August plan put Python on the tooling side. The scraper
grew in JS because it shares the canonical team-name logic and the
per-CMS parsers, and the regen is a merge over that same data — keeping it
JS avoids a second copy of the canonicalization. Python remains the right
tool for any ad-hoc analysis (pandas over the CSV), not for the pipeline.

### Early November

A second pass catches BTN/ESPN broadcast assignments (what makes the
"Televised" preset honest) and the final stragglers.

## Phase 4 — November: the results pipeline

Build once real 2026-27 results pages exist (first duals Nov 7). Design is
validated — field notes in [pickem.md](pickem.md). Since the guide was
written, two pieces already exist:

- **The staging table is `pickem_dual_results`** with provenance
  (`source: scrape > manual > pool`, `report_count`, `disputed`). The scraper
  writes rows with `source: 'scrape'` and they automatically outrank
  commissioner entries.
- **The review/apply step is the pull-known-results banner** — staged
  results reach a pool through it, fill-the-blanks, commissioner-confirmed.

What's left to build, in order:

1. `api/sync-pickem-results.js` — for duals in locked, non-final events with
   a `source_dual_id`: fetch both teams' pages, parse, reconcile, upsert.
2. **Sources.** Recap articles on school sites (the bout-level source — the
   per-weight line format is documented with its dialects). Reuse the
   scraper's per-CMS adapters to find recap links: Nuxt sites expose the
   recap URL in their schedule state, WMT and classic Sidearm in markup.
   For Big Ten and SoCon, the conference composite JSON carries team-level
   results (`results.away_points/home_points`) — a clean dual-winner source
   for Duals Only pools even before bout parsing works.
3. **Reconciliation**: agree on (weight, winner side, win type) + dual score
   → confirmed. Bout scores and rankings are display-only; off-by-one TF
   scores are expected noise. Disagreement → `disputed`, both versions kept.
4. Test on the first real weekend, then cron it (or keep it button-driven
   like the draft's sync).

FloArena's event-hub is **not** a discovery source (per-event objects only,
no list/search) — don't spend time there.

## Phase 5 — Hardening (before opening beyond your own group)

Unchanged, in priority order:

1. **Server-side write authorization** — RLS is wide open; move pick writes
   and admin mutations behind serverless functions validating member id +
   lock state, then tighten RLS.
2. **Lock enforcement in the DB** — trigger or RPC rejecting picks after
   `lock_at`.
3. **Duplicate join names** — reject a second "Jake" per pool.
4. **Scoring tests** — `pickemScoring.js`, `summarizeScopedSelection`,
   `archiveApply.js` (already node-tested informally) → a small vitest suite.
5. **Code-split the two products** — `React.lazy` per route (~715 KB bundle).
6. **Commissioner recovery parity** — wire the stored recovery email to a
   magic-link flow or drop the field.

## Phase 6 — Launch

**Merge checklist** (merging to `main` swaps the Coming Soon card for the
live button — `PICKEM_CREATION_OPEN` is already `true`):

- [x] Production Supabase tables, Realtime, email template, keys
- [ ] Resend key in Vercel (optional)
- [ ] Dry-run week completed
- [ ] October dataset regen landed
- [ ] **Resolve the `LandingPage.jsx` conflict** — `main` has the teaser
      version, the branch has the live-CTA version. Keep the branch's live
      pick'em card and `main`'s Stay Tuned modal on the draft card.
- [ ] Open a PR from `pickem-pool` for a final full-diff review, merge

**Season operating rhythm** (the commissioner's week):

| Day | Action |
|---|---|
| Mon/Tue | Build next week's slate from the schedule (5 min) |
| Fri ~6pm | Picks lock (prefilled default; adjust for Thu MAC duals) |
| Sat/Sun | Results land — scraper stages them (Phase 4) or enter manually (~2 min/dual) |
| Sun/Mon | Finalize → standings update, week winner crowned, archive updated |

**Season calendar**: first duals **Nov 7** (Big 12) · Nov/Dec is sparse ·
dead week Dec 21 · the wall: **Jan 4 – Feb 21 is ~89% of the season** ·
finale Feb 21 → flip the pool read-only and crown the champion (a
season-archive state like the draft's off-season mode is a small build).

## Feature backlog (ideas, prioritized)

**High value, low effort — during the season:**

- **Pick deadline reminders** — Vercel cron emails members with missing
  picks before lock. The #1 killer of season pools is silent no-shows.
- **Show the field after lock** — "7 of 9 took Iowa" per dual.
- **Week-win counts on Standings** — Results already crowns weekly winners.
- **Best-pick-rate trophy** — accuracy % alongside total points.
- **League + member dashboards** — the design brief is written
  ([pickem-dashboard-brief.md](pickem-dashboard-brief.md)); every metric in
  it computes client-side from `loadPoolState()`.

**Medium:**

- **"Call the pin" bonus** (`predicted_win_type` is reserved on picks).
- **Survivor side-pot** — one dual winner per week, no team reuse.
- **Per-dual locks** — Thursday MAC duals vs Sunday B1G duals in one slate.
- **Non-conference marquee duals in the dataset** — the scraper already
  captures 141 non-conference D1 duals; the dataset is in-conference only.

**Bigger swings:**

- **March product** — pick'em → draft league as a "season pass".
- **Multi-pool profiles** — one identity across pools.

---

*Everything referenced lives on the `pickem-pool` branch. The dataset's
dates are projections until the October regen lands; the slate builder's
CONFIRMED/PROJECTED badges tell you which is which.*

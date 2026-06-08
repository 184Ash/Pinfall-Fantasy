<p align="center">
  <img src="./pinfall-fantasy-logo.png" width="110" alt="Pinfall Fantasy logo" />
</p>

<h1 align="center">Pinfall Fantasy</h1>

<p align="center">A real-time fantasy draft game for the NCAA Division I Wrestling Championships.</p>

---

## What it is

Pinfall Fantasy turns the NCAA D1 wrestling tournament into a live fantasy draft. A
commissioner spins up a league, players join from a shareable link and snake-draft
wrestlers across all ten weight classes, then watch standings update **in real time** as
tournament results come in — scored automatically from the live bracket.

No accounts and no install: a league *is* a URL.

## Screenshot

> _Live draft-board screenshot coming soon — drop a PNG at `docs/screenshot.png` and uncomment the line below._
>
> <!-- ![Pinfall Fantasy draft board](docs/screenshot.png) -->

## Features

- **Live snake draft** with real-time sync across every participant's device
- **Automated scoring** straight from the live tournament bracket (advancement, bonus, placement points)
- **Standings, rosters, and a draft board** that update without a refresh
- **Commissioner tools**: draft order, on-the-clock timer, settings, team reassignment, danger zone
- **Magic-link recovery** for commissioners (Supabase Auth) so a closed tab never means lost access

## Architecture

**Stack:** React 18 · Vite · React Router · Supabase (Postgres + Realtime) · Vercel (static hosting + serverless function)

The interesting part is the scoring pipeline:

1. **Bracket pull** — a Vercel serverless function (`api/sync-scores.js`) pulls live brackets and
   placements for all 10 weight classes from the FloArena / FloWrestling event API (`src/twClient.js`).
2. **Roster matching** — bracket participant names are matched to each league's drafted wrestlers with a
   **Levenshtein-distance** fuzzy matcher (`src/fuzzyMatch.js`) that normalizes names and falls back to
   last-name comparison, absorbing the spelling and formatting differences between data sources.
3. **Scoring** — `src/scoringEngine.js` turns each wrestler's wins, advancement, and final placement into
   fantasy points.
4. **Fan-out** — results are upserted into a shared `global_scores` table (keyed by weight + seed, ~330 rows)
   using the server-only `service_role` key, so every league updates from one sync.
5. **Real-time** — clients subscribe to Supabase Realtime channels (`picks`, `global_scores`, league
   settings, rejoin requests), so the draft and standings update live on every connected device.

```
FloArena event API ──▶ sync-scores (Vercel fn) ──▶ Levenshtein match ──▶ scoring engine
                                                                               │
   browsers ◀── Supabase Realtime ◀───────────────── global_scores (upsert) ◀──┘
```

### Data model

Postgres tables: `leagues`, `teams`, `wrestlers`, `picks`, `points`, `global_scores`, `sync_meta`,
`rejoin_requests`. The browser client uses the public **anon** key; the sync function uses the
**service_role** key server-side only. Schema lives in [`supabase/`](supabase/).

### Security model

Pinfall Fantasy was built as a gated, single-tournament tool for a private group, so it deliberately
keeps joining frictionless: there are **no user accounts** — a league's URL (join code) plus browser
session storage is the credential, and data access is governed by Supabase **Row-Level Security**. The
trade-off, and a tracked hardening item, is that fine-grained authorization is currently lightweight; a
multi-tenant production version would move privileged writes behind server-side functions and tighten RLS
per role. See [Roadmap](#roadmap).

## Local setup

```bash
git clone https://github.com/184Ash/Pinfall-Fantasy.git
cd Pinfall-Fantasy
npm install
cp .env.example .env.local      # then fill in your own Supabase values
npm run dev                     # http://localhost:5173
```

1. Create a free [Supabase](https://supabase.com) project.
2. Run the SQL in [`supabase/`](supabase/) in the Supabase SQL editor to create the schema.
3. Copy your project URL and keys into `.env.local` (see [`.env.example`](.env.example)).
   `VITE_*` are the public client keys; `SUPABASE_SERVICE_ROLE_KEY` is **server-only** (used by
   `api/sync-scores.js`) — never prefix it with `VITE_`, or Vite will inline it into the public bundle.

## Roadmap

- Server-side write authorization (move privileged mutations behind serverless functions; tighten RLS per role)
- Mobile-first draft board layout
- Scheduled automatic score sync
- Historical league archive (read-only past seasons)

---

<p align="center"><sub>Built by <a href="https://github.com/184Ash">@184Ash</a> · React · Supabase · Vercel</sub></p>

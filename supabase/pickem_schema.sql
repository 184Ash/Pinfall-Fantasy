-- ============================================================================
-- Pinfall Pick'em — 2026-27 dual-meet pick'em pool schema
-- Run this in the Supabase SQL editor (in addition to schema.sql).
--
-- Product model:
--   A commissioner creates a POOL (join code = URL, same no-accounts model as
--   the draft product). Each week the commissioner publishes an EVENT (a slate)
--   containing one or more DUALS. Two pick modes per event:
--     - 'matches' (Full Card): each dual carries its 10 individual MATCHES and
--       members pick the winner of every match.
--     - 'duals'   (Duals Only): members just pick the team winner of each dual.
--   Picks lock at event.lock_at (or when the commissioner locks manually).
--   The commissioner enters results; standings are computed client-side from
--   picks + results using the pool's scoring settings (settings_json.scoring).
--
-- SECURITY MODEL: identical to schema.sql — join code + browser session
-- storage is the credential, anon key talks to the DB directly, RLS is
-- intentionally permissive. Fine for a private-group pool, not multi-tenant
-- hardened. Same roadmap caveats apply.
-- ============================================================================

-- ── Core tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pickem_pools (
  id                 TEXT PRIMARY KEY,            -- 5-char join code
  name               TEXT NOT NULL,
  season             TEXT NOT NULL DEFAULT '2026-27',
  settings_json      JSONB NOT NULL DEFAULT '{}', -- scoring config, defaults, flags
  commissioner_email TEXT,                        -- optional, for recovery parity
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members join by opening the pool link and entering a display name — a row is
-- created on join (no pre-created slots like the draft product's teams table).
CREATE TABLE IF NOT EXISTS pickem_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id    TEXT NOT NULL REFERENCES pickem_pools(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',      -- commissioner | member
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pickem_members_pool_id_idx ON pickem_members(pool_id);

-- One event = one week's slate of duals.
CREATE TABLE IF NOT EXISTS pickem_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id     TEXT NOT NULL REFERENCES pickem_pools(id) ON DELETE CASCADE,
  week_number INT  NOT NULL,
  title       TEXT NOT NULL,                     -- e.g. "Week 5 — Iowa at Penn State"
  pick_mode   TEXT NOT NULL DEFAULT 'matches',   -- matches (full card) | duals (team winners)
  lock_at     TIMESTAMPTZ,                       -- picks lock at this time
  status      TEXT NOT NULL DEFAULT 'upcoming',  -- upcoming | locked | final
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pickem_events_pool_id_idx ON pickem_events(pool_id);

CREATE TABLE IF NOT EXISTS pickem_duals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES pickem_events(id) ON DELETE CASCADE,
  dual_order INT  NOT NULL DEFAULT 1,
  home_team  TEXT NOT NULL,
  away_team  TEXT NOT NULL,
  home_score INT,                                -- final team score (display)
  away_score INT,
  winner     TEXT                                -- home | away | tie | NULL = no result yet
);
CREATE INDEX IF NOT EXISTS pickem_duals_event_id_idx ON pickem_duals(event_id);

-- Individual bouts within a dual ('matches' mode). One per weight class.
CREATE TABLE IF NOT EXISTS pickem_matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dual_id       UUID NOT NULL REFERENCES pickem_duals(id) ON DELETE CASCADE,
  match_order   INT  NOT NULL DEFAULT 1,
  weight        INT  NOT NULL,
  home_wrestler TEXT,
  away_wrestler TEXT,
  winner        TEXT,                            -- home | away | NULL = no result yet
  win_type      TEXT                             -- DEC | MD | TD | F | FFT | INJ | DQ (display / future bonus)
);
CREATE INDEX IF NOT EXISTS pickem_matches_dual_id_idx ON pickem_matches(dual_id);

-- A pick targets exactly one match (matches mode) or one dual (duals mode).
CREATE TABLE IF NOT EXISTS pickem_picks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id            TEXT NOT NULL REFERENCES pickem_pools(id)   ON DELETE CASCADE,
  member_id          UUID NOT NULL REFERENCES pickem_members(id) ON DELETE CASCADE,
  match_id           UUID REFERENCES pickem_matches(id) ON DELETE CASCADE,
  dual_id            UUID REFERENCES pickem_duals(id)   ON DELETE CASCADE,
  pick               TEXT NOT NULL,               -- home | away
  predicted_win_type TEXT,                        -- reserved for a future win-type bonus
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((match_id IS NULL) <> (dual_id IS NULL)) -- exactly one target
);
CREATE INDEX IF NOT EXISTS pickem_picks_pool_id_idx   ON pickem_picks(pool_id);
CREATE INDEX IF NOT EXISTS pickem_picks_member_id_idx ON pickem_picks(member_id);
-- One pick per member per target (upsert on change). Plain (non-partial)
-- unique indexes: NULLs are distinct, so dual-picks (NULL match_id) never
-- collide on the match index and vice versa — and PostgREST's upsert
-- on_conflict inference requires non-partial indexes.
CREATE UNIQUE INDEX IF NOT EXISTS pickem_picks_member_match_uq
  ON pickem_picks(member_id, match_id);
CREATE UNIQUE INDEX IF NOT EXISTS pickem_picks_member_dual_uq
  ON pickem_picks(member_id, dual_id);

-- ── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE pickem_pools   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickem_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickem_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickem_duals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickem_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickem_picks   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pickem_pools_rw"   ON pickem_pools   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pickem_members_rw" ON pickem_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pickem_events_rw"  ON pickem_events  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pickem_duals_rw"   ON pickem_duals   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pickem_matches_rw" ON pickem_matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pickem_picks_rw"   ON pickem_picks   FOR ALL USING (true) WITH CHECK (true);

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enable via Supabase Dashboard → Database → Replication, or uncomment:
-- ALTER PUBLICATION supabase_realtime ADD TABLE pickem_events, pickem_duals, pickem_matches, pickem_picks, pickem_members;

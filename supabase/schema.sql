-- ============================================================================
-- Pinfall Fantasy — consolidated database schema
-- Run this once in the Supabase SQL editor to stand up a fresh project.
-- (The other *.sql files in this folder are the historical incremental
--  migrations this schema consolidates; you only need this file for setup.)
--
-- SECURITY MODEL — please read:
--   This app has no user accounts. A league's join code (URL) + browser
--   session storage is the only credential, and the browser talks to the
--   database directly with the public anon key. The Row-Level Security
--   policies below are therefore intentionally permissive ("Option 1":
--   gated single-tournament tool for a private group). They are adequate
--   for throwaway, single-event data but are NOT hardened for multi-tenant
--   use: any client with a league id can read/modify that league's rows.
--   Hardening (move privileged writes behind serverless functions using the
--   service_role key, and tighten these policies per role) is on the roadmap.
-- ============================================================================

-- ── Core tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leagues (
  id                 TEXT PRIMARY KEY,            -- 5-char join code
  name               TEXT NOT NULL,
  settings_json      JSONB NOT NULL DEFAULT '{}', -- draftOrder, rotationType, flags, etc.
  commissioner_email TEXT,                        -- optional, for magic-link recovery
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name           TEXT,
  draft_position INT,
  role           TEXT NOT NULL DEFAULT 'member',  -- commissioner | co_commissioner | member
  is_claimed     BOOLEAN NOT NULL DEFAULT false,
  claimed_by     TEXT,
  claimed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS teams_league_id_idx ON teams(league_id);

CREATE TABLE IF NOT EXISTS wrestlers (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  weight    INT  NOT NULL,
  seed      INT  NOT NULL,
  name      TEXT NOT NULL,
  school    TEXT
);
CREATE INDEX IF NOT EXISTS wrestlers_league_id_idx ON wrestlers(league_id);

CREATE TABLE IF NOT EXISTS picks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  wrestler_id UUID NOT NULL REFERENCES wrestlers(id) ON DELETE CASCADE,
  is_bonus    BOOLEAN NOT NULL DEFAULT false,
  picked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS picks_league_id_idx ON picks(league_id);

CREATE TABLE IF NOT EXISTS points (
  league_id   TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  wrestler_id UUID NOT NULL REFERENCES wrestlers(id) ON DELETE CASCADE,
  pts         NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (league_id, wrestler_id)
);

CREATE TABLE IF NOT EXISTS rejoin_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending',     -- pending | approved
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rejoin_requests_league_id_idx ON rejoin_requests(league_id);

-- ── Global scoring (shared across all leagues; written only by the server) ────
-- One row per physical wrestler slot (weight + seed), ~330 rows total.
CREATE TABLE IF NOT EXISTS global_scores (
  weight     INT NOT NULL,
  seed       INT NOT NULL,
  pts        NUMERIC NOT NULL DEFAULT 0,
  status     TEXT,                                -- bracket status string for display
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (weight, seed)
);

-- Single-row table tracking the last successful sync (15-min cooldown + display).
CREATE TABLE IF NOT EXISTS sync_meta (
  id             INT PRIMARY KEY DEFAULT 1,
  last_synced_at TIMESTAMPTZ,
  synced_by      TEXT
);
INSERT INTO sync_meta (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Row-Level Security ───────────────────────────────────────────────────────
-- Permissive policies for the no-accounts model (see SECURITY MODEL note above).
-- Anon may read/write league data; global_scores & sync_meta are read-only to
-- anon (the serverless sync function writes them with the service_role key,
-- which bypasses RLS).

ALTER TABLE leagues         ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrestlers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE points          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejoin_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_meta       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leagues_rw"         ON leagues         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "teams_rw"           ON teams           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "wrestlers_rw"       ON wrestlers       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "picks_rw"           ON picks           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "points_rw"          ON points          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "rejoin_requests_rw" ON rejoin_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "global_scores_read" ON global_scores   FOR SELECT USING (true);
CREATE POLICY "sync_meta_read"     ON sync_meta       FOR SELECT USING (true);

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- The app subscribes to live changes on these tables. Enable Realtime via
-- Supabase Dashboard → Database → Replication, or uncomment below:
-- ALTER PUBLICATION supabase_realtime ADD TABLE leagues, teams, picks, points, global_scores, rejoin_requests;

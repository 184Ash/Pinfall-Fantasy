-- ============================================================================
-- Pick'em migration: GLOBAL dual results archive.
-- Run in the Supabase SQL editor if pickem_schema.sql was applied before this
-- migration existed (the consolidated pickem_schema.sql includes it).
--
-- WHY THIS TABLE EXISTS
--   pickem_duals rows are per-pool: if three pools each run Iowa at Penn State,
--   there are three copies with three separately-entered results. This table is
--   the pool-agnostic archive — ONE row per real-world dual, keyed by the
--   schedule dataset's dual id (src/pickem/data/ncaa-d1-duals-2026-27.json).
--   Same shape of idea as the draft product's global_scores table.
--
--   It serves three jobs:
--     1. The public results archive (/results) — browse every D1 dual meet by
--        conference / team / week without digging through school athletics sites.
--     2. Pre-fill: a commissioner building a slate can pull known results in
--        instead of typing them.
--     3. The write target for the future results scraper (docs/pickem.md).
--
-- PROVENANCE / PRECEDENCE
--   source: 'scrape' > 'manual' > 'pool'. A pool-reported result never
--   overwrites a scraped one. When a second pool reports the same dual:
--     - agreeing report  -> report_count += 1 (confidence grows)
--     - conflicting one  -> disputed = true, existing row kept for display
--   Writes go through api/pickem-publish-results.js with the service role;
--   clients read only (mirrors the global_scores policy).
-- ============================================================================

CREATE TABLE IF NOT EXISTS pickem_dual_results (
  source_dual_id TEXT PRIMARY KEY,          -- dataset id, e.g. 'big-ten-013'
  conference     TEXT,                      -- conference id, e.g. 'big-ten'
  home_team      TEXT,                      -- display name as entered
  away_team      TEXT,
  dual_date      DATE,                      -- when known
  week_tag       TEXT,                      -- ISO week tag from WEEK_AXIS
  home_score     INT,
  away_score     INT,
  winner         TEXT,                      -- home | away | tie
  bouts_json     JSONB,                     -- [{weight, winner, win_type,
                                            --   home_wrestler, away_wrestler}]
  source         TEXT NOT NULL DEFAULT 'pool',  -- scrape | manual | pool
  reported_by    TEXT,                      -- pool id of the latest contributor
  report_count   INT  NOT NULL DEFAULT 1,   -- independent pools agreeing
  disputed       BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pickem_dual_results_conference_idx ON pickem_dual_results(conference);
CREATE INDEX IF NOT EXISTS pickem_dual_results_week_idx       ON pickem_dual_results(week_tag);

ALTER TABLE pickem_dual_results ENABLE ROW LEVEL SECURITY;

-- Read-only to anon; the publish function writes with the service role.
CREATE POLICY "pickem_dual_results_read" ON pickem_dual_results FOR SELECT USING (true);

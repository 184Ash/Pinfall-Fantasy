-- supabase/add_global_scores.sql
-- Run this in the Supabase SQL editor (production project).
-- Creates two tables for the global scoring model.
-- The existing `points` table is NOT modified.

-- ── global_scores ──────────────────────────────────────────────────────────────
-- One row per wrestler UUID (same wrestler appears in multiple leagues with
-- different UUIDs, so there will be one row per league×wrestler combination).
-- The sync function writes all UUIDs at once, so every league updates in a
-- single sync operation.
CREATE TABLE IF NOT EXISTS global_scores (
  wrestler_id  UUID PRIMARY KEY REFERENCES wrestlers(id) ON DELETE CASCADE,
  pts          NUMERIC       NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Enable Realtime on global_scores so all connected clients update automatically
-- when a sync runs (Supabase Dashboard → Database → Replication → global_scores).
-- If using the CLI, uncomment the line below instead:
-- ALTER PUBLICATION supabase_realtime ADD TABLE global_scores;

-- ── sync_meta ─────────────────────────────────────────────────────────────────
-- Single-row table (id = 1) tracking the last successful sync.
-- Used for the 15-minute cooldown check and the "Scores current as of…" display.
CREATE TABLE IF NOT EXISTS sync_meta (
  id             INT         PRIMARY KEY DEFAULT 1,
  last_synced_at TIMESTAMPTZ,
  synced_by      TEXT        -- league_id of the commissioner who triggered the sync
);

-- Seed the single meta row so the cooldown SELECT always returns a row
-- (avoids a NULL check on first ever sync).
INSERT INTO sync_meta (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- Allow the anon/authenticated roles to SELECT from both tables (read-only).
-- The serverless function uses the service role key and bypasses RLS for writes.

ALTER TABLE global_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global_scores_read" ON global_scores
  FOR SELECT USING (true);

ALTER TABLE sync_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_meta_read" ON sync_meta
  FOR SELECT USING (true);

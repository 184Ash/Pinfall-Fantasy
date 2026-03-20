-- supabase/simplify_global_scores.sql
-- Run this in the Supabase SQL editor (production project).
-- Replaces the per-UUID global_scores table with a simple weight+seed keyed table.
-- One row per physical wrestler slot (330 rows total). All leagues share the same rows.

DROP TABLE IF EXISTS global_scores;

CREATE TABLE global_scores (
  weight      INT           NOT NULL,
  seed        INT           NOT NULL,
  pts         NUMERIC       NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (weight, seed)
);

ALTER TABLE global_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global_scores_read" ON global_scores
  FOR SELECT USING (true);

-- Re-enable Realtime on the new table:
-- Supabase Dashboard → Database → Replication → toggle global_scores ON
-- Or via CLI: ALTER PUBLICATION supabase_realtime ADD TABLE global_scores;

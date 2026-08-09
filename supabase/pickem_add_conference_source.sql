-- ============================================================================
-- Pick'em migration: link pool duals back to the 2026-27 schedule dataset.
-- Run in the Supabase SQL editor if pickem_schema.sql was applied before this
-- migration existed (the consolidated pickem_schema.sql already includes both
-- columns for fresh setups).
--
--   conference     — conference id from src/pickem/conferences.js ('big-ten'…)
--   source_dual_id — dataset dual id ('big-ten-013'…) so slates built from the
--                    schedule can be re-synced when real dates/results publish
--
-- Both are nullable: manually added duals simply leave them empty.
-- ============================================================================

ALTER TABLE pickem_duals ADD COLUMN IF NOT EXISTS conference     TEXT;
ALTER TABLE pickem_duals ADD COLUMN IF NOT EXISTS source_dual_id TEXT;

CREATE INDEX IF NOT EXISTS pickem_duals_source_dual_id_idx
  ON pickem_duals(source_dual_id);

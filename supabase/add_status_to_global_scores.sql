-- supabase/add_status_to_global_scores.sql
-- Run in Supabase SQL editor.
-- Adds a status column to global_scores to show each wrestler's current bracket status.

ALTER TABLE global_scores ADD COLUMN IF NOT EXISTS status TEXT;

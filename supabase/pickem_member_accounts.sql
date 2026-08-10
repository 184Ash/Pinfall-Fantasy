-- ============================================================================
-- Pick'em migration: per-member accounts (access codes).
-- Run in the Supabase SQL editor if pickem_schema.sql was applied before this
-- migration existed (the consolidated pickem_schema.sql already includes the
-- columns for fresh setups).
--
-- Model: each member secures their row with an ACCESS CODE they choose at
-- join time. Only a salted SHA-256 hash is stored; the plaintext is emailed
-- to the pool commissioner as an out-of-band backup (api/pickem-notify.js).
-- Forgot-code recovery = Supabase Auth email OTP proving address ownership,
-- then the client writes a new hash. Members created before this migration
-- have NULL hashes ("legacy") and are prompted to set a code on next rejoin.
--
-- Trust ceiling (same as the rest of the product): RLS is permissive, so
-- enforcement is client-side. Codes stop casual identity mixups in a private
-- group; they are not hardened auth. See docs/pickem.md.
-- ============================================================================

ALTER TABLE pickem_members ADD COLUMN IF NOT EXISTS email            TEXT;
ALTER TABLE pickem_members ADD COLUMN IF NOT EXISTS passcode_hash    TEXT;
ALTER TABLE pickem_members ADD COLUMN IF NOT EXISTS passcode_salt    TEXT;
ALTER TABLE pickem_members ADD COLUMN IF NOT EXISTS passcode_set_at  TIMESTAMPTZ;

-- If Realtime was enabled table-by-table, make sure pickem_pools is included —
-- live settings/scope/scoring propagation subscribes to it:
-- ALTER PUBLICATION supabase_realtime ADD TABLE pickem_pools;

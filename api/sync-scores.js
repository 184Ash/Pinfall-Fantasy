// api/sync-scores.js
// Vercel serverless function — triggered by the "Sync Scores" button.
//
// Simple global model: one row per physical wrestler slot (weight + seed).
// 330 rows total. All leagues read the same scores via weight-seed key.

import { createClient } from '@supabase/supabase-js';
import { getAllWeightClasses, WEIGHT_CLASS_IDS } from '../src/twClient.js';
import { scoreWeightClass } from '../src/scoringEngine.js';
import { buildNameIndex, fuzzyFind } from '../src/fuzzyMatch.js';
import pkg from '@next/env';
const { loadEnvConfig } = pkg;

if (process.env.NODE_ENV !== 'production') {
  loadEnvConfig(process.cwd());
}

const COOLDOWN_MS = 15 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leagueId } = req.body;
  if (!leagueId) {
    return res.status(400).json({ error: 'leagueId is required' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // ── 1. Cooldown check ─────────────────────────────────────────────────────
    const { data: meta } = await supabase
      .from('sync_meta')
      .select('last_synced_at')
      .eq('id', 1)
      .single();

    if (meta?.last_synced_at) {
      const elapsed = Date.now() - new Date(meta.last_synced_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        const minutesLeft = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
        return res.status(429).json({
          error: `Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}`,
          lastSyncedAt: meta.last_synced_at,
        });
      }
    }

    // ── 2. Fetch one league's wrestlers as fuzzy-match reference (330 rows) ───
    // All leagues share the same wrestler names/seeds, so any one league works.
    const { data: refWrestlers, error: wrError } = await supabase
      .from('wrestlers')
      .select('weight, seed, name, school')
      .eq('league_id', leagueId);

    if (wrError) throw new Error(wrError.message);
    if (!refWrestlers || refWrestlers.length === 0) {
      return res.status(400).json({ error: 'No wrestlers found for this league' });
    }

    const wrestlersByWeight = {};
    for (const wr of refWrestlers) {
      if (!wrestlersByWeight[wr.weight]) wrestlersByWeight[wr.weight] = [];
      wrestlersByWeight[wr.weight].push({ seed: wr.seed, name: wr.name, school: wr.school });
    }
    const nameIndex = buildNameIndex(wrestlersByWeight);

    // ── 3. Fetch brackets + placements ────────────────────────────────────────
    const { brackets, placements } = await getAllWeightClasses();

    // ── 4. Score each weight class ────────────────────────────────────────────
    const allScores = {}; // participantId -> { pts, name, weight }

    for (const weight of Object.keys(WEIGHT_CLASS_IDS).map(Number)) {
      const matches          = brackets[weight]   ?? {};
      const weightPlacements = placements[weight] ?? [];

      const participantInfo = {};
      for (const match of Object.values(matches)) {
        for (const p of [match.topParticipant, match.bottomParticipant]) {
          if (p?.id) participantInfo[p.id] = { name: p.name };
        }
      }
      for (const p of weightPlacements) {
        if (p.participantId) participantInfo[p.participantId] = { name: p.name };
      }

      const weightPts = scoreWeightClass(matches, weightPlacements);
      for (const [participantId, pts] of Object.entries(weightPts)) {
        if (pts > 0) {
          allScores[participantId] = { pts, weight, ...(participantInfo[participantId] ?? {}) };
        }
      }
    }

    // ── 5. Fuzzy-match participants to (weight, seed) ─────────────────────────
    const rowMap    = {}; // "weight-seed" -> { weight, seed, pts, updated_at }
    const unmatched = [];
    const now = new Date().toISOString();

    for (const [, { pts, name, weight }] of Object.entries(allScores)) {
      if (!name) { unmatched.push({ pts }); continue; }

      const match = fuzzyFind(name, nameIndex);
      if (!match) { unmatched.push({ name, weight, pts }); continue; }

      const key = `${match.entry.weight}-${match.entry.seed}`;
      if (!rowMap[key] || pts > rowMap[key].pts) {
        rowMap[key] = { weight: match.entry.weight, seed: match.entry.seed, pts, updated_at: now };
      }
    }

    const rows = Object.values(rowMap);

    // ── 6. Upsert into global_scores (330 rows max) ───────────────────────────
    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('global_scores')
        .upsert(rows, { onConflict: 'weight,seed' });

      if (upsertError) throw new Error(upsertError.message);
    }

    // ── 7. Write sync_meta ────────────────────────────────────────────────────
    const { error: metaError } = await supabase
      .from('sync_meta')
      .upsert({ id: 1, last_synced_at: now, synced_by: leagueId }, { onConflict: 'id' });

    if (metaError) throw new Error(metaError.message);

    return res.status(200).json({
      success: true,
      pointsWritten: rows.length,
      lastSyncedAt: now,
      unmatched: unmatched.length > 0 ? unmatched : undefined,
    });

  } catch (err) {
    console.error('[sync-scores] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

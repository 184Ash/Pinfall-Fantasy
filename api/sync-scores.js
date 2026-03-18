// api/sync-scores.js
// Vercel serverless function — triggered by commissioner "Sync Scores" button.
//
// Global model: ONE sync call updates ALL leagues simultaneously.
// Fetches all 10 weight classes from FloArena, scores them, fuzzy-matches to
// every wrestler in the DB (across all leagues), and upserts into global_scores.

import { createClient } from '@supabase/supabase-js';
import { getAllWeightClasses, WEIGHT_CLASS_IDS } from '../src/twClient.js';
import { scoreWeightClass } from '../src/scoringEngine.js';
import { buildNameIndex, fuzzyFind } from '../src/fuzzyMatch.js';
import pkg from '@next/env';
const { loadEnvConfig } = pkg;

// Load .env.local when running locally
if (process.env.NODE_ENV !== 'production') {
  loadEnvConfig(process.cwd());
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leagueId } = req.body;
  if (!leagueId) {
    return res.status(400).json({ error: 'leagueId is required' });
  }

  try {
    // ── 1. Cooldown check against sync_meta ──────────────────────────────────
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

    // ── 2. Fetch ALL wrestlers across all leagues ─────────────────────────────
    const { data: allWrestlers, error: wrestlersError } = await supabase
      .from('wrestlers')
      .select('id, weight, seed, name, school, league_id');

    if (wrestlersError) throw new Error(wrestlersError.message);
    if (!allWrestlers || allWrestlers.length === 0) {
      return res.status(400).json({ error: 'No wrestlers found in database' });
    }

    // Build a deduplicated name index (one entry per unique weight+seed combination)
    // and a multi-UUID map so one fuzzy match can update all leagues at once.
    const wrestlersByWeight = {}; // { weight: [{seed, name, school}] } — deduped
    const uuidsByKey = {};        // "weight-seed" -> [uuid, uuid, ...] (one per league)
    const seenKeys = new Set();

    allWrestlers.forEach(wr => {
      const key = `${wr.weight}-${wr.seed}`;

      if (!uuidsByKey[key]) uuidsByKey[key] = [];
      uuidsByKey[key].push(wr.id);

      // Add to name index only once per unique weight+seed
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        if (!wrestlersByWeight[wr.weight]) wrestlersByWeight[wr.weight] = [];
        wrestlersByWeight[wr.weight].push({ seed: wr.seed, name: wr.name, school: wr.school });
      }
    });

    const nameIndex = buildNameIndex(wrestlersByWeight);

    // ── 3. Fetch brackets + placements from FloArena ──────────────────────────
    const { brackets, placements } = await getAllWeightClasses();

    // ── 4. Score each weight class ────────────────────────────────────────────
    const allScores = {}; // participantId -> { pts, name, team, weight }

    for (const weight of Object.keys(WEIGHT_CLASS_IDS).map(Number)) {
      const matches         = brackets[weight]   ?? {};
      const weightPlacements = placements[weight] ?? [];

      // Build participantId -> name/team lookup from match participants + placements
      const participantInfo = {};
      for (const match of Object.values(matches)) {
        for (const p of [match.topParticipant, match.bottomParticipant]) {
          if (p?.id) participantInfo[p.id] = { name: p.name, team: p.team };
        }
      }
      for (const p of weightPlacements) {
        if (p.participantId) {
          participantInfo[p.participantId] = { name: p.name, team: p.teamName };
        }
      }

      const weightPts = scoreWeightClass(matches, weightPlacements);

      for (const [participantId, pts] of Object.entries(weightPts)) {
        if (pts > 0) {
          allScores[participantId] = {
            pts,
            weight,
            ...(participantInfo[participantId] ?? {}),
          };
        }
      }
    }

    // ── 5. Fuzzy-match each participant to wrestler UUIDs (all leagues) ───────
    const rowMap   = {}; // wrestler_id -> { wrestler_id, pts, updated_at }
    const unmatched = [];
    const now = new Date().toISOString();

    for (const [participantId, { pts, name, team, weight }] of Object.entries(allScores)) {
      if (!name) { unmatched.push({ participantId, pts }); continue; }

      const match = fuzzyFind(name, nameIndex);
      if (!match) {
        unmatched.push({ name, team, weight, pts });
        continue;
      }

      const key   = `${match.entry.weight}-${match.entry.seed}`;
      const uuids = uuidsByKey[key] ?? [];

      for (const wrestlerId of uuids) {
        // If multiple participants somehow map to the same UUID, keep highest pts
        if (!rowMap[wrestlerId] || pts > rowMap[wrestlerId].pts) {
          rowMap[wrestlerId] = { wrestler_id: wrestlerId, pts, updated_at: now };
        }
      }
    }

    const rows = Object.values(rowMap);

    // ── 6. Upsert into global_scores ──────────────────────────────────────────
    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('global_scores')
        .upsert(rows, { onConflict: 'wrestler_id' });

      if (upsertError) throw new Error(upsertError.message);
    }

    // ── 7. Write sync_meta ────────────────────────────────────────────────────
    const lastSyncedAt = now;
    const { error: metaError } = await supabase
      .from('sync_meta')
      .upsert(
        { id: 1, last_synced_at: lastSyncedAt, synced_by: leagueId },
        { onConflict: 'id' }
      );

    if (metaError) throw new Error(metaError.message);

    // ── 8. Return result ──────────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      pointsWritten: rows.length,
      lastSyncedAt,
      unmatched: unmatched.length > 0 ? unmatched : undefined,
    });

  } catch (err) {
    console.error('[sync-scores] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// api/sync-scores.js
// Vercel serverless function — triggered by commissioner "Sync Scores" button.
// Fetches all 10 weight classes from FloArena, scores them, fuzzy-matches to
// our wrestlers, and upserts points into Supabase.

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

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leagueId } = req.body;
  if (!leagueId) {
    return res.status(400).json({ error: 'leagueId is required' });
  }

  try {
    // ── 1. Fetch wrestlers for this league from Supabase ─────────────
    const { data: wrestlers, error: wrestlersError } = await supabase
      .from('wrestlers')
      .select('id, weight, seed, name, school')
      .eq('league_id', leagueId);

    if (wrestlersError) throw new Error(wrestlersError.message);
    if (!wrestlers || wrestlers.length === 0) {
      return res.status(400).json({ error: 'No wrestlers found for this league' });
    }

    // Shape wrestlers into { 125: [{seed, name, school}, ...], ... }
    // for buildNameIndex
    const wrestlersByWeight = {};
    const wrestlerLookup = {}; // "weight-seed" -> wrestler row
    wrestlers.forEach(wr => {
      if (!wrestlersByWeight[wr.weight]) wrestlersByWeight[wr.weight] = [];
      wrestlersByWeight[wr.weight].push({ seed: wr.seed, name: wr.name, school: wr.school });
      wrestlerLookup[`${wr.weight}-${wr.seed}`] = wr;
    });

    const nameIndex = buildNameIndex(wrestlersByWeight);

    // ── 2. Fetch all brackets + placements from FloArena ─────────────
    const { brackets, placements } = await getAllWeightClasses();

    // ── 3. Score each weight class ────────────────────────────────────
    // allScores: { participantId: { pts, name, team, weight } }
    const allScores = {};

    for (const weight of Object.keys(WEIGHT_CLASS_IDS).map(Number)) {
      const matches = brackets[weight] ?? {};
      const weightPlacements = placements[weight] ?? [];

      // Build participantId -> name/team lookup from matches
      const participantInfo = {};
      for (const match of Object.values(matches)) {
        for (const p of [match.topParticipant, match.bottomParticipant]) {
          if (p && p.id) {
            participantInfo[p.id] = { name: p.name, team: p.team };
          }
        }
      }
      // Also from placements
      for (const p of weightPlacements) {
        if (p.participantId) {
          participantInfo[p.participantId] = {
            name: p.name,
            team: p.teamName,
          };
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

    // ── 4. Fuzzy-match each participant to our wrestlers ──────────────
    const pointsMap = {}; // "weight-seed": pts
    const unmatched = [];

    for (const [participantId, { pts, name, team, weight }] of Object.entries(allScores)) {
      if (!name) { unmatched.push({ participantId, pts }); continue; }

      // Try fuzzy match — search only within this weight class for accuracy
      const match = fuzzyFind(name, nameIndex);

      if (!match) {
        unmatched.push({ name, team, weight, pts });
        continue;
      }

      const key = `${match.entry.weight}-${match.entry.seed}`;
      // If multiple participants map to the same key, take the higher pts
      if (!pointsMap[key] || pts > pointsMap[key]) {
        pointsMap[key] = pts;
      }
    }

    // ── 5. Upsert points into Supabase ────────────────────────────────
    // Reuse the same savePoints logic inline (service role, no import issues)
    const lookup = {};
    wrestlers.forEach(wr => { lookup[`${wr.weight}-${wr.seed}`] = wr.id; });

    const rows = Object.entries(pointsMap)
      .filter(([key, pts]) => lookup[key] && pts > 0)
      .map(([key, pts]) => ({
        league_id: leagueId,
        wrestler_id: lookup[key],
        pts,
      }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('points')
        .upsert(rows, { onConflict: 'league_id,wrestler_id' });

      if (upsertError) throw new Error(upsertError.message);
    }

    // ── 6. Return result ──────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      pointsWritten: rows.length,
      unmatched: unmatched.length > 0 ? unmatched : undefined,
    });

  } catch (err) {
    console.error('[sync-scores] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
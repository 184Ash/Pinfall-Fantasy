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

// ── Placement label maps ──────────────────────────────────────────────────────
const PLACEMENT_LABELS = {
  1: 'Champion', 2: '2nd Place', 3: '3rd Place', 4: '4th Place',
  5: '5th Place', 6: '6th Place', 7: '7th Place', 8: '8th Place',
};
const PLACE_TO_NUM = {
  '1st': 1, '2nd': 2, '3rd': 3, '4th': 4,
  '5th': 5, '6th': 6, '7th': 7, '8th': 8,
};

/**
 * Returns a round label for an upcoming match based on win/loss record.
 * Championship side = 0 losses, Consolation side = 1 loss.
 */
function getRoundLabel(wins, losses) {
  if (losses === 0) {
    if (wins === 1) return 'Champ R2';
    if (wins === 2) return 'Champ QF';
    if (wins === 3) return 'Champ SF';
    if (wins === 4) return 'Finals';
  } else if (losses === 1) {
    if (wins === 0) return 'Cons R1';
    if (wins === 1) return 'Cons R2';
    if (wins === 2) return 'Cons R3';
    if (wins === 3) return 'Cons R4';
    if (wins === 4) return 'Cons SF';
    if (wins >= 5) return '3rd Place';
  }
  return null;
}

/**
 * Derive each participant's status string from bracket data.
 * Uses win/loss record to determine bracket side and round.
 * Returns { participantId: statusString }.
 */
function computeMatchStatus(matches, placements) {
  // Build win/loss record from completed matches
  const record = {}; // id -> { wins, losses }
  const ensure = (id) => { if (!record[id]) record[id] = { wins: 0, losses: 0 }; };

  for (const match of Object.values(matches)) {
    if (match.state !== 'completed') continue;
    const top = match.topParticipant;
    const bot = match.bottomParticipant;
    if (!top?.id || !bot?.id) continue;
    ensure(top.id); ensure(bot.id);
    if (top.winner)      { record[top.id].wins++; record[bot.id].losses++; }
    else if (bot.winner) { record[bot.id].wins++; record[top.id].losses++; }
  }

  // Build upcoming opponent (last name) per participant
  const nextOpponent = {}; // id -> lastName
  for (const match of Object.values(matches)) {
    if (match.state !== 'upcoming') continue;
    const top = match.topParticipant;
    const bot = match.bottomParticipant;
    if (top?.id && bot?.name) nextOpponent[top.id] = bot.name.split(' ').pop();
    if (bot?.id && top?.name) nextOpponent[bot.id] = top.name.split(' ').pop();
  }

  const statusMap = {};

  // Placed wrestlers take priority
  for (const p of placements) {
    const id = p.participantId;
    if (!id) continue;
    const placeNum = typeof p.place === 'number'
      ? p.place
      : (PLACE_TO_NUM[p.place] ?? parseInt(p.place, 10));
    statusMap[id] = PLACEMENT_LABELS[placeNum] ?? `${placeNum}th Place`;
  }

  // All bracket participants
  for (const match of Object.values(matches)) {
    for (const p of [match.topParticipant, match.bottomParticipant]) {
      if (!p?.id || statusMap[p.id]) continue; // skip nulls and already-placed
      const rec = record[p.id] || { wins: 0, losses: 0 };
      const { wins, losses } = rec;

      if (losses >= 2) {
        statusMap[p.id] = 'Eliminated';
        continue;
      }

      const roundLabel = getRoundLabel(wins, losses);
      const opponent   = nextOpponent[p.id];

      if (roundLabel && opponent)  statusMap[p.id] = `${roundLabel} · vs ${opponent}`;
      else if (roundLabel)         statusMap[p.id] = roundLabel;
      else if (opponent)           statusMap[p.id] = `vs ${opponent}`; // first round
    }
  }

  return statusMap;
}

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

    // ── 4. Score + compute status for each weight class ───────────────────────
    const allParticipants = {}; // participantId -> { pts, status, weight, name }

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

      const weightPts    = scoreWeightClass(matches, weightPlacements);
      const weightStatus = computeMatchStatus(matches, weightPlacements);

      for (const [id, info] of Object.entries(participantInfo)) {
        allParticipants[id] = {
          pts:    weightPts[id]    || 0,
          status: weightStatus[id] ?? null,
          weight,
          name:   info.name,
        };
      }
    }

    // ── 5. Fuzzy-match participants to (weight, seed) ─────────────────────────
    const rowMap    = {}; // "weight-seed" -> { weight, seed, pts, status, updated_at }
    const unmatched = [];
    const now = new Date().toISOString();

    for (const [, { pts, status, name, weight }] of Object.entries(allParticipants)) {
      if (!name) { unmatched.push({ pts, status }); continue; }

      const match = fuzzyFind(name, nameIndex);
      if (!match) { unmatched.push({ name, weight, pts, status }); continue; }

      const key = `${match.entry.weight}-${match.entry.seed}`;
      if (!rowMap[key] || pts > rowMap[key].pts) {
        rowMap[key] = { weight: match.entry.weight, seed: match.entry.seed, pts, status, updated_at: now };
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

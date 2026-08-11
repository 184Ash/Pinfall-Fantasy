// api/pickem-publish-results.js
// Vercel serverless function — promotes a pool's finalized week into the
// GLOBAL results archive (pickem_dual_results), so every pool and the public
// /results page share one copy of each real-world dual.
//
// Reads the pool's own rows server-side (never trusts a client-supplied
// payload) and only publishes duals that carry a source_dual_id — i.e. duals
// built from the schedule dataset, which is what makes them identifiable
// across pools. Manually-typed duals stay private to their pool.
//
// Precedence: 'scrape' > 'manual' > 'pool'. A pool report never overwrites a
// scraped row. A second pool agreeing raises report_count (confidence); a
// second pool disagreeing sets disputed and leaves the existing row in place.

import { createClient } from '@supabase/supabase-js';
import pkg from '@next/env';
const { loadEnvConfig } = pkg;

if (process.env.NODE_ENV !== 'production') {
  loadEnvConfig(process.cwd());
}

const RANK = { pool: 1, manual: 2, scrape: 3 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Two reports agree when the outcome matches — team scores and bout scores can
// differ harmlessly between sources (see the tech-fall note in docs/pickem.md).
function sameOutcome(a, b) {
  if (a.winner !== b.winner) return false;
  const boutsA = a.bouts_json || [];
  const boutsB = b.bouts_json || [];
  if (boutsA.length === 0 || boutsB.length === 0) return true; // nothing to compare
  const keyed = new Map(boutsB.map(x => [x.weight, x]));
  for (const bout of boutsA) {
    const other = keyed.get(bout.weight);
    if (!other) continue;
    if (bout.winner && other.winner && bout.winner !== other.winner) return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { poolId, eventId } = req.body || {};
  if (typeof poolId !== 'string' || !/^[A-Z0-9]{5}$/i.test(poolId)
    || typeof eventId !== 'string' || !UUID_RE.test(eventId)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const pool = poolId.toUpperCase();

  // Only finalized events of this pool may publish.
  const { data: event } = await supabase
    .from('pickem_events')
    .select('id, pool_id, status')
    .eq('id', eventId)
    .single();
  if (!event || event.pool_id !== pool) return res.status(404).json({ error: 'Event not found' });
  if (event.status !== 'final') return res.status(200).json({ published: 0, reason: 'not_final' });

  const { data: duals } = await supabase
    .from('pickem_duals')
    .select('id, source_dual_id, conference, home_team, away_team, home_score, away_score, winner')
    .eq('event_id', eventId)
    .not('source_dual_id', 'is', null);
  if (!duals || duals.length === 0) return res.status(200).json({ published: 0, reason: 'no_linked_duals' });

  const withResult = duals.filter(d => d.winner);
  if (withResult.length === 0) return res.status(200).json({ published: 0, reason: 'no_results' });

  const { data: matches } = await supabase
    .from('pickem_matches')
    .select('dual_id, weight, winner, win_type, home_wrestler, away_wrestler')
    .in('dual_id', withResult.map(d => d.id));
  const boutsByDual = {};
  (matches || []).forEach(m => {
    if (!m.winner) return;
    (boutsByDual[m.dual_id] ||= []).push({
      weight: m.weight, winner: m.winner, win_type: m.win_type,
      home_wrestler: m.home_wrestler, away_wrestler: m.away_wrestler,
    });
  });

  const { data: existingRows } = await supabase
    .from('pickem_dual_results')
    .select('source_dual_id, winner, bouts_json, source, report_count, reported_by')
    .in('source_dual_id', withResult.map(d => d.source_dual_id));
  const existing = new Map((existingRows || []).map(r => [r.source_dual_id, r]));

  const now = new Date().toISOString();
  const rows = [];
  let skipped = 0;
  let disputes = 0;

  for (const dual of withResult) {
    const incoming = {
      source_dual_id: dual.source_dual_id,
      conference: dual.conference ?? null,
      home_team: dual.home_team,
      away_team: dual.away_team,
      home_score: dual.home_score ?? null,
      away_score: dual.away_score ?? null,
      winner: dual.winner,
      bouts_json: (boutsByDual[dual.id] || []).sort((a, b) => a.weight - b.weight),
      source: 'pool',
      reported_by: pool,
      report_count: 1,
      disputed: false,
      updated_at: now,
    };

    const prior = existing.get(dual.source_dual_id);
    if (!prior) { rows.push(incoming); continue; }

    // Never downgrade a higher-precedence source.
    if (RANK[prior.source] > RANK.pool) {
      if (!sameOutcome(prior, incoming)) disputes++;
      skipped++;
      continue;
    }
    // Same pool re-publishing (e.g. a corrected result) simply refreshes.
    if (prior.reported_by === pool) {
      rows.push({ ...incoming, report_count: prior.report_count, disputed: false });
      continue;
    }
    if (sameOutcome(prior, incoming)) {
      rows.push({ ...incoming, report_count: (prior.report_count || 1) + 1 });
    } else {
      // Keep the incumbent, flag the disagreement for review.
      disputes++;
      rows.push({ ...prior, disputed: true, updated_at: now });
    }
  }

  if (rows.length === 0) return res.status(200).json({ published: 0, skipped, disputes });

  const { error } = await supabase
    .from('pickem_dual_results')
    .upsert(rows, { onConflict: 'source_dual_id' });
  if (error) {
    console.error('publish-results upsert failed:', error);
    return res.status(200).json({ published: 0, error: 'upsert_failed' });
  }
  return res.status(200).json({ published: rows.length, skipped, disputes });
}

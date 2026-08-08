// src/pickem/pickemService.js
import { supabase } from '../supabase'
import { generateJoinCode } from '../session'
import { savePickemSession } from './pickemSession'
import { DEFAULT_SCORING, PICKEM_SEASON, WEIGHT_CLASSES } from './pickemConstants'

// ── Pool lifecycle ───────────────────────────────────────────────────────────

export async function createPool({ poolName, commissionerName, recoveryEmail, defaultPickMode, conferences }) {
  // 1. Unique join code (same retry pattern as createLeague)
  let joinCode
  let attempts = 0
  while (attempts < 5) {
    const candidate = generateJoinCode()
    const { data } = await supabase
      .from('pickem_pools')
      .select('id')
      .eq('id', candidate)
      .single()
    if (!data) { joinCode = candidate; break }
    attempts++
  }
  if (!joinCode) throw new Error('Could not generate a unique join code. Please try again.')

  // 2. Insert the pool
  const { error: poolError } = await supabase
    .from('pickem_pools')
    .insert({
      id: joinCode,
      name: poolName,
      season: PICKEM_SEASON,
      commissioner_email: recoveryEmail ?? null,
      settings_json: {
        scoring: DEFAULT_SCORING,
        defaultPickMode: defaultPickMode || 'matches',
        // Conference ids scoping this pool's slate (see src/pickem/conferences.js)
        conferences: conferences || [],
      },
    })
  if (poolError) throw new Error(poolError.message)

  // 3. Insert the commissioner as the first member
  const { data: member, error: memberError } = await supabase
    .from('pickem_members')
    .insert({ pool_id: joinCode, name: commissionerName, role: 'commissioner' })
    .select('id')
    .single()
  if (memberError) {
    await supabase.from('pickem_pools').delete().eq('id', joinCode)
    throw new Error(memberError.message)
  }

  // 4. Save session on this device
  savePickemSession(joinCode, member.id, 'commissioner')

  const joinUrl = `${window.location.origin}/pickem/${joinCode}`
  return { joinCode, joinUrl }
}

export async function fetchPool(joinCode) {
  const { data: pool, error } = await supabase
    .from('pickem_pools')
    .select('id, name, season, settings_json, commissioner_email')
    .eq('id', joinCode)
    .single()
  if (error || !pool) return null

  const { data: members, error: membersError } = await supabase
    .from('pickem_members')
    .select('id, name, role, created_at')
    .eq('pool_id', joinCode)
    .order('created_at', { ascending: true })
  if (membersError) return null

  return {
    poolName: pool.name,
    season: pool.season,
    settings: pool.settings_json ?? {},
    commissionerEmail: pool.commissioner_email ?? null,
    members: members ?? [],
  }
}

export async function joinPool(poolId, displayName) {
  const { data: member, error } = await supabase
    .from('pickem_members')
    .insert({ pool_id: poolId, name: displayName, role: 'member' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  savePickemSession(poolId, member.id, 'member')
  return { memberId: member.id, role: 'member' }
}

export async function savePoolSettings(poolId, partialSettings) {
  const { data: pool, error: fetchError } = await supabase
    .from('pickem_pools')
    .select('settings_json')
    .eq('id', poolId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const { error } = await supabase
    .from('pickem_pools')
    .update({ settings_json: { ...pool.settings_json, ...partialSettings } })
    .eq('id', poolId)
  if (error) throw new Error(error.message)
}

// ── Events (weekly slates), duals, matches ──────────────────────────────────

// Full nested load: events → duals → matches, plus all picks and members.
export async function loadPoolState(poolId) {
  const { data: members, error: membersError } = await supabase
    .from('pickem_members')
    .select('id, name, role, created_at')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: true })
  if (membersError) throw new Error(membersError.message)

  const { data: events, error: eventsError } = await supabase
    .from('pickem_events')
    .select('id, week_number, title, pick_mode, lock_at, status, created_at')
    .eq('pool_id', poolId)
    .order('week_number', { ascending: true })
  if (eventsError) throw new Error(eventsError.message)

  const eventIds = (events || []).map(e => e.id)
  let duals = []
  let matches = []
  if (eventIds.length > 0) {
    const { data: dualRows, error: dualsError } = await supabase
      .from('pickem_duals')
      .select('id, event_id, dual_order, home_team, away_team, home_score, away_score, winner')
      .in('event_id', eventIds)
      .order('dual_order', { ascending: true })
    if (dualsError) throw new Error(dualsError.message)
    duals = dualRows || []

    const dualIds = duals.map(d => d.id)
    if (dualIds.length > 0) {
      const { data: matchRows, error: matchesError } = await supabase
        .from('pickem_matches')
        .select('id, dual_id, match_order, weight, home_wrestler, away_wrestler, winner, win_type')
        .in('dual_id', dualIds)
        .order('match_order', { ascending: true })
      if (matchesError) throw new Error(matchesError.message)
      matches = matchRows || []
    }
  }

  const { data: picks, error: picksError } = await supabase
    .from('pickem_picks')
    .select('id, member_id, match_id, dual_id, pick, updated_at')
    .eq('pool_id', poolId)
  if (picksError) throw new Error(picksError.message)

  // Nest: matches under duals, duals under events
  const matchesByDual = {}
  matches.forEach(mt => {
    if (!matchesByDual[mt.dual_id]) matchesByDual[mt.dual_id] = []
    matchesByDual[mt.dual_id].push(mt)
  })
  const dualsByEvent = {}
  duals.forEach(d => {
    if (!dualsByEvent[d.event_id]) dualsByEvent[d.event_id] = []
    dualsByEvent[d.event_id].push({ ...d, matches: matchesByDual[d.id] || [] })
  })

  return {
    members: members || [],
    events: (events || []).map(e => ({ ...e, duals: dualsByEvent[e.id] || [] })),
    picks: picks || [],
  }
}

export async function createEvent(poolId, { weekNumber, title, pickMode, lockAt }) {
  const { data, error } = await supabase
    .from('pickem_events')
    .insert({
      pool_id: poolId,
      week_number: weekNumber,
      title,
      pick_mode: pickMode,
      lock_at: lockAt || null,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function updateEvent(eventId, fields) {
  const { error } = await supabase
    .from('pickem_events')
    .update(fields)
    .eq('id', eventId)
  if (error) throw new Error(error.message)
}

export async function deleteEvent(eventId) {
  const { error } = await supabase
    .from('pickem_events')
    .delete()
    .eq('id', eventId)
  if (error) throw new Error(error.message)
}

// Adds a dual; in 'matches' mode also scaffolds one bout per weight class so
// the commissioner only needs to fill in wrestler names (optional).
export async function addDual(eventId, { homeTeam, awayTeam, dualOrder, scaffoldMatches }) {
  const { data: dual, error } = await supabase
    .from('pickem_duals')
    .insert({
      event_id: eventId,
      dual_order: dualOrder,
      home_team: homeTeam,
      away_team: awayTeam,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  if (scaffoldMatches) {
    const rows = WEIGHT_CLASSES.map((w, i) => ({
      dual_id: dual.id,
      match_order: i + 1,
      weight: w,
    }))
    const { error: matchesError } = await supabase
      .from('pickem_matches')
      .insert(rows)
    if (matchesError) {
      await supabase.from('pickem_duals').delete().eq('id', dual.id)
      throw new Error(matchesError.message)
    }
  }
  return dual.id
}

export async function deleteDual(dualId) {
  const { error } = await supabase
    .from('pickem_duals')
    .delete()
    .eq('id', dualId)
  if (error) throw new Error(error.message)
}

export async function updateMatch(matchId, fields) {
  const { error } = await supabase
    .from('pickem_matches')
    .update(fields)
    .eq('id', matchId)
  if (error) throw new Error(error.message)
}

export async function updateDual(dualId, fields) {
  const { error } = await supabase
    .from('pickem_duals')
    .update(fields)
    .eq('id', dualId)
  if (error) throw new Error(error.message)
}

// ── Picks ────────────────────────────────────────────────────────────────────

export async function saveMatchPick(poolId, memberId, matchId, pick) {
  const { data, error } = await supabase
    .from('pickem_picks')
    .upsert(
      { pool_id: poolId, member_id: memberId, match_id: matchId, pick, updated_at: new Date().toISOString() },
      { onConflict: 'member_id,match_id' }
    )
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function saveDualPick(poolId, memberId, dualId, pick) {
  const { data, error } = await supabase
    .from('pickem_picks')
    .upsert(
      { pool_id: poolId, member_id: memberId, dual_id: dualId, pick, updated_at: new Date().toISOString() },
      { onConflict: 'member_id,dual_id' }
    )
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

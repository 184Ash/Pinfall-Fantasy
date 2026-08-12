// src/pickem/pickemService.js
import { supabase } from '../supabase'
import { generateJoinCode } from '../session'
import { savePickemSession } from './pickemSession'
import { DEFAULT_SCORING, PICKEM_SEASON, WEIGHT_CLASSES } from './pickemConstants'
import { hashPasscode, passcodeMatches, generateSalt } from './passcode'
import { planArchivePull } from './archiveApply'

// ── Access-code backup notifications ─────────────────────────────────────────
// Fire-and-forget: emails the plaintext code to the commissioner via
// api/pickem-notify.js. The server authenticates the payload (member must
// exist in the pool and the code must match the stored hash — which is why
// every caller fires this only AFTER the hash write). Failure or missing
// email config never blocks the member action — the DB write is the source
// of truth, the email is backup.
function notifyCommissioner(poolId, memberId, passcode, kind) {
  try {
    fetch('/api/pickem-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolId, memberId, passcode, kind }),
    }).catch(() => {})
  } catch { /* older browsers / SSR — backup email is best-effort only */ }
}

// ── Pool lifecycle ───────────────────────────────────────────────────────────

export async function createPool({ poolName, commissionerName, recoveryEmail, defaultPickMode, conferences, teamScope, passcode }) {
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
        // Optional per-conference followed-team lists (see src/pickem/schedule.js)
        teamScope: teamScope || {},
      },
    })
  if (poolError) throw new Error(poolError.message)

  // 3. Insert the commissioner as the first member (with their access code)
  const salt = generateSalt()
  const { data: member, error: memberError } = await supabase
    .from('pickem_members')
    .insert({
      pool_id: joinCode,
      name: commissionerName,
      role: 'commissioner',
      email: recoveryEmail ?? null,
      passcode_salt: salt,
      passcode_hash: passcode ? await hashPasscode(passcode, salt) : null,
      passcode_set_at: passcode ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (memberError) {
    await supabase.from('pickem_pools').delete().eq('id', joinCode)
    throw new Error(memberError.message)
  }
  if (passcode && recoveryEmail) notifyCommissioner(joinCode, member.id, passcode, 'created')

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
    .select('id, name, role, created_at, email, passcode_hash')
    .eq('pool_id', joinCode)
    .order('created_at', { ascending: true })
  if (membersError) return null

  return {
    poolName: pool.name,
    season: pool.season,
    settings: pool.settings_json ?? {},
    commissionerEmail: pool.commissioner_email ?? null,
    // One canonical member shape everywhere (must match loadPoolState):
    // emails are anon-readable by design in this trust model; hashes never
    // leave the service layer.
    members: (members ?? []).map(m => ({
      id: m.id, name: m.name, role: m.role, created_at: m.created_at,
      email: m.email ?? null, hasPasscode: !!m.passcode_hash,
    })),
  }
}

export async function joinPool(poolId, { name, email, passcode }) {
  const salt = generateSalt()
  const { data: member, error } = await supabase
    .from('pickem_members')
    .insert({
      pool_id: poolId,
      name,
      role: 'member',
      email: email || null,
      passcode_salt: salt,
      passcode_hash: await hashPasscode(passcode, salt),
      passcode_set_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  notifyCommissioner(poolId, member.id, passcode, 'created')
  savePickemSession(poolId, member.id, 'member')
  return { memberId: member.id, role: 'member' }
}

// ── Member accounts (access codes) ───────────────────────────────────────────

// Returns 'ok' | 'wrong' | 'legacy' (no code set yet — pre-accounts member).
export async function verifyMemberPasscode(memberId, passcode) {
  const { data: member, error } = await supabase
    .from('pickem_members')
    .select('passcode_hash, passcode_salt')
    .eq('id', memberId)
    .single()
  if (error) throw new Error(error.message)
  if (!member.passcode_hash) return 'legacy'
  return (await passcodeMatches(passcode, member.passcode_salt, member.passcode_hash)) ? 'ok' : 'wrong'
}

export async function setMemberPasscode(poolId, memberId, passcode, kind) {
  const salt = generateSalt()
  const { error } = await supabase
    .from('pickem_members')
    .update({
      passcode_salt: salt,
      passcode_hash: await hashPasscode(passcode, salt),
      passcode_set_at: new Date().toISOString(),
    })
    .eq('id', memberId)
  if (error) throw new Error(error.message)
  notifyCommissioner(poolId, memberId, passcode, kind)
}

// Legacy claim: sets a code ONLY if the member still has none — the .is()
// guard makes the claim race-safe when a stale device shows "SET UP CODE"
// for a member who already claimed theirs elsewhere. Returns false then.
export async function claimLegacyPasscode(poolId, memberId, passcode) {
  const salt = generateSalt()
  const { data, error } = await supabase
    .from('pickem_members')
    .update({
      passcode_salt: salt,
      passcode_hash: await hashPasscode(passcode, salt),
      passcode_set_at: new Date().toISOString(),
    })
    .eq('id', memberId)
    .is('passcode_hash', null)
    .select('id')
  if (error) throw new Error(error.message)
  const claimed = (data ?? []).length > 0
  if (claimed) notifyCommissioner(poolId, memberId, passcode, 'created')
  return claimed
}

export async function updateMemberEmail(memberId, email) {
  const { error } = await supabase
    .from('pickem_members')
    .update({ email: email || null })
    .eq('id', memberId)
  if (error) throw new Error(error.message)
}

// ── Forgot-code recovery (Supabase Auth email OTP) ───────────────────────────
// Same email rails as the draft product's magic-link recovery: Supabase sends
// a 6-digit code proving address ownership; on success the client writes a new
// access-code hash. NOTE: the Supabase "Magic Link" email template must
// include {{ .Token }} for the code to appear (see docs/pickem.md).

export async function requestPasscodeReset(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw new Error(error.message)
}

export async function confirmPasscodeReset(email, token) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw new Error(error.message)
  // The OTP proved address ownership; we don't keep the auth session around —
  // pick'em identity lives in pickem_members, not Supabase Auth.
  await supabase.auth.signOut()
}

// Members in this pool whose recovery email matches (several are possible —
// e.g. a parent managing two entries). Caller lets the user choose which one.
// LIKE wildcards in the address (_ and % are legal email characters) are
// escaped so this is a case-insensitive EXACT match — otherwise verifying
// a_b@x.com could surface (and let you reset) a.b@x.com's account.
export async function membersByEmail(poolId, email) {
  const exact = email.replace(/([\\%_])/g, '\\$1')
  const { data, error } = await supabase
    .from('pickem_members')
    .select('id, name, role')
    .eq('pool_id', poolId)
    .ilike('email', exact)
  if (error) throw new Error(error.message)
  return data ?? []
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

// Full nested load: events → duals → matches, plus all picks, members, and
// the pool's current settings (so scope/scoring edits propagate live).
export async function loadPoolState(poolId) {
  const { data: pool, error: poolError } = await supabase
    .from('pickem_pools')
    .select('settings_json')
    .eq('id', poolId)
    .single()
  if (poolError) throw new Error(poolError.message)

  const { data: memberRows, error: membersError } = await supabase
    .from('pickem_members')
    .select('id, name, role, created_at, email, passcode_hash')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: true })
  if (membersError) throw new Error(membersError.message)
  // One canonical member shape everywhere (must match fetchPool): emails are
  // anon-readable by design in this trust model; hashes never leave the
  // service layer.
  const members = (memberRows ?? []).map(m => ({
    id: m.id, name: m.name, role: m.role, created_at: m.created_at,
    email: m.email ?? null, hasPasscode: !!m.passcode_hash,
  }))

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
    settings: pool?.settings_json ?? {},
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

// Build a whole week from the schedule dataset in one shot: the event, all
// selected duals (tagged with conference + source_dual_id for later re-sync),
// and — in 'matches' mode — the 10 scaffolded bouts per dual, bulk-inserted.
// duals: [{ sourceDualId, conference, homeTeam, awayTeam }]
export async function createWeekFromSchedule(poolId, { weekNumber, title, pickMode, lockAt, duals }) {
  const eventId = await createEvent(poolId, { weekNumber, title, pickMode, lockAt })

  const dualRows = duals.map((d, i) => ({
    event_id: eventId,
    dual_order: i + 1,
    home_team: d.homeTeam,
    away_team: d.awayTeam,
    conference: d.conference ?? null,
    source_dual_id: d.sourceDualId ?? null,
  }))
  const { data: inserted, error: dualsError } = await supabase
    .from('pickem_duals')
    .insert(dualRows)
    .select('id')
  if (dualsError) {
    await supabase.from('pickem_events').delete().eq('id', eventId) // cascades duals
    throw new Error(dualsError.message)
  }

  if (pickMode === 'matches') {
    const matchRows = inserted.flatMap(dual =>
      WEIGHT_CLASSES.map((w, i) => ({ dual_id: dual.id, match_order: i + 1, weight: w })))
    const { error: matchesError } = await supabase
      .from('pickem_matches')
      .insert(matchRows)
    if (matchesError) {
      await supabase.from('pickem_events').delete().eq('id', eventId)
      throw new Error(matchesError.message)
    }
  }
  return eventId
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

// ── Global results archive ───────────────────────────────────────────────────
// pickem_dual_results is pool-agnostic: one row per real-world dual, keyed by
// the schedule dataset's id. Read by the archive UI and slate pre-fill; written
// server-side by api/pickem-publish-results.js.

export async function loadDualResults() {
  const { data, error } = await supabase
    .from('pickem_dual_results')
    .select('source_dual_id, conference, home_team, away_team, dual_date, week_tag, home_score, away_score, winner, bouts_json, source, report_count, disputed, updated_at')
  if (error) throw new Error(error.message)
  return data ?? []
}

// Targeted archive lookup for the Manage tab's "pull known results" button —
// returns a { source_dual_id: row } map for just the given dataset ids.
export async function loadDualResultsByIds(sourceDualIds) {
  if (!sourceDualIds || sourceDualIds.length === 0) return {}
  const { data, error } = await supabase
    .from('pickem_dual_results')
    .select('source_dual_id, home_score, away_score, winner, bouts_json, report_count, disputed')
    .in('source_dual_id', sourceDualIds)
  if (error) throw new Error(error.message)
  return Object.fromEntries((data ?? []).map(r => [r.source_dual_id, r]))
}

// Applies archived results to the given pool duals, fill-the-blanks only
// (see archiveApply.js). Returns how many duals were touched.
export async function pullArchivedResults(duals, archivedById) {
  let applied = 0
  for (const dual of duals) {
    const plan = planArchivePull(dual, archivedById[dual.source_dual_id])
    if (!plan) continue
    if (Object.keys(plan.dualFields).length > 0) await updateDual(dual.id, plan.dualFields)
    for (const mu of plan.matchUpdates) await updateMatch(mu.matchId, mu.fields)
    applied++
  }
  return applied
}

// Fire-and-forget promotion of a finalized week into the shared archive.
// Never blocks finalizing — the pool's own results are the source of truth.
export function publishEventResults(poolId, eventId) {
  try {
    return fetch('/api/pickem-publish-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolId, eventId }),
    }).then(r => r.json()).catch(() => null)
  } catch {
    return Promise.resolve(null)
  }
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

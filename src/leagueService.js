// src/leagueService.js
import { supabase } from './supabase'
import { saveSession, addTeamToSession, generateJoinCode, getSession } from './session'
import { DEFAULT_WRESTLERS } from './wrestlers';

export async function fetchLeague(joinCode) {
  // ── 1. Fetch the league row ───────────────────────────────────────
  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('id, name, settings_json, commissioner_email')
    .eq('id', joinCode)
    .single()

  if (leagueError || !league) return null

  // ── 2. Fetch all teams for this league ───────────────────────────
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, draft_position, role, is_claimed, claimed_by')
    .eq('league_id', joinCode)
    .order('draft_position', { ascending: true })

  if (teamsError) return null

  // ── 3. Return structured object ──────────────────────────────────
  const teamsWithFallback = teams.map((t) => ({
  ...t,
  name: t.name || `Team ${t.draft_position || 1}`,
}))

return {
  leagueName: league.name,
  teams: teamsWithFallback,
  settings: league.settings_json ?? {},
  commissionerEmail: league.commissioner_email ?? null,
}
}

// ── Team Claiming ────────────────────────────────────────────────

export async function claimTeam(leagueId, teamId, teamName) {
  // 1. Double-check the team is still unclaimed
  const { data: team, error: fetchError } = await supabase
    .from('teams')
    .select('is_claimed')
    .eq('id', teamId)
    .single()

  if (fetchError) throw new Error(fetchError.message)
  if (team.is_claimed) return { success: false, reason: 'already_claimed' }

  // 2. Determine role — co_commissioner if first claim in this league
  const { data: existing, error: roleError } = await supabase
    .from('teams')
    .select('id')
    .eq('league_id', leagueId)
    .in('role', ['co_commissioner', 'member'])
    .limit(1)

  if (roleError) throw new Error(roleError.message)
  const role = existing.length === 0 ? 'co_commissioner' : 'member'

  // 3. Write the claim — updates name from placeholder to chosen team name
  const { error: updateError } = await supabase
    .from('teams')
    .update({
      is_claimed: true,
      claimed_at: new Date().toISOString(),
      claimed_by: teamName,
      name: teamName,
      role,
    })
    .eq('id', teamId)

  if (updateError) throw new Error(updateError.message)

  // 4. Save session locally
  saveSession(leagueId, [teamId], role)

  return { success: true, role }
}

export async function claimAdditionalTeam(leagueId, teamId, teamName) {
  // 1. Double-check the team is still unclaimed
  const { data: team, error: fetchError } = await supabase
    .from('teams')
    .select('is_claimed')
    .eq('id', teamId)
    .single()

  if (fetchError) throw new Error(fetchError.message)
  if (team.is_claimed) return { success: false, reason: 'already_claimed' }

  // 2. Write the claim — always member, updates name from placeholder
  const { error: updateError } = await supabase
    .from('teams')
    .update({
      is_claimed: true,
      claimed_at: new Date().toISOString(),
      claimed_by: teamName,
      name: teamName,
      role: 'member',
    })
    .eq('id', teamId)

  if (updateError) throw new Error(updateError.message)

  // 3. Append to existing session
  addTeamToSession(teamId)

  return { success: true }
}

// ── Rejoin Flow ──────────────────────────────────────────────────

export async function requestRejoin(leagueId, teamId) {
  const { data, error } = await supabase
    .from('rejoin_requests')
    .insert({ league_id: leagueId, team_id: teamId, status: 'pending' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

export async function approveRejoin(requestId) {
  const { error } = await supabase
    .from('rejoin_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)

  if (error) throw new Error(error.message)
}

export async function listenForRejoinApproval(requestId, leagueId, teamId, role, onApproved) {
  const channel = supabase
    .channel(`rejoin-${requestId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rejoin_requests',
        filter: `id=eq.${requestId}`,
      },
      (payload) => {
        if (payload.new.status === 'approved') {
          saveSession(leagueId, [teamId], role)
          onApproved()
          channel.unsubscribe()
        }
      }
    )
    .subscribe()

  return channel
}

// Add to src/leagueService.js

export async function createLeague(formData) {
  const { leagueName, teamCount, rotationType, bonusPickEnabled, recoveryEmail } = formData

  // ── 1. Generate a unique join code ───────────────────────────────
  // Try a few times in case of collision (extremely unlikely)
  let joinCode
  let attempts = 0
  while (attempts < 5) {
    const candidate = generateJoinCode()
    const { data } = await supabase
      .from('leagues')
      .select('id')
      .eq('id', candidate)
      .single()
    if (!data) { joinCode = candidate; break }
    attempts++
  }
  if (!joinCode) throw new Error('Could not generate a unique join code. Please try again.')

  // ── 2. Insert the league row ─────────────────────────────────────
  const { error: leagueError } = await supabase
    .from('leagues')
    .insert({
      id: joinCode,
      name: leagueName,
      commissioner_email: recoveryEmail ?? null,
      settings_json: {
        rotationType,
        bonusPickEnabled,
        draftStarted: false,
        draftOrder: Array.from({ length: teamCount }, (_, i) => i + 1),
      },
    })

  if (leagueError) throw new Error(leagueError.message)

  // ── 3. Insert placeholder team rows ─────────────────────────────
  const teams = Array.from({ length: teamCount }, (_, i) => ({
    league_id: joinCode,
    name: `Team ${i + 1}`,
    draft_position: i + 1,
    role: 'member',
    is_claimed: false,
    claimed_by: null,
  }))

  const { error: teamsError } = await supabase
    .from('teams')
    .insert(teams)

  if (teamsError) {
    // Clean up the league row if teams insert fails
    await supabase.from('leagues').delete().eq('id', joinCode)
    throw new Error(teamsError.message)
  }

  // ── 4. Insert wrestlers for this league ──────────────────────────
  const wrestlerRows = []
  Object.entries(DEFAULT_WRESTLERS).forEach(([weight, wrestlers]) => {
    wrestlers.forEach(wr => {
      wrestlerRows.push({
        league_id: joinCode,
        weight: parseInt(weight),
        seed: wr.seed,
        name: wr.name,
        school: wr.school,
      })
    })
  })

  const { error: wrestlersError } = await supabase
    .from('wrestlers')
    .insert(wrestlerRows)

  if (wrestlersError) {
    // Clean up league and teams if wrestlers insert fails
    await supabase.from('teams').delete().eq('league_id', joinCode)
    await supabase.from('leagues').delete().eq('id', joinCode)
    throw new Error(wrestlersError.message)
  }

  // ── 5. Save commissioner session on this device ──────────────────
  saveSession(joinCode, [], 'commissioner')

  // ── 6. Return join code and full URL ─────────────────────────────
  const joinUrl = `${window.location.origin}/join/${joinCode}`
  return { joinCode, joinUrl }
}

// Used when commissioner claims a team from LinkGenerated —
// updates Supabase but does NOT touch the existing commissioner session
export async function claimTeamAsCommissioner(leagueId, teamId, teamName) {
  const { data: team, error: fetchError } = await supabase
    .from('teams')
    .select('is_claimed')
    .eq('id', teamId)
    .single()

  if (fetchError) throw new Error(fetchError.message)
  if (team.is_claimed) return { success: false, reason: 'already_claimed' }

  const { error: updateError } = await supabase
    .from('teams')
    .update({
      is_claimed: true,
      claimed_at: new Date().toISOString(),
      claimed_by: teamName,
      name: teamName,
      role: 'member',
    })
    .eq('id', teamId)

  if (updateError) throw new Error(updateError.message)

  return { success: true }
}

export async function unclaimTeam(leagueId, teamId) {
  // Fetch current draft_position to restore placeholder name
  const { data: team, error: fetchError } = await supabase
    .from('teams')
    .select('draft_position')
    .eq('id', teamId)
    .single()

  if (fetchError) throw new Error(fetchError.message)

  const { error } = await supabase
    .from('teams')
    .update({
      is_claimed: false,
      claimed_at: null,
      claimed_by: null,
      name: `Team ${team.draft_position}`,
      role: 'member',
    })
    .eq('id', teamId)
    .eq('league_id', leagueId)

  if (error) throw new Error(error.message)

  const session = getSession()
  if (session) {
    const updatedIds = session.teamIds.filter(id => id !== teamId)
    saveSession(session.leagueId, updatedIds, session.role)
  }

  return { success: true }
}

export async function loadDraftState(leagueId) {
  // ── 1. Fetch wrestlers for this league ───────────────────────────
  const { data: wrestlers, error: wrestlersError } = await supabase
    .from('wrestlers')
    .select('id, weight, seed, name, school')
    .eq('league_id', leagueId)

  if (wrestlersError) throw new Error(wrestlersError.message)

  // ── 2. Fetch picks for this league ───────────────────────────────
  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select('wrestler_id, team_id, is_bonus, teams(name)')
    .eq('league_id', leagueId)

  if (picksError) throw new Error(picksError.message)

  // ── 3. Fetch points for this league ──────────────────────────────
  const { data: points, error: pointsError } = await supabase
    .from('points')
    .select('wrestler_id, pts')
    .eq('league_id', leagueId)

  if (pointsError) throw new Error(pointsError.message)

  // ── 4. Shape wrestlers into DEFAULT_WRESTLERS format ─────────────
  // { 125: [{seed, name, school}, ...], 133: [...], ... }
  const wrestlersByWeight = {}
  wrestlers.forEach(wr => {
    if (!wrestlersByWeight[wr.weight]) wrestlersByWeight[wr.weight] = []
    wrestlersByWeight[wr.weight].push({
      id: wr.id,
      seed: wr.seed,
      name: wr.name,
      school: wr.school,
    })
  })

  // ── 5. Shape picks into { "weight-seed": teamName } format ───────
  // Build a wrestlerId → { weight, seed } lookup first
  const wrestlerLookup = {}
  wrestlers.forEach(wr => { wrestlerLookup[wr.id] = wr })

  const picksMap = {}
  const bonusKeys = []
  picks.forEach(pick => {
    const wr = wrestlerLookup[pick.wrestler_id]
    if (!wr) return
    const key = `${wr.weight}-${wr.seed}`
    picksMap[key] = pick.teams?.name ?? pick.team_id
    if (pick.is_bonus) bonusKeys.push(key)
  })

  // ── 6. Shape points into { "weight-seed": pts } format ───────────
  const pointsMap = {}
  points.forEach(pt => {
    const wr = wrestlerLookup[pt.wrestler_id]
    if (!wr) return
    const key = `${wr.weight}-${wr.seed}`
    pointsMap[key] = pt.pts
  })

  return {
    wrestlers: wrestlersByWeight,
    picks: picksMap,
    bonusKeys,
    points: pointsMap,
  }
}

export async function savePick(leagueId, teamId, wrestlerId, isBonus) {
  const { data, error } = await supabase
    .from('picks')
    .insert({
      league_id: leagueId,
      team_id: teamId,
      wrestler_id: wrestlerId,
      is_bonus: isBonus,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function savePoints(leagueId, pointsMap) {
  // pointsMap is { "weight-seed": pts } — need to convert to wrestler UUIDs
  const { data: wrestlers, error: wrestlersError } = await supabase
    .from('wrestlers')
    .select('id, weight, seed')
    .eq('league_id', leagueId)

  if (wrestlersError) throw new Error(wrestlersError.message)

  // Build weight-seed → id lookup
  const lookup = {}
  wrestlers.forEach(wr => { lookup[`${wr.weight}-${wr.seed}`] = wr.id })

  // Build upsert rows
  const rows = Object.entries(pointsMap)
    .filter(([key, pts]) => lookup[key] && pts > 0)
    .map(([key, pts]) => ({
      league_id: leagueId,
      wrestler_id: lookup[key],
      pts,
    }))

  if (rows.length === 0) return

  const { error } = await supabase
    .from('points')
    .upsert(rows, { onConflict: 'league_id,wrestler_id' })

  if (error) throw new Error(error.message)
}

export async function saveSettings(leagueId, settingsObject) {
  const { data: league, error: fetchError } = await supabase
    .from('leagues')
    .select('settings_json')
    .eq('id', leagueId)
    .single()

  if (fetchError) throw new Error(fetchError.message)

  const updatedSettings = {
    ...league.settings_json,
    ...settingsObject,
  }

  const { error } = await supabase
    .from('leagues')
    .update({ settings_json: updatedSettings })
    .eq('id', leagueId)

  if (error) throw new Error(error.message)
}

export async function goToDraft(leagueId) {
  // Signals all devices to navigate from WaitingRoom to Settings
  const { data: league, error: fetchError } = await supabase
    .from('leagues')
    .select('settings_json')
    .eq('id', leagueId)
    .single()
  if (fetchError) throw new Error(fetchError.message)
  const { error } = await supabase
    .from('leagues')
    .update({ settings_json: { ...league.settings_json, goToDraft: true } })
    .eq('id', leagueId)
  if (error) throw new Error(error.message)
}

export async function resetDraft(leagueId) {
  // Resets draftStarted and goToDraft so everyone goes back to settings pre-start state
  const { data: league, error: fetchError } = await supabase
    .from('leagues')
    .select('settings_json')
    .eq('id', leagueId)
    .single()
  if (fetchError) throw new Error(fetchError.message)
  const { error } = await supabase
    .from('leagues')
    .update({
      settings_json: {
        ...league.settings_json,
        draftStarted: false,
        goToDraft: true,
      }
    })
    .eq('id', leagueId)
  if (error) throw new Error(error.message)
}

export async function clearLeagueData(leagueId) {
  // Delete all picks and points for this league so wrestlers can be re-drafted
  const { error: picksError } = await supabase
    .from('picks')
    .delete()
    .eq('league_id', leagueId)

  if (picksError) throw new Error(picksError.message)

  const { error: pointsError } = await supabase
    .from('points')
    .delete()
    .eq('league_id', leagueId)

  if (pointsError) throw new Error(pointsError.message)
}
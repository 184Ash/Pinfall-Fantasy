// src/leagueService.js
import { supabase } from './supabase'
import { saveSession, addTeamToSession, generateJoinCode } from './session'

// ── Stub — replace in Section 3 Step 7 ──────────────────────────
export async function fetchLeague(joinCode) {
  return null
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

  // ── 4. Save commissioner session on this device ──────────────────
  saveSession(joinCode, [], 'commissioner')

  // ── 5. Return join code and full URL ─────────────────────────────
  const joinUrl = `${window.location.origin}/join/${joinCode}`
  return { joinCode, joinUrl }
}
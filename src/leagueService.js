// src/leagueService.js
import { supabase } from './supabase'
import { saveSession, addTeamToSession } from './session'

export async function claimTeam(leagueId, teamId, displayName) {
  // ── 1. Double-check the team is still unclaimed ──────────────────
  const { data: team, error: fetchError } = await supabase
    .from('teams')
    .select('is_claimed')
    .eq('id', teamId)
    .single()

  if (fetchError) throw new Error(fetchError.message)
  if (team.is_claimed) return { success: false, reason: 'already_claimed' }

  // ── 2. Determine role ─────────────────────────────────────────────
  // co_commissioner = first non-commissioner team claimed in this league
  const { data: existing, error: roleError } = await supabase
    .from('teams')
    .select('id')
    .eq('league_id', leagueId)
    .in('role', ['co_commissioner', 'member'])
    .limit(1)

  if (roleError) throw new Error(roleError.message)
  const role = existing.length === 0 ? 'co_commissioner' : 'member'

  // ── 3. Write the claim to Supabase ────────────────────────────────
  const { error: updateError } = await supabase
    .from('teams')
    .update({
      is_claimed: true,
      claimed_at: new Date().toISOString(),
      claimed_by: displayName,
      role,
    })
    .eq('id', teamId)

  if (updateError) throw new Error(updateError.message)

  // ── 4. Save session locally ───────────────────────────────────────
  saveSession(leagueId, [teamId], role)

  return { success: true, role }
}

export async function claimAdditionalTeam(leagueId, teamId, displayName) {
  // ── 1. Double-check the team is still unclaimed ──────────────────
  const { data: team, error: fetchError } = await supabase
    .from('teams')
    .select('is_claimed')
    .eq('id', teamId)
    .single()

  if (fetchError) throw new Error(fetchError.message)
  if (team.is_claimed) return { success: false, reason: 'already_claimed' }

  // ── 2. Write the claim to Supabase ────────────────────────────────
  // Always member — co_commissioner was assigned on the first claim
  const { error: updateError } = await supabase
    .from('teams')
    .update({
      is_claimed: true,
      claimed_at: new Date().toISOString(),
      claimed_by: displayName,
      role: 'member',
    })
    .eq('id', teamId)

  if (updateError) throw new Error(updateError.message)

  // ── 3. Append to existing session ────────────────────────────────
  addTeamToSession(teamId)

  return { success: true }
}
// Add to src/leagueService.js

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

  // Return the channel so the caller can unsubscribe if needed
  // e.g. if the user navigates away before approval
  return channel
}

// Stub — replace in Section 3 Step 7
export async function fetchLeague(joinCode) {
  return null
}

// src/session.js

const SESSION_KEY = 'pinfall_session'
// Commissioner sessions are also persisted to localStorage so they survive
// tab close / refresh / browser-back — the most common cause of "lost access".
const COMMISSIONER_LS_KEY = 'pinfall_commissioner_session'

export function saveSession(leagueId, teamIds, role) {
  const session = { leagueId, teamIds, role }
  const raw = JSON.stringify(session)
  sessionStorage.setItem(SESSION_KEY, raw)
  // Persist commissioner sessions to localStorage as a durable fallback.
  if (role === 'commissioner' || role === 'co_commissioner') {
    try { localStorage.setItem(COMMISSIONER_LS_KEY, raw) } catch (_) {}
  }
}

export function addTeamToSession(teamId) {
  const session = getSession()
  if (!session) return
  const updatedTeamIds = [...session.teamIds, teamId]
  saveSession(session.leagueId, updatedTeamIds, session.role)
}

// leagueId is optional but recommended — when provided we validate that any
// recovered localStorage session actually belongs to the league being loaded,
// preventing stale commissioner credentials from a different league bleeding in.
export function getSession(leagueId = null) {
  // 1. Check sessionStorage first (fastest, always preferred)
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (raw) {
    try {
      const session = JSON.parse(raw)
      // If a leagueId filter was supplied, only honour it when it matches
      if (!leagueId || session.leagueId === leagueId) return session
    } catch (_) {}
  }

  // 2. sessionStorage was empty or mismatched — try localStorage fallback
  //    for commissioner sessions only (members don't get persisted there)
  try {
    const lsRaw = localStorage.getItem(COMMISSIONER_LS_KEY)
    if (lsRaw) {
      const session = JSON.parse(lsRaw)
      if (!leagueId || session.leagueId === leagueId) {
        // Restore into sessionStorage so subsequent calls skip the localStorage lookup
        sessionStorage.setItem(SESSION_KEY, lsRaw)
        return session
      }
    }
  } catch (_) {}

  return null
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
  try { localStorage.removeItem(COMMISSIONER_LS_KEY) } catch (_) {}
}

export function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

export function isSessionStorageAvailable() {
  try {
    const test = '__storage_test__'
    sessionStorage.setItem(test, test)
    sessionStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

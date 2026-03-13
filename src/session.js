// src/session.js

const SESSION_KEY = 'pinfall_session'

export function saveSession(leagueId, teamIds, role) {
  const session = { leagueId, teamIds, role }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function addTeamToSession(teamId) {
  const session = getSession()
  if (!session) return
  const updatedTeamIds = [...session.teamIds, teamId]
  saveSession(session.leagueId, updatedTeamIds, session.role)
}

export function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

export function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}
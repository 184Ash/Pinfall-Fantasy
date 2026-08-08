// src/pickem/pickemSession.js
// Same model as ../session.js but namespaced per product AND per pool, so a
// user can be in the draft league and several pick'em pools at once.

const KEY_PREFIX = 'pinfall_pickem_'

const key = (poolId) => `${KEY_PREFIX}${poolId}`

export function savePickemSession(poolId, memberId, role) {
  const raw = JSON.stringify({ poolId, memberId, role })
  try { localStorage.setItem(key(poolId), raw) } catch {
    sessionStorage.setItem(key(poolId), raw)
  }
}

export function getPickemSession(poolId) {
  try {
    const raw = localStorage.getItem(key(poolId)) || sessionStorage.getItem(key(poolId))
    if (!raw) return null
    const session = JSON.parse(raw)
    if (session.poolId !== poolId) return null
    return session
  } catch {
    return null
  }
}

export function clearPickemSession(poolId) {
  try { localStorage.removeItem(key(poolId)) } catch { /* storage blocked */ }
  try { sessionStorage.removeItem(key(poolId)) } catch { /* storage blocked */ }
}

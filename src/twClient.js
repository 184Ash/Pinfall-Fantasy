// src/twClient.js
// FloArena API client for 2026 NCAA DI Wrestling Championships

import fetch from 'node-fetch';

const BASE_URL = 'https://prod-web-api.flowrestling.org';
const EVENT_ID = '15175319';

export const WEIGHT_CLASS_IDS = {
  125: '32DB3iFXozO08ZuIdr',
  133: '32D9jODEYbQ4bqWMOU',
  141: '32D3LCGs6tYLouqB44',
  149: '32DTMflZPhteOSIaGy',
  157: '32D50WG5LOlE8rFzoC',
  165: '32Da2gG1VkUPb4q1L6',
  174: '32DD55vVQ3MKfD39Gu',
  184: '32DgfSEDo9Q770806B',
  197: '32Dd1A2hGLoLwYzSeb',
  285: '32DzxCwJSlG7SOSsj3',
};

async function fetchWithRetry(url, retries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
}

/**
 * Fetch full bracket (all matches) for one weight class.
 * Returns the raw matches object keyed by match UUID.
 */
export async function getBracket(weightClass) {
  const wcId = WEIGHT_CLASS_IDS[weightClass];
  if (!wcId) throw new Error(`Unknown weight class: ${weightClass}`);
  const url = `${BASE_URL}/api/event-hub/${EVENT_ID}/brackets/${wcId}?filter=null&search=null&tab=null&refresh=false`;
  const data = await fetchWithRetry(url);
  return data?.data?.matches ?? {};
}

/**
 * Fetch final placements (1st-8th) for one weight class.
 * Returns array of { place, participantId, name, teamName }.
 */
export async function getPlacements(weightClass) {
  const wcId = WEIGHT_CLASS_IDS[weightClass];
  if (!wcId) throw new Error(`Unknown weight class: ${weightClass}`);
  const url = `${BASE_URL}/api/event-hub/${EVENT_ID}/brackets/placements/${wcId}`;
  const data = await fetchWithRetry(url);
  return data?.data ?? [];
}

/**
 * Fetch brackets and placements for all 10 weight classes.
 * Returns { brackets: { 125: matchesObj, ... }, placements: { 125: [...], ... } }
 */
export async function getAllWeightClasses() {
  const weights = Object.keys(WEIGHT_CLASS_IDS).map(Number);
  const results = await Promise.all(
    weights.map(async (w) => ({
      weight: w,
      bracket: await getBracket(w),
      placements: await getPlacements(w),
    }))
  );

  const brackets = {};
  const placements = {};
  for (const { weight, bracket, placements: p } of results) {
    brackets[weight] = bracket;
    placements[weight] = p;
  }
  return { brackets, placements };
}
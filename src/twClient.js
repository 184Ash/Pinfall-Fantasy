// src/twClient.js
// FloArena API client for 2025 NCAA DI Wrestling Championships

const BASE_URL = 'https://prod-web-api.flowrestling.org';
const EVENT_ID = '13956840';

export const WEIGHT_CLASS_IDS = {
  125: 'wc-4c822030-af7f-4598-a02e-c020a3c5a531',
  133: 'wc-5663f0b8-6655-4635-9a06-c917c8dbcc22',
  141: 'wc-4e497a0f-6eab-4452-a240-666a87369961',
  149: 'wc-5d140f20-1a7e-4186-bce7-3f25336183c0',
  157: 'wc-18a1dc2f-1264-4fdc-9765-2e59825a485a',
  165: 'wc-905976fb-de19-4646-afc7-a726ae0ebd24',
  174: 'wc-3c3c8621-5f98-48aa-993e-e33789c837ab',
  184: 'wc-6dc3a655-435e-4039-95d0-fd04303520bc',
  197: 'wc-da88bf34-6b16-48a0-8a1a-6ad70308620b',
  285: 'wc-de379e44-2973-4b64-a424-cc556113dd11',
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
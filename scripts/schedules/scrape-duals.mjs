#!/usr/bin/env node
/**
 * scrape-duals.mjs
 *
 * Pulls the 2026-27 D1 wrestling schedules that are actually posted (34 of 77
 * programs, per FloWrestling's tracker as of Sept 21, 2026) and flattens them
 * into a CSV/JSON of dual rows.
 *
 * Stages, so you only hit the network once:
 *   node scrape-duals.mjs fetch     -> caches raw HTML into ./cache/
 *   node scrape-duals.mjs parse     -> reads ./cache/, writes duals-2026-27.csv/json
 *   node scrape-duals.mjs composites -> caches conference composite ICS feeds
 *                                      into ./cache/composite/ (ACC, MAC, ...)
 *   node scrape-duals.mjs compare   -> scraped in-conference duals vs the
 *                                      projected dataset (src/pickem/data),
 *                                      plus a three-way view vs composites
 *   node scrape-duals.mjs           -> fetch then parse
 *
 * Flags:
 *   --refetch   ignore cache, re-download everything
 *   --only=slug limit to one school (e.g. --only=north-dakota-state)
 *
 * Requires Node 18+. No dependencies.
 *
 * Parsers, tried in order per site (first one that yields events wins):
 *   1. Sidearm "Nuxt" platform — devalue-serialized __NUXT_DATA__ blob. Richest
 *      source: opponent, at/vs, home/away/neutral, tournament wrapper, event
 *      type (R regular / P postseason / S scrimmage), and the site's own
 *      in-conference flag. Covers ~half of D1.
 *   2. WMT Digital — server-rendered schedule-event-item blocks (Iowa,
 *      Little Rock, Missouri, Nebraska, Purdue, Virginia Tech). Their JSON-LD
 *      is sometimes a truncated stub, so the HTML is preferred.
 *   3. Classic Sidearm — server-rendered sidearm-schedule-game <li>s. Ranked
 *      above JSON-LD because SIUE and Bellarmine embed LAST season's JSON-LD
 *      under this season's URL while the visible list is current.
 *   4. JSON-LD SportsEvent blocks ("Team at Opponent" / "Team vs. Opponent";
 *      classic Sidearm sites). UTC startDate is rendered in US Central so
 *      evening duals don't slip a day.
 *   5. Rendered-text fallback (low confidence).
 *
 * Team names are canonicalized against the projected dataset's 77 programs.
 * Tournaments are filtered by event type + wrapper name + opponent shape, not
 * by name regex alone — multi-dual events ("Sunshine Duals", "Bucknell Tri")
 * keep their real duals, bracket events ("Cougar Clash", "Southern Scuffle")
 * are dropped even when the site lists the host as the opponent.
 */

import { writeFile, readFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const CACHE = './cache';
const OUT_CSV = 'duals-2026-27.csv';
const OUT_JSON = 'duals-2026-27.json';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const DELAY_MS = 1500;

// Only schools FloWrestling flagged as having a 2026-27 schedule up (tracker:
// flowrestling.org/articles/16117397; re-check the UPDATED markers each week).
// Add rows here as more land. 'partial' = Flo says partially updated.
const SCHOOLS = [
  // ACC
  ['duke', 'Duke', 'acc', 'https://goduke.com/sports/wrestling/schedule/2026-27', false],
  ['north-carolina', 'North Carolina', 'acc', 'https://goheels.com/sports/wrestling/schedule/2026-27', false],
  ['virginia-tech', 'Virginia Tech', 'acc', 'https://hokiesports.com/sports/wrestling/schedule/season/2026-27', false],

  // Big 12
  ['iowa-state', 'Iowa State', 'big-12', 'https://cyclones.com/sports/wrestling/schedule/2026-27', false],
  ['missouri', 'Missouri', 'big-12', 'https://mutigers.com/sports/wrestling/schedule/season/2026-27', false],
  ['northern-iowa', 'Northern Iowa', 'big-12', 'https://unipanthers.com/sports/wrestling/schedule/2026-27', true],
  ['wyoming', 'Wyoming', 'big-12', 'https://gowyo.com/sports/wrestling/schedule/2026-27', false],

  // Big Ten (all partial as of 9/18 - conference dates not released)
  ['illinois', 'Illinois', 'big-ten', 'https://fightingillini.com/sports/wrestling/schedule/2026-27', true],
  ['iowa', 'Iowa', 'big-ten', 'https://hawkeyesports.com/sports/wrestling/schedule/season/2026-27', true],
  ['michigan', 'Michigan', 'big-ten', 'https://mgoblue.com/sports/wrestling/schedule/2026-27', true],
  ['nebraska', 'Nebraska', 'big-ten', 'https://huskers.com/sports/wrestling/schedule', true],
  ['ohio-state', 'Ohio State', 'big-ten', 'https://ohiostatebuckeyes.com/sports/wrestling/schedule', true],
  ['purdue', 'Purdue', 'big-ten', 'https://purduesports.com/sports/wrestling/schedule/season/2026-27', true],
  ['wisconsin', 'Wisconsin', 'big-ten', 'https://uwbadgers.com/sports/wrestling/schedule/2026-27', true],

  // EIWA
  ['bucknell', 'Bucknell', 'eiwa', 'https://bucknellbison.com/sports/wrestling/schedule/2026-27', false],
  ['franklin-marshall', 'Franklin & Marshall', 'eiwa', 'https://godiplomats.com/sports/wrestling/schedule/2026-27', false],
  ['lehigh', 'Lehigh', 'eiwa', 'https://lehighsports.com/sports/wrestling/schedule/2026-2027', false],
  ['navy', 'Navy', 'eiwa', 'https://navysports.com/sports/wrestling/schedule/2026-27', false],
  ['morgan-state', 'Morgan State', 'eiwa', 'https://morganstatebears.com/sports/wrestling/schedule/2026-27', false],

  // Ivy
  ['cornell', 'Cornell', 'ivy', 'https://cornellbigred.com/sports/wrestling/schedule/2026-27', false],

  // MAC
  ['buffalo', 'Buffalo', 'mac', 'https://ubbulls.com/sports/wrestling/schedule/2026-27', false],
  ['clarion', 'Clarion', 'mac', 'https://clariongoldeneagles.com/sports/wrestling/schedule/2026-27', false],
  ['edinboro', 'Edinboro', 'mac', 'https://gofightingscots.com/sports/wrestling/schedule/2026-2027', false],
  ['kent-state', 'Kent State', 'mac', 'https://kentstatesports.com/sports/wrestling/schedule/2026-27', false],
  ['lock-haven', 'Lock Haven', 'mac', 'https://www.lockhavenathletics.com/sports/wrestling/schedule/2026-27', false],
  ['siue', 'SIUE', 'mac', 'https://siuecougars.com/sports/wrestling/schedule/2026-27', false],

  // Pac-12  <-- the block you actually care about
  ['little-rock', 'Little Rock', 'pac-12', 'https://lrtrojans.com/sports/wrestling/schedule/season/2026-27', false],
  ['air-force', 'Air Force', 'pac-12', 'https://goairforcefalcons.com/sports/wrestling/schedule/2026-27', false],
  ['north-dakota-state', 'North Dakota State', 'pac-12', 'https://gobison.com/sports/wrestling/schedule/2026-27', false],
  ['northern-colorado', 'Northern Colorado', 'pac-12', 'https://uncbears.com/sports/wrestling/schedule/2026-27', false],
  ['south-dakota-state', 'South Dakota State', 'pac-12', 'https://gojacks.com/sports/wrestling/schedule/2026-27', false],

  // SoCon
  ['app-state', 'App State', 'socon', 'https://appstatesports.com/sports/wrestling/schedule/2026-27', false],
  ['bellarmine', 'Bellarmine', 'socon', 'https://athletics.bellarmine.edu/sports/wrestling/schedule/2026-27', false],
  ['chattanooga', 'Chattanooga', 'socon', 'https://gomocs.com/sports/wr/schedule/2026-27', false],
].map(([slug, name, conference, url, partial]) => ({ slug, name, conference, url, partial }));

const args = process.argv.slice(2);
const stage = args.find(a => !a.startsWith('--')) ?? 'all';
const refetch = args.includes('--refetch');
const only = (args.find(a => a.startsWith('--only=')) ?? '').split('=')[1];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const targets = only ? SCHOOLS.filter(s => s.slug === only) : SCHOOLS;

/* ------------------------------------------------------------------ fetch */

async function fetchAll() {
  await mkdir(CACHE, { recursive: true });
  let ok = 0, skipped = 0, failed = [];

  for (const s of targets) {
    const file = path.join(CACHE, `${s.slug}.html`);
    if (existsSync(file) && !refetch) { skipped++; continue; }
    try {
      const res = await fetch(s.url, {
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      await writeFile(file, html);
      ok++;
      console.log(`  ok   ${s.name} (${(html.length / 1024).toFixed(0)}kb)`);
    } catch (err) {
      failed.push([s.name, err.message]);
      console.log(`  FAIL ${s.name}: ${err.message}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`\nfetched ${ok}, cached-skip ${skipped}, failed ${failed.length}`);
  if (failed.length) console.log('failures:', failed.map(f => f[0]).join(', '));
}


/* ------------------------------------------------------- projected dataset */
// Source of truth for team names + conference membership (and the projected
// pairings the `compare` stage checks against). Never modified by this script.
const DATASET_PATH = path.resolve(process.cwd(), '../../src/pickem/data/ncaa-d1-duals-2026-27.json');
const DS = JSON.parse(await readFile(DATASET_PATH, 'utf8'));
const DS_TEAMS = DS.teams;                                   // [{id, name, school, conference}]
const TEAM_BY_NAME = new Map(DS_TEAMS.map(t => [t.name.toLowerCase(), t]));
const TEAM_BY_ID = new Map(DS_TEAMS.map(t => [t.id, t]));
const SLUG_TO_ID = { 'app-state': 'appalachian-state' };   // slugs that differ from dataset ids
const SCHOOL_TEAM = new Map(SCHOOLS.map(s => [s.slug, TEAM_BY_ID.get(SLUG_TO_ID[s.slug] ?? s.slug)]));

// Anything dated outside this window is last season's schedule leaking
// through (two classic-Sidearm sites embed stale 2025-26 JSON-LD).
const SEASON_START = '2026-10-01', SEASON_END = '2027-04-30';

// Aliases the sites use that don't reduce to a dataset name by the generic
// "strip University/College" rule. Keys are lowercase, post-normalization.
const TEAM_ALIASES = {
  'army': 'Army West Point', 'army west point': 'Army West Point', 'united states military academy': 'Army West Point', 'west point': 'Army West Point',
  'united states naval academy': 'Navy', 'naval academy': 'Navy',
  'pittsburgh': 'Pitt', 'north carolina state': 'NC State', 'n.c. state': 'NC State', 'nc state': 'NC State',
  'pennsylvania state': 'Penn State', 'pennsylvania': 'Penn',
  'citadel': 'The Citadel', 'appalachian state': 'App State',
  'ut chattanooga': 'Chattanooga', 'tennessee-chattanooga': 'Chattanooga', 'tennessee chattanooga': 'Chattanooga', 'tennessee at chattanooga': 'Chattanooga', 'utc': 'Chattanooga',
  'siue': 'SIU Edwardsville', 'southern illinois edwardsville': 'SIU Edwardsville', 'southern illinois-edwardsville': 'SIU Edwardsville', 'siu-edwardsville': 'SIU Edwardsville', 'southern illinois university edwardsville': 'SIU Edwardsville',
  'csu bakersfield': 'Cal State Bakersfield', 'csu-bakersfield': 'Cal State Bakersfield', 'csub': 'Cal State Bakersfield', 'bakersfield': 'Cal State Bakersfield', 'cal state-bakersfield': 'Cal State Bakersfield',
  'long island': 'LIU', 'liu brooklyn': 'LIU',
  'franklin and marshall': 'Franklin & Marshall', 'f&m': 'Franklin & Marshall',
  'virginia military institute': 'VMI', 'the ohio state': 'Ohio State',
  'gardner webb': 'Gardner-Webb', 'ndsu': 'North Dakota State', 'sdsu': 'South Dakota State',
  'uni': 'Northern Iowa', 'arkansas-little rock': 'Little Rock', 'ualr': 'Little Rock',
  'uvu': 'Utah Valley', 'cmu': 'Central Michigan', 'niu': 'Northern Illinois',
  'oklahoma st': 'Oklahoma State', 'iowa st': 'Iowa State', 'michigan st': 'Michigan State', 'kent st': 'Kent State',
  'ohio st': 'Ohio State', 'penn st': 'Penn State', 'arizona st': 'Arizona State', 'oregon st': 'Oregon State',
  'morgan st': 'Morgan State', 'sacred heart university': 'Sacred Heart',
  'clarion golden eagles': 'Clarion', 'pennwest clarion': 'Clarion', 'pennwest edinboro': 'Edinboro', 'edinboro pennsylvania': 'Edinboro',
  'commonwealth - bloomsburg': 'Bloomsburg', 'commonwealth bloomsburg': 'Bloomsburg', 'bloomsburg pennsylvania': 'Bloomsburg', 'lock haven pennsylvania': 'Lock Haven',
};

function canonicalTeam(raw) {
  let s = String(raw ?? '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  s = s.replace(/^(?:at|vs\.?|@)\s+/i, '');                          // "Vs Northwestern"
  s = s.replace(/^(?:#|no\.\s*)\d+\s+/i, '');                        // "#5 Iowa" rankings
  s = s.replace(/\s*\([^)]*\)\s*$/, '');                             // trailing parenthetical
  s = s.replace(/\bcommunity college\b/i, 'CC');
  const key0 = s.toLowerCase();
  if (TEAM_ALIASES[key0]) return TEAM_ALIASES[key0];
  if (TEAM_BY_NAME.has(key0)) return TEAM_BY_NAME.get(key0).name;
  let n = s.replace(/^the\s+/i, '')
    .replace(/\b(university|college)\s+of\s+/i, '')
    .replace(/\s+(university|college|univ\.?)$/i, '')
    .replace(/\s+(wrestling)$/i, '')
    .replace(/\s+st\.?$/i, ' State')                                  // "Michigan St." (end only; keeps "St. Louis")
    .trim();
  const key = n.toLowerCase();
  if (TEAM_ALIASES[key]) return TEAM_ALIASES[key];
  if (TEAM_BY_NAME.has(key)) return TEAM_BY_NAME.get(key).name;
  return n;
}
const isD1 = name => TEAM_BY_NAME.has(String(name).toLowerCase());
const conferenceOf = name => TEAM_BY_NAME.get(String(name).toLowerCase())?.conference ?? '';
const teamIdOf = name => TEAM_BY_NAME.get(String(name).toLowerCase())?.id ?? null;

// Does this string refer to the school whose page we're parsing? Sites write
// themselves with mascots ("Clarion Golden Eagles") or full names.
function mentionsSchool(str, team) {
  if (!team) return false;
  const s = String(str).toLowerCase();
  if (canonicalTeam(str).toLowerCase() === team.name.toLowerCase()) return true;
  if (s.includes(team.name.toLowerCase())) return true;
  return !!(team.school && s.includes(team.school.toLowerCase()));
}

/* ------------------------------------------------------------------ parse */

// Season-aware "Dec 11" -> ISO. Oct-Dec = 2026, Jan-Apr = 2027.
function monthDayToIso(mon, day) {
  const map = { oct: 10, nov: 11, dec: 12, jan: 1, feb: 2, mar: 3, apr: 4 };
  const m = map[mon.toLowerCase().slice(0, 3)];
  if (!m) return '';
  const year = m >= 10 ? 2026 : 2027;
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Naive local timestamps ("2026-11-07T19:00:00") are taken as-is; anything
// with a zone (JSON-LD emits UTC) is rendered in US Central so a 7 p.m.
// Eastern dual (00:00Z next day) doesn't shift a day. Central is correct
// for every US time zone at any plausible meet time.
function normalizeDate(v) {
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s) && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (isNaN(d)) return s.slice(0, 10);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); // yyyy-mm-dd
}

const stripMarkup = html => html
  .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ');

// --- 1. Sidearm "Nuxt" sites: devalue-serialized __NUXT_DATA__ -----------
// The array's index 0 is the root; object/array members are indices into the
// array. Nuxt wraps values in ["Reactive", i] / ["Ref", i] etc.
function hydrateNuxt(arr) {
  const memo = new Map();
  const get = (i) => {
    if (typeof i !== 'number') return i;
    if (i < 0) return undefined;
    if (memo.has(i)) return memo.get(i);
    const v = arr[i];
    if (v === null || typeof v !== 'object') { memo.set(i, v); return v; }
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string') {
        const tag = v[0];
        if (['Reactive', 'ShallowReactive', 'Ref', 'ShallowRef', 'Raw'].includes(tag)) { const r = get(v[1]); memo.set(i, r); return r; }
        if (tag === 'Date') { memo.set(i, v[1]); return v[1]; }
        if (tag === 'Set') { const r = v.slice(1).map(get); memo.set(i, r); return r; }
        if (tag === 'Map') { const r = {}; for (let k = 1; k < v.length; k += 2) r[get(v[k])] = get(v[k + 1]); memo.set(i, r); return r; }
        if (['EmptyRef', 'EmptyShallowRef', 'NuxtError', 'RegExp', 'BigInt', 'Object', 'null'].includes(tag)) { memo.set(i, null); return null; }
      }
      const out = []; memo.set(i, out);
      for (const x of v) out.push(get(x));
      return out;
    }
    const out = {}; memo.set(i, out);
    for (const [k, idx] of Object.entries(v)) out[k] = get(idx);
    return out;
  };
  return get(0);
}

function walk(node, fn, depth = 0, seen = new Set()) {
  if (depth > 25 || node == null || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  fn(node);
  for (const v of Object.values(node)) walk(v, fn, depth + 1, seen);
}

function fromNuxtData(html) {
  const m = html.match(/<script[^>]+id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let root;
  try { root = hydrateNuxt(JSON.parse(m[1])); } catch { return []; }
  const byId = new Map();
  walk(root, n => {
    if (Array.isArray(n) || !n.opponent || typeof n.opponent !== 'object' || !n.opponent.title || !n.date) return;
    // type: R regular, P postseason, S scrimmage/intrasquad, 'upcoming' = next-event widget
    if (n.type !== 'R') return;
    byId.set(n.id ?? `${n.date}|${n.opponent.title}`, n);
  });
  return [...byId.values()].map(n => ({
    date: normalizeDate(n.date),
    rawName: n.opponent.title,
    atVs: /^at$/i.test(n.at_vs ?? '') || n.location_indicator === 'A' ? 'at' : 'vs',
    neutral: n.location_indicator === 'N',
    venue: n.location ?? '',
    event: n.tournament?.title ?? n.tournament?.name ?? '',
    siteConference: n.conference === true ? 'yes' : (n.conference === false ? 'no' : ''),
  }));
}

// --- 2. WMT Digital sites: server-rendered schedule-event-item blocks -----
function fromWmtHtml(html) {
  if (!/class="schedule-event-item/.test(html)) return [];
  const clean = html
    .replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const out = [];
  // Tournament wrappers group their events under a title; plain duals live
  // outside any wrapper. Split into segments so each block knows its wrapper.
  const segments = clean.split(/<div class="schedule-events-by-tournament"/);
  segments.forEach((seg, si) => {
    const event = si === 0 ? '' : (seg.match(/schedule-events-by-tournament__title[^>]*>([^<]+)</)?.[1] ?? '').trim();
    const blocks = seg.split(/<div class="schedule-event-item /).slice(1);
    for (const b of blocks) {
      const cls = b.slice(0, b.indexOf('"'));
      const day = b.match(/schedule-event-date__day[^>]*>\s*([A-Za-z]{3,4}\.?\s+\d{1,2})\s*</)?.[1];
      const head = b.match(/schedule-item-team__heading[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '';
      const divider = head.match(/schedule-item-team__divider[^>]*>\s*([^<]+?)\s*</)?.[1]?.trim().toLowerCase() ?? '';
      const opp = head.replace(/<[^>]+>/g, ' ').replace(/^\s*(at|vs\.?)\s+/i, '').replace(/\s+/g, ' ').trim();
      const venue = b.match(/schedule-event-location[^>]*>([^<]*)</)?.[1]?.trim() ?? '';
      if (!day || !opp) continue;
      const [mon, d] = day.replace('.', '').split(/\s+/);
      out.push({
        date: monthDayToIso(mon, d),
        rawName: opp,
        atVs: /--away/.test(cls) || divider === 'at' ? 'at' : 'vs',
        neutral: /--neutral/.test(cls),
        venue, event, siteConference: '',
      });
    }
  });
  return out;
}

// --- 3. Classic Sidearm sites: server-rendered sidearm-schedule-game <li>s -
// Preferred over JSON-LD because two sites embed last season's JSON-LD under
// this season's URL, while the visible list is current.
function fromSidearmClassic(html) {
  if (!/sidearm-schedule-game-opponent-name/.test(html)) return [];
  const clean = stripMarkup(html);
  const starts = [];
  const re = /<li\b[^>]*class="([^"]*)"[^>]*>/g;
  let m;
  while ((m = re.exec(clean))) if (/(^|\s)sidearm-schedule-game(\s|$)/.test(m[1])) starts.push({ i: m.index, cls: m[1] });
  const out = [];
  for (let k = 0; k < starts.length; k++) {
    const b = clean.slice(starts[k].i, starts[k + 1]?.i ?? clean.length);
    const cls = starts[k].cls;
    const day = b.match(/sidearm-schedule-game-opponent-date[^>]*>\s*<span>\s*([A-Za-z]{3,4}\.?\s+\d{1,2})/)?.[1];
    const opp = b.match(/sidearm-schedule-game-opponent-name[^>]*>\s*(?:<a[^>]*>)?\s*([^<]+?)\s*</)?.[1];
    if (!day || !opp) continue;
    const [mon, d] = day.replace('.', '').split(/\s+/);
    const confDiv = b.match(/sidearm-schedule-game-conference-conference[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '';
    const vsat = b.match(/sidearm-schedule-game-(?:away|home)"[^>]*>\s*(at|vs\.?)/i)?.[1]?.toLowerCase() ?? '';
    const away = /sidearm-schedule-away-game/.test(cls) || vsat === 'at';
    out.push({
      date: monthDayToIso(mon, d),
      rawName: opp.replace(/&amp;/g, '&').trim(),
      atVs: away ? 'at' : 'vs',
      neutral: /sidearm-schedule-neutral-game/.test(cls),
      venue: b.match(/sidearm-schedule-game-location[^>]*>\s*<span>([^<]*)</)?.[1]?.trim() ?? '',
      event: b.match(/sidearm-schedule-game-tournament[^>]*>\s*(?:<[^>]+>\s*)*([^<]+?)\s*</)?.[1]?.trim() ?? '',
      siteConference: /\S/.test(confDiv.replace(/<[^>]+>/g, '')) ? 'yes' : '',
    });
  }
  return out;
}

// --- 4. JSON-LD SportsEvent blocks ("Team at Opponent" / "Team vs. Opp") --
function fromJsonLd(html, schoolTeam) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const nodes = Array.isArray(data) ? data : (data['@graph'] ?? [data]);
    for (const n of nodes) {
      if (!/Event/i.test(String(n['@type'] ?? '')) || !n.startDate || !n.name) continue;
      const name = String(n.name).replace(/\s+/g, ' ').trim();
      let rawName = name, atVs = 'vs';
      const lead = name.match(/^(at|vs\.?|@)\s+(.*)$/i);              // "Vs Northwestern"
      if (lead) {
        rawName = lead[2]; atVs = /^at$|^@$/i.test(lead[1]) ? 'at' : 'vs';
      } else {
        // Pick the " at "/" vs. " split where one side is us — team names can
        // themselves contain "at" ("Tennessee at Chattanooga").
        const seps = [...name.matchAll(/\s+(at|vs\.?|@)\s+/gi)];
        let pick = seps.find(s => mentionsSchool(name.slice(0, s.index), schoolTeam) || mentionsSchool(name.slice(s.index + s[0].length), schoolTeam)) ?? seps[0];
        if (pick) {
          const left = name.slice(0, pick.index), right = name.slice(pick.index + pick[0].length);
          const leftIsUs = mentionsSchool(left, schoolTeam) || !mentionsSchool(right, schoolTeam);
          rawName = leftIsUs ? right : left;
          const isAt = /^at$|^@$/i.test(pick[1]);
          atVs = isAt ? (leftIsUs ? 'at' : 'vs') : (leftIsUs ? 'vs' : 'at');
        }
      }
      out.push({
        date: normalizeDate(n.startDate),
        rawName, atVs, neutral: false,
        venue: n.location?.name ?? n.location?.address?.addressLocality ?? '',
        event: '', siteConference: '',
      });
    }
  }
  return out;
}

// --- 5. Last resort: rendered text --------------------------------------
function fromTextFallback(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  const dateRe = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\.?\s*(Oct|Nov|Dec|Jan|Feb|Mar)\.?\s*(\d{1,2})$/i;
  for (let i = 0; i < lines.length; i++) {
    const d = lines[i].match(dateRe);
    if (!d) continue;
    const window = lines.slice(i + 1, i + 6).join(' | ');
    const opp = window.match(/\b(at|vs\.?)\s+([A-Z][A-Za-z&.'\- ]{2,40})/);
    if (!opp) continue;
    out.push({ date: monthDayToIso(d[1], d[2]), rawName: opp[2].trim(), atVs: /^at$/i.test(opp[1]) ? 'at' : 'vs', neutral: false, venue: '', event: '', siteConference: '', lowConfidence: true });
  }
  return out;
}

/* ------------------------------------------------------- dual vs tournament */
// Opponent strings that are events, not teams.
const NOT_A_DUAL = /\b(invitational|invite|open|classic|championships?|scuffle|clash|tournament|midlands|salute|nationals?|memorial|cliff keen|journeymen|wranglemania|round robin|session|finals|day\s*\d|wrestle[\s-]?offs?|intrasquad|inter-?squad|black\s*(?:&|and)\s*blue|scrimmage|blue[\s-]*(?:\/|vs\.?|and|&|-)?\s*gold|gold[\s-]*(?:\/|vs\.?|and|&|-)?\s*blue|alumni|exhibition|duals?|tri-?meet|quad|ncaa|nwca|tba|tbd)\b|^(big 12|big ten|b1g|acc|eiwa|mac|socon|pac-?12|ivy( league)?|.*conference)$/i;
// Event wrappers whose rows are real dual meets (tri/quad meets, duals events).
const DUAL_EVENT = /\b(duals?|tri|tri-?meet|quad|series|wranglemania|dual meet|multi)\b/i;

// Returns null to keep, or a reason string to drop.
function dropReason(e, opponent) {
  if (!opponent) return 'no opponent';
  if (e.date < SEASON_START || e.date > SEASON_END) return `outside 2026-27 window (${e.date})`;
  if (NOT_A_DUAL.test(opponent) && !isD1(opponent)) return `opponent is an event: ${opponent}`;
  if (e.event && opponent.toLowerCase() === e.event.toLowerCase()) return `opponent == event: ${opponent}`;
  if (e.event && !DUAL_EVENT.test(e.event)) return `bracket event: ${e.event} (${opponent})`;
  return null;
}

// "Maryland / Ohio" on one row = a tri-meet; expand to one row per opponent.
// With "at", the first name is the host; the others are neutral-site duals.
function expandMultiOpponent(e) {
  if (NOT_A_DUAL.test(String(e.rawName))) return [e];          // "Blue / Gold Wrestle Offs" is one intrasquad, not two duals
  const parts = String(e.rawName).split(/\s+\/\s+/).map(p => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.some(p => NOT_A_DUAL.test(p))) return [e];
  return parts.map((p, i) => ({ ...e, rawName: p, neutral: e.neutral || (e.atVs === 'at' && i > 0) }));
}

async function parseAll() {
  const rows = [];
  const report = [];
  const dropped = [];
  const keptInEvent = [];

  for (const s of targets) {
    const file = path.join(CACHE, `${s.slug}.html`);
    if (!existsSync(file)) { report.push([s.name, 'no cache', 0, 0, 0, s.partial]); continue; }
    const html = await readFile(file, 'utf8');
    const me = SCHOOL_TEAM.get(s.slug);

    let events = fromNuxtData(html); let method = 'nuxt';
    if (!events.length) { events = fromWmtHtml(html); method = 'wmt'; }
    if (!events.length) { events = fromSidearmClassic(html); method = 'classic'; }
    if (!events.length) { events = fromJsonLd(html, me); method = 'json-ld'; }
    if (!events.length) { events = fromTextFallback(html); method = 'text-fallback'; }

    let kept = 0, drop = 0, stale = 0;
    for (const e0 of events.flatMap(expandMultiOpponent)) {
      const e = { ...e0 };
      // "Hofstra (Journeymen's WrangleMania)" -> opponent Hofstra, event from the parenthetical
      const paren = String(e.rawName).match(/\(([^)]*)\)\s*$/);
      if (paren && !e.event && DUAL_EVENT.test(paren[1])) e.event = paren[1].trim();
      const opponent = canonicalTeam(e.rawName);
      const why = dropReason(e, opponent);
      if (why) { if (why.startsWith('outside')) stale++; dropped.push(`${s.name.padEnd(20)} ${e.date}  ${why}`); drop++; continue; }
      if (e.event) keptInEvent.push(`${s.name.padEnd(20)} ${e.date}  ${e.event}  ->  ${opponent}`);
      const oppConf = conferenceOf(opponent);
      rows.push({
        school: me?.name ?? s.name, school_conference: s.conference, date: e.date, opponent,   // dataset name, so both schools' listings dedupe
        opponent_conference: oppConf, opponent_d1: isD1(opponent) ? 'yes' : 'no',
        in_conference: oppConf && oppConf === s.conference ? 'yes' : 'no',
        site_conference: e.siteConference,
        home_away: e.neutral ? 'neutral' : (e.atVs === 'at' ? 'away' : 'home'),
        event: e.event, venue: e.venue, method, confidence: e.lowConfidence ? 'low' : 'ok', source_url: s.url,
      });
      kept++;
    }
    report.push([s.name, method, kept, drop, stale, s.partial]);
  }

  // Dedupe: the same dual appears on both schools' pages. Key on the
  // unordered pair; a listing within one day of an existing row for the same
  // pair is treated as the same dual (schools disagree on Fri/Sat dates) and
  // flagged date_conflict.
  const seen = new Map();
  const duals = [];
  const dayDiff = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
  for (const r of rows) {
    const home = r.home_away === 'away' ? r.opponent : r.school;
    const away = r.home_away === 'away' ? r.school : r.opponent;
    const pair = [r.school, r.opponent].sort().join('|').toLowerCase();
    let key = `${r.date}|${pair}`;
    if (!seen.has(key)) {
      const near = [...seen.keys()].find(k => k.endsWith('|' + pair) && dayDiff(k.slice(0, 10), r.date) <= 1);
      if (near) { key = near; seen.get(key).date_conflict = `${r.school} lists ${r.date}`; }
    }
    if (seen.has(key)) {
      const prev = seen.get(key);
      if (!prev.neutral_flag && r.home_away !== 'neutral' && prev.home_team !== home) prev.conflict = `home/away disagree: ${r.school} says ${r.home_away}`;
      if (r.site_conference && !prev.site_conference) prev.site_conference = r.site_conference;
      prev.sources = `${prev.sources}+${r.school}`;
      continue;
    }
    const d = { ...r, home_team: home, away_team: away, neutral_flag: r.home_away === 'neutral', conflict: '', date_conflict: '', sources: r.school };
    seen.set(key, d);
    duals.push(d);
  }
  duals.sort((x, y) => x.date.localeCompare(y.date) || x.home_team.localeCompare(y.home_team));

  const header = ['date', 'home_team', 'away_team', 'neutral', 'in_conference', 'site_conference', 'opponent_d1', 'school_conference', 'opponent_conference', 'event', 'venue', 'method', 'confidence', 'conflict', 'date_conflict', 'sources', 'source_url'];
  const csv = [header.join(',')].concat(duals.map(d => header.map(h => {
    const v = h === 'neutral' ? (d.neutral_flag ? 'yes' : 'no') : d[h];
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
  }).join(','))).join('\n');
  await writeFile(OUT_CSV, csv);
  await writeFile(OUT_JSON, JSON.stringify(duals, null, 2));

  /* coverage report */
  console.log('\nschool                     method       kept  dropped  stale');
  console.log('-'.repeat(62));
  for (const [name, method, n, drop, stale, partial] of report) {
    const flag = n === 0 ? (stale ? '  <-- STALE SEASON' : '  <-- CHECK') : (method === 'text-fallback' ? '  <-- low confidence' : '');
    console.log(`${name.padEnd(26)} ${String(method).padEnd(12)} ${String(n).padStart(4)} ${String(drop).padStart(8)} ${String(stale).padStart(6)}${flag}${partial ? '  (partial)' : ''}`);
  }
  console.log(`\nrows kept ${rows.length}, distinct duals ${duals.length}, in-conference ${duals.filter(d => d.in_conference === 'yes').length}, conflicts ${duals.filter(d => d.conflict).length}, non-D1 opponents ${duals.filter(d => d.opponent_d1 === 'no').length}`);

  console.log('\n--- kept: duals inside multi-dual events (eyeball these) ---');
  keptInEvent.forEach(l => console.log('  ' + l));
  console.log('\n--- dropped as tournaments / non-duals / out of season ---');
  dropped.forEach(l => console.log('  ' + l));
  console.log('\n--- non-D1 opponents kept (JUCO/DII duals: fine, just flagged) ---');
  duals.filter(d => d.opponent_d1 === 'no').forEach(d => console.log(`  ${d.date}  ${d.away_team} at ${d.home_team}${d.neutral_flag ? ' (neutral)' : ''}  [${d.sources}]`));
  if (duals.some(d => d.date_conflict)) {
    console.log('\n--- date disagreements between the two schools\' pages (kept first listing) ---');
    duals.filter(d => d.date_conflict).forEach(d => console.log(`  ${d.date}  ${d.away_team} at ${d.home_team}: ${d.date_conflict}  [${d.sources}]`));
  }
  if (duals.some(d => d.conflict)) {
    console.log('\n--- home/away conflicts between the two schools\' pages ---');
    duals.filter(d => d.conflict).forEach(d => console.log(`  ${d.date}  ${d.away_team} at ${d.home_team}: ${d.conflict}`));
  }
  const confDisagree = duals.filter(d => d.site_conference && d.in_conference !== d.site_conference && d.opponent_d1 === 'yes');
  if (confDisagree.length) {
    console.log('\n--- in-conference derivation disagrees with the site\'s own conference flag ---');
    confDisagree.forEach(d => console.log(`  ${d.date}  ${d.away_team} at ${d.home_team}: dataset says ${d.in_conference}, site says ${d.site_conference}  [${d.sources}]`));
  }
  console.log(`\nwrote ${OUT_CSV} (${duals.length} rows) and ${OUT_JSON}`);
  return duals;
}

/* ---------------------------------------------------------------- compare */
// Scraped in-conference duals vs the projected dataset, by conference.
async function compareAll() {
  const duals = JSON.parse(await readFile(OUT_JSON, 'utf8'));
  const posted = new Map(SCHOOLS.map(s => [SCHOOL_TEAM.get(s.slug)?.id, s]));
  const projected = DS.duals; // includes probability:'unlikely' rows
  const pairKey = (a, b) => [a, b].sort().join('|');
  const projByPair = new Map();
  for (const p of projected) { const k = pairKey(p.home, p.away); (projByPair.get(k) ?? projByPair.set(k, []).get(k)).push(p); }

  const inConf = duals.filter(d => d.in_conference === 'yes');
  const scrapedPairs = new Set();
  const byConf = {};
  const bucket = (conf) => byConf[conf] ??= { matched: [], flipped: [], neutral: [], notProjected: [], unlikelyHit: [], missing: [], dates: { projectedHadDate: 0, sameDate: 0, diffDate: [], hadWeek: 0, sameWeek: 0 } };

  for (const d of inConf) {
    const h = teamIdOf(d.home_team), a = teamIdOf(d.away_team);
    if (!h || !a) continue;
    const conf = d.school_conference;
    const B = bucket(conf);
    const k = pairKey(h, a);
    scrapedPairs.add(k);
    const cands = projByPair.get(k) ?? [];
    const line = `${d.date}  ${d.away_team} at ${d.home_team}${d.neutral_flag ? ' (neutral)' : ''}`;
    if (!cands.length) { B.notProjected.push(line); continue; }
    const p = cands[0];
    if (p.probability === 'unlikely') B.unlikelyHit.push(line);
    if (d.neutral_flag) B.neutral.push(line + `  [${p.id}]`);
    else if (p.home === h) B.matched.push(line + `  [${p.id}]`);
    else B.flipped.push(line + `  (projected ${TEAM_BY_ID.get(p.away).name} at ${TEAM_BY_ID.get(p.home).name}) [${p.id}]`);
    if (p.date) {
      B.dates.projectedHadDate++;
      if (p.date === d.date) B.dates.sameDate++; else B.dates.diffDate.push(`${line}: projected ${p.date}`);
    }
    if (p.week) {
      B.dates.hadWeek++;
      const wk = DS.weekAxis.find(w => w.monday <= d.date && d.date <= w.sunday)?.tag;
      if (wk === p.week) B.dates.sameWeek++;
    }
  }

  // Projected pairings involving a posted, non-partial school that never showed up.
  for (const p of projected) {
    if (p.probability === 'unlikely') continue;
    const k = pairKey(p.home, p.away);
    if (scrapedPairs.has(k)) continue;
    const postedSide = [p.home, p.away].map(id => posted.get(id)).find(s => s && !s.partial);
    if (!postedSide) continue;
    bucket(p.conference).missing.push(`${TEAM_BY_ID.get(p.away).name} at ${TEAM_BY_ID.get(p.home).name}  [${p.id}, ${p.confidence}]  (posted: ${postedSide.name})`);
  }

  console.log('\n================ SCRAPED vs PROJECTED, by conference ================');
  for (const conf of DS.conferences.map(c => c.id)) {
    const B = byConf[conf];
    const postedHere = SCHOOLS.filter(s => s.conference === conf).map(s => s.name + (s.partial ? '*' : ''));
    console.log(`\n=== ${conf}  (posted: ${postedHere.join(', ') || 'none'}${postedHere.some(n => n.endsWith('*')) ? '   * = partial' : ''}) ===`);
    if (!B) { console.log('  no in-conference duals scraped'); continue; }
    const matchedAll = B.matched.length + B.flipped.length + B.neutral.length;
    console.log(`  scraped in-conference duals: ${matchedAll + B.notProjected.length}`);
    console.log(`  pairing matched:            ${matchedAll}   (venue matched ${B.matched.length} / flipped ${B.flipped.length} / neutral site ${B.neutral.length})`);
    console.log(`  pairing not in projection:  ${B.notProjected.length}`);
    console.log(`  projected pairing missing:  ${B.missing.length}   (involving a fully-posted school)`);
    console.log(`  dates: projection had a real date for ${B.dates.projectedHadDate} (same ${B.dates.sameDate}, differs ${B.dates.diffDate.length}); had a projected week for ${B.dates.hadWeek}, actual falls in that week ${B.dates.sameWeek}`);
    if (B.flipped.length) { console.log('  FLIPPED:'); B.flipped.forEach(l => console.log('    ' + l)); }
    if (B.neutral.length) { console.log('  NEUTRAL SITE:'); B.neutral.forEach(l => console.log('    ' + l)); }
    if (B.notProjected.length) { console.log('  NOT IN PROJECTION:'); B.notProjected.forEach(l => console.log('    ' + l)); }
    if (B.unlikelyHit.length) { console.log('  projected as "unlikely" but actually scheduled:'); B.unlikelyHit.forEach(l => console.log('    ' + l)); }
    if (B.missing.length) { console.log('  MISSING:'); B.missing.forEach(l => console.log('    ' + l)); }
    if (B.dates.diffDate.length) { console.log('  DATE DIFFERS:'); B.dates.diffDate.forEach(l => console.log('    ' + l)); }
  }

  /* composites: three-way view (school scrape | projection | composite) */
  const composites = await loadComposites();
  const COMP_NOTE = {
    'big-ten': '2027 season page exists (bigten.org/wrest/schedule/2027/) but held 0 games as of Sept 21',
    socon: '2027 season page exists (soconsports.com/wrest/schedule/2027/) but held 0 games as of Sept 21',
    eiwa: 'no 2026-27 composite published (eiwawrestling.org 404)',
    ivy: 'no conference composite schedule',
  };
  console.log('\n================ COMPOSITE SCHEDULES: school scrape vs projection vs composite ================');
  for (const conf of DS.conferences.map(c => c.id)) {
    const comp = composites[conf];
    console.log(`\n=== ${conf} ===`);
    if (!comp) { console.log('  composite: ' + (COMP_NOTE[conf] ?? 'not fetched (run: node scrape-duals.mjs composites)')); continue; }
    if (!comp.duals.some(d => d.in_conference)) { console.log(`  composite feed reachable but has no wrestling events (${comp.events}) — not published yet`); continue; }
    const rows = threeWay(conf, inConf.filter(d => d.school_conference === conf), projected, comp.duals);
    printThreeWay(conf, rows);
  }

  /* Pac-12 */
  console.log('\n================ PAC-12: conference duals per posted team ================');
  const p12comp = composites['pac-12'];
  console.log('  composite (pac-12.com): ' + (p12comp?.duals.some(d => d.in_conference) ? 'PUBLISHED - see three-way table above' : 'feed exists but has 0 wrestling events as of Sept 21 - not published; verdict below rests on the posted school pages'));
  const p12ids = new Set(DS.conferences.find(c => c.id === 'pac-12').teams);
  const p12 = duals.filter(d => d.in_conference === 'yes' && p12ids.has(teamIdOf(d.home_team)) && p12ids.has(teamIdOf(d.away_team)));
  for (const s of SCHOOLS.filter(s => s.conference === 'pac-12')) {
    const t = SCHOOL_TEAM.get(s.slug).name;
    const mine = p12.filter(d => d.home_team === t || d.away_team === t);
    const home = mine.filter(d => d.home_team === t && !d.neutral_flag).length;
    const away = mine.filter(d => d.away_team === t && !d.neutral_flag).length;
    const opps = mine.map(d => (d.home_team === t ? d.away_team : d.home_team)).sort();
    console.log(`  ${t.padEnd(20)} ${mine.length} conference duals  (home ${home} / away ${away} / neutral ${mine.length - home - away})`);
    console.log(`      opponents: ${opps.join(', ')}`);
    const missing = [...p12ids].map(id => TEAM_BY_ID.get(id).name).filter(n => n !== t && !opps.includes(n));
    if (missing.length) console.log(`      not on schedule: ${missing.join(', ')}`);
  }
  console.log(`  distinct Pac-12 conference duals seen: ${p12.length}  (9-team round robin = 36 total, 8 per team)`);
  const p12dates = p12.map(d => d.date).sort();
  if (p12dates.length) console.log(`  date range: ${p12dates[0]} .. ${p12dates[p12dates.length - 1]}`);
}


/* -------------------------------------------------------------- composites */
// Conference composite schedules: the PRIMARY source for in-conference
// pairings and home/away wherever a conference publishes one. Sidearm-template
// conference sites expose an ICS subscription feed per sport (sport_id is the
// conference's own numbering). Status as of Sept 21, 2026:
//   acc, mac      populated for 2026-27
//   big-12        feed exists, 0 wrestling events
//   pac-12        feed exists, 0 wrestling events
//   big-ten,socon Next.js "nextgen" sites; the 2027 season pages exist
//                 (bigten.org/wrest/schedule/2027/, soconsports.com/wrest/
//                 schedule/2027/) but held 0 games. Their game objects carry
//                 team-level results (results.away_points/home_points) once
//                 played — a dual-result source worth revisiting in Nov.
//   eiwa          no 2026-27 composite (404)
const COMPOSITES = [
  { conf: 'acc',    url: 'https://theacc.com/services/responsive-calendar-subscription.ashx/calendar.ics?sport_id=33' },
  { conf: 'mac',    url: 'https://getsomemaction.com/services/responsive-calendar-subscription.ashx/calendar.ics?sport_id=16' },
  { conf: 'big-12', url: 'https://big12sports.com/services/responsive-calendar-subscription.ashx/calendar.ics?sport_id=21' },
  { conf: 'pac-12', url: 'https://pac-12.com/services/responsive-calendar-subscription.ashx/calendar.ics?sport_id=32' },
];
const COMPOSITE_DIR = path.join(CACHE, 'composite');

async function fetchComposites() {
  await mkdir(COMPOSITE_DIR, { recursive: true });
  for (const c of COMPOSITES) {
    const file = path.join(COMPOSITE_DIR, `${c.conf}.ics`);
    if (existsSync(file) && !refetch) { console.log(`  cached ${c.conf}`); continue; }
    try {
      const res = await fetch(c.url, { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await writeFile(file, text);
      console.log(`  ok   ${c.conf} (${(text.match(/BEGIN:VEVENT/g) ?? []).length} events)`);
    } catch (err) { console.log(`  FAIL ${c.conf}: ${err.message}`); }
    await sleep(DELAY_MS);
  }
}

// ICS basic-format dates: all-day "20261101" or UTC "20261022T220000Z" (the
// latter rendered in US Central like every other zoned timestamp).
function icsDate(val) {
  const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/);
  if (!m) return normalizeDate(val);
  if (!m[4]) return `${m[1]}-${m[2]}-${m[3]}`;
  return normalizeDate(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] || ''}`);
}
// RFC 5545: continuation lines start with a space; unfold before parsing.
function parseIcs(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const key = line.slice(0, i).split(';')[0], val = line.slice(i + 1);
    if (key === 'DTSTART') cur.date = icsDate(val);
    else if (key === 'SUMMARY') cur.summary = val.replace(/\\,/g, ',').replace(/\s+/g, ' ').trim();
    else if (key === 'LOCATION') cur.location = val.replace(/\\,/g, ',').trim();
  }
  return events;
}

// "Wrestling {member} vs {opponent}" / "Wrestling {member} at {opponent}".
// Each conference dual appears twice (once per member), so dedupe on the
// unordered pair with the same ±1-day tolerance used for school pages.
function compositeDuals(conf, events) {
  const seen = new Map();
  const dayDiff = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
  for (const e of events) {
    const m = (e.summary ?? '').match(/^Wrestling\s+(.+?)\s+(vs\.?|at)\s+(.+)$/i);
    if (!m || !e.date) continue;
    const member = canonicalTeam(m[1]), opp = canonicalTeam(m[3]);
    if (!opp || member.toLowerCase() === opp.toLowerCase()) continue;
    if (NOT_A_DUAL.test(opp) && !isD1(opp)) continue;
    const away = /^at$/i.test(m[2]);
    const home = away ? opp : member, awayTeam = away ? member : opp;
    const pair = [member, opp].sort().join('|').toLowerCase();
    let key = `${e.date}|${pair}`;
    if (!seen.has(key)) {
      const near = [...seen.keys()].find(k => k.endsWith('|' + pair) && dayDiff(k.slice(0, 10), e.date) <= 1);
      if (near) key = near;
    }
    if (seen.has(key)) {
      const prev = seen.get(key);
      if (prev.home_team !== home) prev.venue_conflict = `${member} lists ${away ? 'away' : 'home'}`;
      prev.sources.push(member);
      continue;
    }
    seen.set(key, {
      date: e.date, home_team: home, away_team: awayTeam, location: e.location ?? '',
      in_conference: conferenceOf(member) === conf && conferenceOf(opp) === conf,
      sources: [member], venue_conflict: '',
    });
  }
  return [...seen.values()];
}

async function loadComposites() {
  const out = {};
  for (const c of COMPOSITES) {
    const file = path.join(COMPOSITE_DIR, `${c.conf}.ics`);
    if (!existsSync(file)) continue;
    const events = parseIcs(await readFile(file, 'utf8'));
    out[c.conf] = { events: events.length, duals: compositeDuals(c.conf, events) };
  }
  return out;
}

// Three-way view for one conference: school-site scrape vs projection vs
// composite, keyed on the unordered in-conference pairing.
function threeWay(conf, scraped, projected, composite) {
  const pairKey = (a, b) => [a, b].sort().join('|');
  const rows = new Map();
  const row = (k) => rows.get(k) ?? rows.set(k, { scrape: null, proj: null, comp: null }).get(k);
  for (const d of scraped) { const h = teamIdOf(d.home_team), a = teamIdOf(d.away_team); if (h && a) row(pairKey(h, a)).scrape = { home: h, away: a, date: d.date, neutral: d.neutral_flag }; }
  for (const p of projected) if (p.conference === conf && p.probability !== 'unlikely') row(pairKey(p.home, p.away)).proj = { home: p.home, away: p.away, id: p.id, unlikely: false };
  for (const p of projected) if (p.conference === conf && p.probability === 'unlikely') { const r = row(pairKey(p.home, p.away)); if (!r.proj) r.proj = { home: p.home, away: p.away, id: p.id, unlikely: true }; }
  for (const d of composite) { if (!d.in_conference) continue; const h = teamIdOf(d.home_team), a = teamIdOf(d.away_team); if (h && a) row(pairKey(h, a)).comp = { home: h, away: a, date: d.date, conflict: d.venue_conflict }; }
  return rows;
}

function printThreeWay(conf, rows, postedIds) {
  const name = id => TEAM_BY_ID.get(id)?.name ?? id;
  const fmt = (x, withDate) => x ? `${name(x.away)} at ${name(x.home)}${withDate && x.date ? ' ' + x.date : ''}${x.unlikely ? ' (unlikely)' : ''}${x.neutral ? ' (N)' : ''}` : '—';
  const stats = { compDuals: 0, compVsProjMatched: 0, compVsProjFlipped: 0, compNotProjected: 0, projMissingFromComp: 0,
    compVsScrapeAgree: 0, compVsScrapeVenue: 0, onlyScrape: 0, onlyComp: 0, projUnlikelyButReal: 0 };
  const lines = [];
  for (const [, r] of rows) {
    if (r.comp) {
      stats.compDuals++;
      if (r.proj) { if (r.proj.home === r.comp.home) stats.compVsProjMatched++; else stats.compVsProjFlipped++; if (r.proj.unlikely) stats.projUnlikelyButReal++; }
      else stats.compNotProjected++;
      if (r.scrape) { if (r.scrape.home === r.comp.home || r.scrape.neutral) stats.compVsScrapeAgree++; else stats.compVsScrapeVenue++; }
      else stats.onlyComp++;
    } else {
      if (r.proj && !r.proj.unlikely) stats.projMissingFromComp++;
      if (r.scrape) stats.onlyScrape++;
    }
    const flags = [];
    if (r.comp && r.proj && r.proj.home !== r.comp.home) flags.push('PROJ-FLIP');
    if (r.comp && r.scrape && !r.scrape.neutral && r.scrape.home !== r.comp.home) flags.push('SCRAPE-FLIP');
    if (r.comp && r.proj?.unlikely) flags.push('WAS-UNLIKELY');
    if (r.comp && !r.proj) flags.push('NOT-PROJECTED');
    if (!r.comp && r.proj && !r.proj.unlikely) flags.push('NO-COMP');
    if (r.comp && !r.scrape) flags.push('NO-SCRAPE');
    if (r.comp?.conflict) flags.push('COMP-VENUE-CONFLICT');
    if (flags.length) lines.push(`    ${fmt(r.scrape, true).padEnd(44)} | ${fmt(r.proj, false).padEnd(44)} | ${fmt(r.comp, true).padEnd(44)} ${flags.join(',')}`);
  }
  console.log(`  composite in-conference duals: ${stats.compDuals}`);
  console.log(`  composite vs projection:  pairing matched ${stats.compVsProjMatched + stats.compVsProjFlipped} (venue matched ${stats.compVsProjMatched} / flipped ${stats.compVsProjFlipped}), not projected ${stats.compNotProjected}, projected-but-absent ${stats.projMissingFromComp}, "unlikely" but real ${stats.projUnlikelyButReal}`);
  console.log(`  composite vs school scrape: agree ${stats.compVsScrapeAgree}, venue differs ${stats.compVsScrapeVenue}, only on school pages ${stats.onlyScrape}, only in composite ${stats.onlyComp}`);
  if (lines.length) {
    console.log(`    ${'SCHOOL-SITE SCRAPE'.padEnd(44)} | ${'PROJECTION'.padEnd(44)} | ${'COMPOSITE'.padEnd(44)} FLAGS`);
    lines.forEach(l => console.log(l));
  } else console.log('    (every pairing agrees across all three sources)');
  return stats;
}

/* ------------------------------------------------------------------- main */

if (stage === 'fetch' || stage === 'all') {
  console.log(`fetching ${targets.length} schedules...\n`);
  await fetchAll();
}
if (stage === 'parse' || stage === 'all') {
  await parseAll();
}
if (stage === 'composites') {
  console.log('fetching conference composite feeds...\n');
  await fetchComposites();
}
if (stage === 'compare') {
  await compareAll();
}

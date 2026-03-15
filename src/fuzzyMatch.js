// src/fuzzyMatch.js
// Extracted from App.jsx — shared fuzzy name matcher used by both the app and sync function

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (j === 0 ? i : 0))
  );
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

export function normName(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s'-]/g, '').replace(/\s+/g, ' ').trim();
}

export function stripParen(s) {
  return s.replace(/\s*[\[([^)\]]*[\])]/g, '').trim();
}

export function buildNameIndex(wrestlers) {
  // wrestlers: { 125: [{seed, name, school}, ...], 133: [...], ... }
  const idx = [];
  for (const [weight, list] of Object.entries(wrestlers)) {
    for (const wr of list) {
      idx.push({
        weight: Number(weight),
        seed: wr.seed,
        name: wr.name,
        school: wr.school,
        norm: normName(wr.name),
      });
    }
  }
  return idx;
}

export function fuzzyFind(raw, idx, threshold = 4) {
  const n = normName(stripParen(raw));
  if (!n || n.length < 2) return null;
  let best = null, bestScore = Infinity;
  for (const e of idx) {
    if (e.norm === n) return { entry: e, dist: 0, exact: true };
    const rawLast = n.split(' ').slice(-1)[0];
    const eLast = e.norm.split(' ').slice(-1)[0];
    const score = Math.min(levenshtein(n, e.norm), levenshtein(rawLast, eLast) + 1);
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return bestScore <= threshold ? { entry: best, dist: bestScore, exact: false } : null;
}
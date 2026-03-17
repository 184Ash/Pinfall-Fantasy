import { WEIGHT_CLASSES } from '../constants';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
export const pickKey = (w,s) => `${w}-${s}`;

// Levenshtein for fuzzy name matching
export function levenshtein(a,b){
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>j===0?i:0));
  for(let j=1;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}
export function normName(s){return s.toLowerCase().replace(/[^a-z0-9\s'-]/g,"").replace(/\s+/g," ").trim();}
export function stripParen(s){return s.replace(/\s*[\[(][^\])]*[\])]/g,"").trim();}

export function buildNameIndex(wrestlers){
  const idx=[];
  WEIGHT_CLASSES.forEach(w=>{(wrestlers[w]||[]).forEach(wr=>{
    idx.push({weight:w,seed:wr.seed,name:wr.name,school:wr.school,norm:normName(wr.name)});
  });});
  return idx;
}

export function fuzzyFind(raw,idx,threshold=4){
  const n=normName(stripParen(raw));
  if(!n||n.length<2) return null;
  let best=null,bestScore=Infinity;
  for(const e of idx){
    if(e.norm===n) return {entry:e,dist:0,exact:true};
    const rawLast=n.split(" ").slice(-1)[0];
    const eLast=e.norm.split(" ").slice(-1)[0];
    const score=Math.min(levenshtein(n,e.norm),levenshtein(rawLast,eLast)+1);
    if(score<bestScore){bestScore=score;best=e;}
  }
  return bestScore<=threshold?{entry:best,dist:bestScore,exact:false}:null;
}

// ─── RAW SCORE IMPORT PARSER ──────────────────────────────────────────────────
// Strategy: extract (name, points) pairs directly from pasted text.
// This is more reliable than reconstructing from bout-by-bout results,
// since TrackWrestling and FloWrestling both show cumulative fantasy pts.
//
// Supported paste formats:
//   TW standings: "1  John Smith  Iowa  14.0"  (rank name school pts)
//   TW individual: "John Smith (Iowa)  14.0 pts"
//   Flo CSV: "Name,School,Points,Place" or "Wrestler,School,Pts"
//   Generic: any line containing a name and a number that looks like points
//
export function parseScoreText(text){
  const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);
  const pairs={}; // normName -> { rawName, pts }

  // Detect CSV header
  const firstLower=(lines[0]||"").toLowerCase();
  const isCSV=firstLower.includes(",");
  const cols=firstLower.split(",").map(c=>c.replace(/[^a-z]/g,""));
  const nameCol=cols.findIndex(c=>["name","wrestler","athlete"].some(k=>c.includes(k)));
  const ptsCol=cols.findIndex(c=>["pts","points","score","fantasy"].some(k=>c.includes(k)));
  const schoolCol=cols.findIndex(c=>["school","team","college","university"].some(k=>c.includes(k)));

  if(isCSV && ptsCol>=0){
    // Parse as CSV
    lines.slice(1).forEach(line=>{
      const parts=line.split(",").map(s=>s.replace(/^"|"$/g,"").trim());
      const name=parts[nameCol>=0?nameCol:0];
      const ptsRaw=parts[ptsCol];
      const pts=parseFloat(ptsRaw);
      if(name&&!isNaN(pts)&&pts>=0){
        pairs[normName(name)]={rawName:name,pts};
      }
    });
    return pairs;
  }

  // Non-CSV: line-by-line heuristics
  // Pattern 1 — TW standings block: optional rank, name, optional school, number
  // e.g. "3  Stevo Poulin  Iowa State  12.0"
  //      "Stevo Poulin  Iowa State  12.0 pts"
  //      "Stevo Poulin (Iowa State) — 12.0"
  const ptsPat=/(\d+(?:\.\d+)?)\s*(?:pts?|points?|fantasy\s*pts?)?[\s]*$/i;
  const rankLeadPat=/^\d+\s+/; // leading rank number

  lines.forEach(line=>{
    // Strip rank if present
    let l=line.replace(rankLeadPat,"").trim();
    // Find trailing number that looks like pts (0–100 range)
    const m=l.match(ptsPat);
    if(!m) return;
    const pts=parseFloat(m[1]);
    if(pts<0||pts>120) return; // sanity bound

    // Remove the pts portion and any trailing separators
    let namePart=l.slice(0,l.lastIndexOf(m[1])).replace(/[-–—|,\s]+$/,"").trim();
    // Strip parenthetical school annotation
    namePart=stripParen(namePart);
    // If there are 3+ words, the last word(s) might be the school — try longest name first
    // We'll keep the full string as the name candidate; fuzzy matching will handle it
    if(namePart.length>2){
      pairs[normName(namePart)]={rawName:namePart,pts};
    }
  });

  return pairs;
}

export function matchScoresToRoster(scorePairs, nameIndex, picks){
  const matched=[], unmatched=[];
  Object.entries(scorePairs).forEach(([norm,{rawName,pts}])=>{
    const m=fuzzyFind(rawName,nameIndex);
    if(m){
      const key=pickKey(m.entry.weight,m.entry.seed);
      const drafted=!!picks[key];
      matched.push({entry:m.entry,pts,rawName,exact:m.exact,dist:m.dist,drafted,key});
    } else {
      unmatched.push({rawName,pts});
    }
  });
  return {matched,unmatched};
}

// ─── CHIME ───────────────────────────────────────────────────────────────────
export function playChime(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const playNote=(freq,start,dur,vol=0.15)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.type="sine";osc.frequency.value=freq;
      gain.gain.setValueAtTime(0,start);
      gain.gain.linearRampToValueAtTime(vol,start+0.012);
      gain.gain.exponentialRampToValueAtTime(0.001,start+dur);
      osc.start(start);osc.stop(start+dur);
    };
    // Soft two-note chime: C5 then E5 (gentle major third)
    playNote(523.25,ctx.currentTime,1.1);
    playNote(659.25,ctx.currentTime+0.18,1.0,0.11);
    setTimeout(()=>ctx.close(),2200);
  }catch(e){}
}

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

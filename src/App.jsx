import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { DEFAULT_WRESTLERS } from './wrestlers';
import { loadDraftState, savePick, savePoints } from './leagueService';
import { useRealtimePicks } from './hooks/useRealtimePicks';
import { useRealtimePoints } from './hooks/useRealtimePoints';
import RejoinApprovalBanner from './RejoinApprovalBanner';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const WEIGHT_CLASSES = [125,133,141,149,157,165,174,184,197,285];

const TEAM_COLORS = [
  {bg:"#C8102E",glow:"#C8102E55",text:"#ff6b80"},
  {bg:"#1A56DB",glow:"#1A56DB55",text:"#6ba3ff"},
  {bg:"#057A55",glow:"#057A5555",text:"#34d399"},
  {bg:"#D97706",glow:"#D9770655",text:"#fbbf24"},
  {bg:"#7E3AF2",glow:"#7E3AF255",text:"#c084fc"},
  {bg:"#0694A2",glow:"#0694A255",text:"#22d3ee"},
  {bg:"#BE185D",glow:"#BE185D55",text:"#f472b6"},
  {bg:"#059669",glow:"#05966955",text:"#6ee7b7"},
  {bg:"#B45309",glow:"#B4530955",text:"#f59e0b"},
  {bg:"#1E429F",glow:"#1E429F55",text:"#93c5fd"},
  {bg:"#9B1C1C",glow:"#9B1C1C55",text:"#fca5a5"},
  {bg:"#5521B5",glow:"#5521B555",text:"#a78bfa"},
];

const DEFAULT_TEAMS = [
  "Raging Bulls","Iron Wolves","Thunder Hawks","Steel Bears",
  "Crimson Eagles","Gold Rush","Blue Devils","Night Owls","Blaze Kings","Silver Foxes",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const pickKey = (w,s) => `${w}-${s}`;

// Levenshtein for fuzzy name matching
function levenshtein(a,b){
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>j===0?i:0));
  for(let j=1;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}
function normName(s){return s.toLowerCase().replace(/[^a-z0-9\s'-]/g,"").replace(/\s+/g," ").trim();}
function stripParen(s){return s.replace(/\s*[\[(][^\])]*[\])]/g,"").trim();}

function buildNameIndex(wrestlers){
  const idx=[];
  WEIGHT_CLASSES.forEach(w=>{(wrestlers[w]||[]).forEach(wr=>{
    idx.push({weight:w,seed:wr.seed,name:wr.name,school:wr.school,norm:normName(wr.name)});
  });});
  return idx;
}

function fuzzyFind(raw,idx,threshold=4){
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
function parseScoreText(text){
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

function matchScoresToRoster(scorePairs, nameIndex, picks){
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

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css=`
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#070a0e;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:#0d1117;}
::-webkit-scrollbar-thumb{background:#c9a84c66;border-radius:3px;}
::-webkit-scrollbar-thumb:hover{background:#c9a84c;}
.wrow{transition:background .1s;}
.wrow:hover{background:rgba(201,168,76,.05) !important;}
.taken-row{opacity:.42;}
.btn{cursor:pointer;border:none;transition:all .13s;font-family:'Oswald',sans-serif;}
.btn:hover{filter:brightness(1.2);}
.btn-primary{background:#c9a84c;color:#070a0e;border-radius:5px;font-weight:700;letter-spacing:.08em;}
.btn-ghost{background:transparent;color:#c9a84c;border:1px solid #c9a84c44;border-radius:5px;}
.btn-ghost:hover{background:#c9a84c18;}
.btn-danger{background:transparent;color:#b04040;border:1px solid #5a1c1c;border-radius:5px;}
.btn-sm{padding:3px 10px;font-size:11px;}
.btn-md{padding:7px 16px;font-size:13px;}
.btn-lg{padding:9px 22px;font-size:14px;}
.undo-x{cursor:pointer;border:none;background:none;color:#3a2a2a;transition:color .15s;font-size:13px;padding:1px 4px;}
.undo-x:hover{color:#f87171;}
.pulse{animation:pulseAnim 2.2s infinite;}
@keyframes pulseAnim{0%,100%{opacity:1}50%{opacity:.45}}
.flash-row{animation:flashRow .7s ease-out;}
@keyframes flashRow{0%{background:rgba(201,168,76,.3)}100%{background:transparent}}
.slide-down{animation:slideDown .2s ease-out;}
@keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.tab-link{cursor:pointer;border:none;background:none;transition:all .15s;white-space:nowrap;font-family:'Oswald',sans-serif;}
.tab-link:hover{opacity:.8;}
input:focus,select:focus,textarea:focus{outline:none;border-color:#c9a84c !important;box-shadow:0 0 0 2px #c9a84c22;}
select{cursor:pointer;}
.avail-bar{transition:width .5s cubic-bezier(.4,0,.2,1);}
.card{background:#0b0f14;border:1px solid #1a1f26;border-radius:10px;overflow:hidden;}
.card-h{transition:border-color .2s;}
.card-h:hover{border-color:#c9a84c33 !important;}
.sec-label{font-size:10px;letter-spacing:.18em;color:#6a5a30;font-family:'Oswald',sans-serif;font-weight:400;}
.inp{background:#070a0e;border:1px solid #1e2530;border-radius:6px;color:#d0c8b4;font-family:'Barlow Condensed',sans-serif;font-size:14px;padding:7px 11px;width:100%;}
.inp-sm{font-size:12px;padding:4px 8px;}
.rank-badge{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:'Oswald',sans-serif;flex-shrink:0;}
.override-btn:hover{background:rgba(201,168,76,.14) !important;border-radius:3px;}
textarea{resize:vertical;}
`;

// ─── COMMISSIONER ONLY ───────────────────────────────────────────────────────
// Wraps any element. Non-commissioners see a locked/disabled overlay instead.
function CommissionerOnly({ isCommissioner, label = "Commissioner only", children }) {
  if (isCommissioner) return children;
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <div style={{ opacity: 0.25, pointerEvents: "none", userSelect: "none" }}>
        {children}
      </div>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(7,10,14,0.55)",
        borderRadius: 6,
        cursor: "not-allowed",
      }}
        title={label}
      >
        <span style={{
          fontSize: 9, letterSpacing: ".14em", color: "#4a5a6a",
          fontFamily: "'Oswald',sans-serif", fontWeight: 600,
          background: "#0d1117", border: "1px solid #1e2530",
          borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap",
        }}>
          🔒 {label.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────

// Picks per team: 10 weight slots + 1 bonus "dark horse" (can be toggled off)
const PICKS_PER_TEAM_BASE = 10; // without bonus
const PICKS_PER_TEAM_BONUS = 11; // with bonus
const TEAM_SOFT_CAP = 20; // warn above this
const TEAM_HARD_CAP = 30; // block above this

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App({
  leagueId,
  session,      // { leagueId, teamIds: string[], role: "commissioner"|"co_commissioner"|"member" }
  leagueName,
  teams: teamsProp,   // [{ id, name, draft_position, role, is_claimed, claimed_by }]
  settings,     // { rotationType, bonusPickEnabled, draftOrder, draftStarted }
}){
  // ── Derive team name list from props (fall back to defaults for standalone dev use) ──
  const [teams,setTeams]=useState(()=>{
    if(teamsProp&&teamsProp.length>0) return teamsProp.map(t=>t.name);
    return DEFAULT_TEAMS;
  });

  // ── Commissioner check — real session role ────────────────────────────────
  const isCommissioner=session?.role==="commissioner"||session?.role==="co_commissioner";

  // Draft is always already live when this component mounts (WaitingRoom handled Start Draft)
  const draftStarted=true;

  const [wrestlers,setWrestlers]=useState(DEFAULT_WRESTLERS);
  const [picks,setPicks]=useState({});
  const [bonusKeys,setBonusKeys]=useState([]); // pick keys manually designated as bonus
  const [points,setPoints]=useState({});
  const [stateLoading,setStateLoading]=useState(!!leagueId);
  // Always open at the draft board — draft is live on mount
  const [activePage,setActivePage]=useState("board");

  // ── Load persisted draft state from Supabase on mount ────────────
  useEffect(()=>{
    if(!leagueId) return;
    loadDraftState(leagueId).then(state=>{
      if(!state) return;
      if(Object.keys(state.wrestlers).length>0) setWrestlers(state.wrestlers);
      if(Object.keys(state.picks).length>0) setPicks(state.picks);
      if(state.bonusKeys.length>0) setBonusKeys(state.bonusKeys);
      if(Object.keys(state.points).length>0) setPoints(state.points);
    }).catch(err=>{
      console.error('Failed to load draft state:', err);
    }).finally(()=>{
      setStateLoading(false);
    });
  },[leagueId]);

  // ── Real-time sync — incoming picks from other devices ───────────
  const handleRemotePick = useCallback(({ key, teamName }) => {
    setPicks(p => {
      if (p[key]) return p; // already have it (own pick) — suppress
      return { ...p, [key]: teamName };
    });
  }, []);

  // ── Real-time sync — incoming points updates ─────────────────────
  const handleRemotePoints = useCallback(({ key, pts }) => {
    setPoints(p => ({ ...p, [key]: pts }));
  }, []);

  useRealtimePicks(leagueId, wrestlers, teamsProp, handleRemotePick);
  useRealtimePoints(leagueId, wrestlers, handleRemotePoints);

  const [searchQ,setSearchQ]=useState("");
  const [toast,setToast]=useState(null);
  const [hlKey,setHlKey]=useState(null);

  // ── Settings — seed from props when provided ──────────────────────────────
  const [draftOrder,setDraftOrder]=useState(()=>{
    // settings.draftOrder stores draft_position numbers — map them back to team names
    if(settings?.draftOrder&&settings.draftOrder.length>0&&teamsProp&&teamsProp.length>0){
      return settings.draftOrder.map(pos=>{
        const team=teamsProp.find(t=>t.draft_position===pos);
        return team?.name||`Team ${pos}`;
      });
    }
    if(teamsProp&&teamsProp.length>0) return [...teamsProp].sort((a,b)=>a.draft_position-b.draft_position).map(t=>t.name);
    return DEFAULT_TEAMS;
  });
  const [rotationType,setRotationType]=useState(settings?.rotationType||"snake");
  const [bonusPickEnabled,setBonusPickEnabled]=useState(settings?.bonusPickEnabled!==false);
  const picksPerTeam=bonusPickEnabled?PICKS_PER_TEAM_BONUS:PICKS_PER_TEAM_BASE;

  // ── Ascending pick timer ──────────────────────────────────────────────────
  const [timerSec,setTimerSec]=useState(0);
  const [timerPaused,setTimerPaused]=useState(false);
  const timerRef=useRef(null);
  const timerPausedRef=useRef(false);
  const resetTimer=()=>{
    setTimerSec(0);
    setTimerPaused(false);
    timerPausedRef.current=false;
    if(timerRef.current) clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{if(!timerPausedRef.current)setTimerSec(s=>s+1);},1000);
  };
  const pauseTimer=()=>{timerPausedRef.current=true;setTimerPaused(true);};
  const resumeTimer=()=>{timerPausedRef.current=false;setTimerPaused(false);};
  const [_timerInit]=useState(()=>{
    // Draft is always live on mount — start timer running immediately
    timerPausedRef.current=false;
    timerRef.current=setInterval(()=>{if(!timerPausedRef.current)setTimerSec(s=>s+1);},1000);
    return null;
  });

  // ── Draft order computation ───────────────────────────────────────────────
  const totalPicks=Object.keys(picks).length;
  const n=Math.max(draftOrder.length,1);
  const round=Math.floor(totalPicks/n);
  const pos=totalPicks%n;

  const onClock=useMemo(()=>{
    if(draftOrder.length===0) return "";
    if(rotationType==="snake"){
      return round%2===0?draftOrder[pos]:draftOrder[n-1-pos];
    }
    if(rotationType==="linear"){
      return draftOrder[pos];
    }
    if(rotationType==="third_round_reversal"){
      // Rounds 0,1 snake; round 2 reverses again and stays reversed for all odd rounds after
      const effectiveRound=round;
      if(effectiveRound%2===0) return draftOrder[pos];
      return draftOrder[n-1-pos];
    }
    return draftOrder[pos];
  },[draftOrder,rotationType,round,pos,n]);

  // ── Roster limit helpers ──────────────────────────────────────────────────
  const getRosterStatus=(team)=>{
    const total=Object.values(picks).filter(t=>t===team).length;
    return {total,remaining:picksPerTeam-total};
  };
  const canDraft=(team)=>getRosterStatus(team).remaining>0;

  // Whether the current user is allowed to make a pick for the on-clock team
  // (true if they claimed the on-clock team, or claimed multiple teams including it)
  const userCanPickNow=(onClockTeamName)=>{
    if(!onClockTeamName) return false;
    if(isCommissioner) return true;
    // Map the on-clock team name back to its id to check session.teamIds
    const onClockTeam=teamsProp?.find(t=>t.name===onClockTeamName);
    const onClockId=onClockTeam?.id||onClockTeamName;
    return !!(session?.teamIds?.includes(onClockId));
  };

  const getColor=(name)=>{
    const i=teams.indexOf(name);
    return TEAM_COLORS[((i%TEAM_COLORS.length)+TEAM_COLORS.length)%TEAM_COLORS.length];
  };

  const showToast=(msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),2600);};

  // ── All wrestlers flat list ───────────────────────────────────────────────
  const allWrestlers=useMemo(()=>{
    const list=[];
    WEIGHT_CLASSES.forEach(w=>(wrestlers[w]||[]).forEach(wr=>list.push({...wr,weight:w})));
    return list;
  },[wrestlers]);

  // ── Search results ────────────────────────────────────────────────────────
  const searchResults=useMemo(()=>{
    if(!searchQ.trim()) return [];
    const q=searchQ.toLowerCase();
    const hits=allWrestlers.filter(w=>
      w.name.toLowerCase().includes(q)||w.school.toLowerCase().includes(q)
    ).slice(0,8).map(w=>({...w,takenBy:picks[pickKey(w.weight,w.seed)],isCustom:false}));
    if(hits.length===0&&searchQ.trim().length>1)
      return [{isCustom:true,name:searchQ.trim(),school:"",weight:null,seed:null}];
    return hits;
  },[searchQ,allWrestlers,picks]);

  // ── Draft actions ─────────────────────────────────────────────────────────
  const draftPick=async(weight,seed,forTeam)=>{
    const team=forTeam||onClock;
    const key=pickKey(weight,seed);
    if(picks[key]){showToast("Already drafted!","err");return;}
    if(!canDraft(team)){showToast(`${team} roster full (${picksPerTeam} picks)!`,"err");return;}
    // Check if this weight class is exhausted
    const weightWrestlers=wrestlers[weight]||[];
    const weightPicked=weightWrestlers.filter(wr=>picks[pickKey(weight,wr.seed)]).length;
    if(weightPicked>=weightWrestlers.length){showToast(`No wrestlers left at ${weight}lb!`,"err");return;}
    const existsAtWeight=Object.entries(picks).some(([k,t])=>t===team&&k.startsWith(`${weight}-`));
    const isBonus=existsAtWeight||!WEIGHT_CLASSES.includes(weight);
    if(isBonus&&!bonusPickEnabled){showToast("Bonus picks are disabled in settings","err");return;}
    // Save to Supabase if leagueId is present
    if(leagueId){
      try{
        const wr=allWrestlers.find(w=>w.weight===weight&&w.seed===seed);
        const teamObj=teamsProp?.find(t=>t.name===team);
        if(wr?.id && teamObj?.id){
          await savePick(leagueId, teamObj.id, wr.id, isBonus);
        } else {
          console.warn('savePick skipped — missing wr.id or teamObj.id');
        }
      }catch(err){
        showToast("Failed to save pick — try again","err");
        return;
      }
    }
    setPicks(p=>({...p,[key]:team}));
    const wr=allWrestlers.find(w=>w.weight===weight&&w.seed===seed);
    showToast(`${wr?.name||"Wrestler"} → ${team}${isBonus?" ⭐ BONUS":""}`,isBonus?"info":"ok");
    setHlKey(key);setTimeout(()=>setHlKey(null),1200);
    setSearchQ("");
    resetTimer();
  };

  const draftCustom=(rawName,forTeam)=>{
    const team=forTeam||onClock;
    if(!rawName.trim()) return;
    if(!canDraft(team)){showToast(`${team} roster full!`,"err");return;}
    const idx=buildNameIndex(wrestlers);
    const m=fuzzyFind(rawName,idx,3);
    if(m){draftPick(m.entry.weight,m.entry.seed,team);return;}
    const customSeed=900+totalPicks;
    const customWeight=0;
    setWrestlers(prev=>{
      const bucket=prev[customWeight]||[];
      return {...prev,[customWeight]:[...bucket,{seed:customSeed,name:rawName.trim(),school:""}]};
    });
    const key=pickKey(customWeight,customSeed);
    setPicks(p=>({...p,[key]:team}));
    showToast(`${rawName.trim()} → ${team}`,"ok");
    setSearchQ("");
    resetTimer();
  };

  // Override pick assignment (team reassign)
  const reassignPick=(key,newTeam)=>{
    setPicks(p=>({...p,[key]:newTeam}));
    showToast(`Pick reassigned → ${newTeam}`,"info");
  };

  const undoPick=(weight,seed)=>{
    const key=pickKey(weight,seed);
    const wr=allWrestlers.find(w=>w.weight===weight&&w.seed===seed);
    setPicks(p=>{const n={...p};delete n[key];return n;});
    showToast(`Undid ${wr?.name||"pick"}`,"info");
    resetTimer();
  };

  const getRoster=(team)=>{
    const out=[];
    [...WEIGHT_CLASSES,0].forEach(w=>{
      (wrestlers[w]||[]).forEach(wr=>{
        const key=pickKey(w,wr.seed);
        if(picks[key]===team) out.push({...wr,weight:w,pts:points[key]||0,key});
      });
    });
    return out;
  };

  const teamScores=useMemo(()=>{
    return teams.map(team=>{
      let total=0;const breakdown=[];
      [...WEIGHT_CLASSES,0].forEach(w=>{
        (wrestlers[w]||[]).forEach(wr=>{
          const key=pickKey(w,wr.seed);
          if(picks[key]===team){
            const pts=points[key]||0;total+=pts;
            if(pts>0) breakdown.push({...wr,weight:w,pts});
          }
        });
      });
      return {team,total,breakdown};
    }).sort((a,b)=>b.total-a.total);
  },[teams,picks,points,wrestlers]);

  const availCount=(w)=>(wrestlers[w]||[]).filter(wr=>!picks[pickKey(w,wr.seed)]).length;
  const topAvail=(w)=>(wrestlers[w]||[]).find(wr=>!picks[pickKey(w,wr.seed)]);

  // ── Loading state while fetching draft state from Supabase ─────
  if(stateLoading){
    return (
      <div style={{minHeight:"100vh",background:"#070a0e",display:"flex",alignItems:"center",
        justifyContent:"center",flexDirection:"column",gap:20,fontFamily:"'Oswald',sans-serif"}}>
        <div style={{width:40,height:40,border:"3px solid #1e2530",borderTop:"3px solid #c9a84c",
          borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        <div style={{fontSize:14,letterSpacing:".15em",color:"#6a5a30"}}>LOADING DRAFT...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:"#070a0e",color:"#d0c8b4",fontFamily:"'Oswald',sans-serif"}}>
      <style>{css}</style>
      <RejoinApprovalBanner leagueId={leagueId} currentUserRole={session?.role} />
      {toast&&(
        <div className="slide-down" style={{position:"fixed",top:14,right:14,zIndex:9999,
          background:toast.type==="err"?"#1e0a0a":toast.type==="info"?"#0a1220":"#0a1e14",
          border:`1px solid ${toast.type==="err"?"#7f1d1d":toast.type==="info"?"#1e3a5f":"#14532d"}`,
          color:toast.type==="err"?"#fca5a5":toast.type==="info"?"#93c5fd":"#86efac",
          padding:"9px 16px",borderRadius:6,fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",
          fontWeight:600,boxShadow:"0 8px 32px #00000099",maxWidth:320}}>
          {toast.msg}
        </div>
      )}
      <Header onClock={onClock} totalPicks={totalPicks} round={round} pos={pos}
        teams={teams} draftOrder={draftOrder} rotationType={rotationType}
        searchQ={searchQ} setSearchQ={setSearchQ} searchResults={searchResults}
        picks={picks} getColor={getColor} draftPick={draftPick} draftCustom={draftCustom}
        activePage={activePage} setActivePage={setActivePage} getRoster={getRoster}
        timerSec={timerSec} timerPaused={timerPaused} pauseTimer={pauseTimer} resumeTimer={resumeTimer}
        isCommissioner={isCommissioner} draftStarted={true}
        getRosterStatus={getRosterStatus} picksPerTeam={picksPerTeam} showToast={showToast}/>

      <div style={{maxWidth:1600,margin:"0 auto",padding:"16px 16px 40px"}}>
        {activePage==="board"&&<BoardPage wrestlers={wrestlers} picks={picks} points={points}
          draftPick={draftPick} hlKey={hlKey} teams={teams}
          getColor={getColor} availCount={availCount} reassignPick={reassignPick}
          draftOrder={draftOrder} rotationType={rotationType} totalPicks={totalPicks}/>}
        {activePage==="scores"&&<ScoresPage wrestlers={wrestlers} picks={picks} points={points}
          setPoints={setPoints} getColor={getColor} allWrestlers={allWrestlers} leagueId={leagueId}/>}
        {activePage==="standings"&&<StandingsPage teamScores={teamScores} getColor={getColor} getRoster={getRoster}/>}

        {activePage==="settings"&&<SettingsPage
          teams={teams} setTeams={setTeams}
          draftOrder={draftOrder} setDraftOrder={setDraftOrder}
          rotationType={rotationType} setRotationType={setRotationType}
          bonusPickEnabled={bonusPickEnabled} setBonusPickEnabled={setBonusPickEnabled}
          picks={picks} setPicks={setPicks} setPoints={setPoints}
          getRoster={getRoster} getColor={getColor} showToast={showToast}
          picksPerTeam={picksPerTeam} wrestlers={wrestlers}
          isCommissioner={isCommissioner}/>}
        {teams.includes(activePage)&&<RosterPage team={activePage} roster={getRoster(activePage)}
          getColor={getColor} picksPerTeam={picksPerTeam}
          allWrestlers={allWrestlers} picks={picks} setPicks={setPicks} wrestlers={wrestlers}
          bonusKeys={bonusKeys} setBonusKeys={setBonusKeys}
          bonusPickEnabled={bonusPickEnabled} showToast={showToast}/>}
      </div>
    </div>
  );
}

// ─── HEADER ──────────────────────────────────────────────────────────────────
function Header({onClock,totalPicks,round,pos,teams,draftOrder,rotationType,
  searchQ,setSearchQ,searchResults,picks,getColor,draftPick,draftCustom,
  activePage,setActivePage,getRoster,timerSec,timerPaused,pauseTimer,resumeTimer,
  isCommissioner,draftStarted,getRosterStatus,picksPerTeam,showToast}){
  const clk=onClock?getColor(onClock):null;
  const mins=Math.floor(timerSec/60);
  const secs=timerSec%60;
  const timerStr=`${mins>0?mins+"m ":""}${secs.toString().padStart(2,"0")}s`;
  const timerColor=timerSec<30?"#34d399":timerSec<60?"#f59e0b":timerSec<120?"#f97316":"#ef4444";
  const clkStatus=onClock?getRosterStatus(onClock):null;
  const n=Math.max(draftOrder.length,1);

  // Peek: who picks next
  const nextPos=(totalPicks+1)%n;
  const nextRound=Math.floor((totalPicks+1)/n);
  const nextTeam=draftOrder.length===0?"":(
    rotationType==="linear"?draftOrder[nextPos]:
    nextRound%2===0?draftOrder[nextPos]:draftOrder[n-1-nextPos]
  );

  return (
    <div style={{background:"#0b0f14",borderBottom:"2px solid #c9a84c",position:"sticky",top:0,zIndex:100}}>
      <div style={{maxWidth:1600,margin:"0 auto",padding:"10px 16px 8px",display:"flex",alignItems:"center",gap:11,flexWrap:"wrap"}}>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <img src="data:image/png;base64,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" alt="Pinfall Fantasy" style={{width:48,height:48,objectFit:"contain",flexShrink:0}}/>
          <div>
            <div style={{fontSize:16,fontWeight:700,letterSpacing:".1em",color:"#c9a84c",lineHeight:1.1}}>PINFALL FANTASY</div>
            <div style={{fontSize:8,fontWeight:300,letterSpacing:".22em",color:"#6a5a30"}}>FANTASY DRAFT BOARD</div>
          </div>
        </div>

        {/* On the clock */}
        <div style={{padding:"6px 11px",background:"#070a0e",border:`1px solid ${clk?clk.bg+"55":"#1e2530"}`,borderRadius:7,flexShrink:0,minWidth:155,boxShadow:clk?`0 0 12px ${clk.bg}22`:"none",transition:"all .3s"}}>
          <div style={{fontSize:8,letterSpacing:".2em",color:"#4a4020",marginBottom:1}}>ON THE CLOCK</div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {onClock&&<div className="pulse" style={{width:8,height:8,borderRadius:"50%",background:clk.bg,boxShadow:`0 0 7px ${clk.bg}`,flexShrink:0}}/>}
            <span style={{fontSize:17,fontWeight:700,color:onClock?clk.text:"#555",letterSpacing:".04em"}}>{onClock||"—"}</span>
          </div>
          <div style={{fontSize:9,color:"#3a3820",marginTop:1,fontFamily:"'Barlow Condensed',sans-serif"}}>
            Pick #{totalPicks+1} · Rd {round+1} · {rotationType==="snake"?"🐍 Snake":rotationType==="linear"?"→ Linear":"↕ Custom"}
          </div>
          {/* Slot dots */}
          {clkStatus&&(
            <div style={{display:"flex",gap:3,marginTop:4,alignItems:"center"}}>
              {Array.from({length:picksPerTeam}).map((_,i)=>{
                const filled=i<(picksPerTeam-clkStatus.remaining);
                const isBonus=i===10;
                return <div key={i} style={{width:isBonus?9:7,height:isBonus?9:7,borderRadius:isBonus?"2px":"50%",background:filled?(isBonus?"#c9a84c":clk.bg):"#1a1f26",border:`1px solid ${filled?(isBonus?"#c9a84c88":clk.bg+"66"):"#2a2f36"}`,transition:"all .2s",flexShrink:0}}/>;
              })}
              <span style={{fontSize:9,color:"#4a4020",fontFamily:"'Barlow Condensed',sans-serif",marginLeft:2}}>{clkStatus.remaining} left</span>
            </div>
          )}
          {/* Up next preview */}
          {nextTeam&&nextTeam!==onClock&&(
            <div style={{fontSize:9,color:"#3a4028",fontFamily:"'Barlow Condensed',sans-serif",marginTop:3}}>
              Up next: <span style={{color:getColor(nextTeam).text+"99"}}>{nextTeam}</span>
            </div>
          )}
        </div>

        {/* Timer */}
        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          <div style={{padding:"7px 12px",background:"#070a0e",border:`1px solid ${timerPaused?"#1a3a5c":timerSec>=60?"#3a1800":"#1e2530"}`,borderRadius:7,textAlign:"center",minWidth:82,boxShadow:timerSec>=120&&!timerPaused?`0 0 12px ${timerColor}44`:"none",transition:"all .5s"}}>
            <div style={{fontSize:8,letterSpacing:".2em",color:timerPaused?"#2a4a6a":"#4a4020",marginBottom:1}}>{timerPaused?"PAUSED":"PICK TIMER"}</div>
            <div style={{fontSize:22,fontWeight:700,color:timerPaused?"#4a7aaa":timerColor,lineHeight:1,transition:"color .5s"}}>{timerStr}</div>
            {!timerPaused&&timerSec>=60&&<div style={{fontSize:8,color:timerColor,opacity:.7,letterSpacing:".1em",marginTop:1}}>
              {timerSec<120?"SLOW":timerSec<180?"HURRY UP":"⚠ VERY SLOW"}
            </div>}
            {timerPaused&&<div style={{fontSize:8,color:"#4a7aaa",opacity:.8,letterSpacing:".1em",marginTop:1}}>COMMISSIONER</div>}
          </div>
          <CommissionerOnly isCommissioner={isCommissioner} label="Commissioner only">
            <button onClick={timerPaused?resumeTimer:pauseTimer}
              title={timerPaused?"Resume timer":"Pause timer"}
              style={{width:32,height:32,borderRadius:6,border:`1px solid ${timerPaused?"#c9a84c":"#2a3040"}`,background:timerPaused?"#c9a84c22":"#0d1117",color:timerPaused?"#c9a84c":"#6a7a8a",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,transition:"all .2s",flexShrink:0}}>
              {timerPaused?"▶":"⏸"}
            </button>
          </CommissionerOnly>
        </div>

        {/* Search */}
        <div style={{flex:1,minWidth:200,position:"relative"}}>
          <input className="inp" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&searchQ.trim()){const r=searchResults[0];if(r&&!r.isCustom&&!r.takenBy)draftPick(r.weight,r.seed);else if(r?.isCustom)draftCustom(searchQ.trim());}}}
            placeholder={`Search to draft for ${onClock||"…"} — or type any name`}/>
          {searchQ&&(
            <div className="slide-down" style={{position:"absolute",top:"calc(100% + 3px)",left:0,right:0,zIndex:400,background:"#0d1117",border:"1px solid #1e2530",borderRadius:6,overflow:"hidden",boxShadow:"0 12px 40px #00000099"}}>
              {searchResults.map((wr,i)=>{
                if(wr.isCustom) return (
                  <div key="c" className="wrow" style={{padding:"8px 12px",display:"flex",alignItems:"center",gap:8,background:"#0f140a"}}>
                    <span style={{fontSize:12,color:"#6a8a40",fontFamily:"'Barlow Condensed',sans-serif",flex:1}}>Draft "{wr.name}" as custom wrestler</span>
                    <button className="btn btn-sm btn-primary" onClick={()=>draftCustom(wr.name)}>DRAFT CUSTOM</button>
                  </div>
                );
                const tb=wr.takenBy;
                return (
                  <div key={`${wr.weight}-${wr.seed}`} className="wrow" style={{padding:"6px 10px",borderBottom:"1px solid #111820",display:"flex",alignItems:"center",gap:7,background:tb?"#0e0c0c":"transparent"}}>
                    <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",minWidth:30,flexShrink:0}}>{wr.weight}lb</span>
                    <span style={{fontSize:10,color:"#3a4040",fontFamily:"'Barlow Condensed',sans-serif",minWidth:18}}>#{wr.seed}</span>
                    <span style={{flex:1,fontSize:13,color:tb?"#4a4030":"#d0c8b4",fontFamily:"'Barlow Condensed',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.name}</span>
                    <span style={{fontSize:10,color:"#3a3a30",fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>{wr.school}</span>
                    {tb
                      ?<span style={{fontSize:10,color:getColor(tb).text,fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}}>{tb}</span>
                      :<button className="btn btn-primary btn-sm" onClick={()=>draftPick(wr.weight,wr.seed)}>DRAFT</button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{display:"flex",gap:5,flexShrink:0}}>
          {[{v:totalPicks,l:"DRAFTED",c:"#c9a84c"},{v:draftOrder.length*picksPerTeam-totalPicks,l:"REMAIN",c:"#34d399"},{v:round+1,l:"ROUND",c:"#93c5fd"}].map(s=>(
            <div key={s.l} style={{textAlign:"center",padding:"3px 8px",background:"#070a0e",border:"1px solid #1e2530",borderRadius:5,minWidth:46}}>
              <div style={{fontSize:18,fontWeight:700,color:s.c,lineHeight:1.1}}>{s.v}</div>
              <div style={{fontSize:8,color:"#3a3820",letterSpacing:".12em"}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{maxWidth:1600,margin:"0 auto",padding:"0 16px",display:"flex",gap:0,overflowX:"auto",marginBottom:-2}}>
        {[{id:"board",label:"DRAFT BOARD"},{id:"scores",label:"📥 SCORES"},{id:"standings",label:"🏆 STANDINGS"},{id:"settings",label:"⚙ SETTINGS",commissionerOnly:true}].map(tab=>{
          const isActive=activePage===tab.id;
          if(tab.commissionerOnly&&!isCommissioner){
            return (
              <CommissionerOnly key={tab.id} isCommissioner={false} label="Commissioner only">
                <button className="tab-link"
                  style={{padding:"7px 13px",fontSize:11,fontWeight:600,letterSpacing:".12em",
                    color:"#2a2a20",borderBottom:"2px solid transparent",cursor:"not-allowed"}}>
                  {tab.label}
                </button>
              </CommissionerOnly>
            );
          }
          return (
            <button key={tab.id} className="tab-link"
              onClick={()=>setActivePage(tab.id)}
              style={{padding:"7px 13px",fontSize:11,fontWeight:600,letterSpacing:".12em",
                color:isActive?"#c9a84c":"#4a4020",
                borderBottom:isActive?"2px solid #c9a84c":"2px solid transparent",
                cursor:"pointer"}}>
              {tab.label}
            </button>
          );
        })}
        <div style={{width:1,background:"#1e2530",margin:"5px 5px 1px"}}/>
        {teams.map(t=>{
          const c=getColor(t);const r=getRoster(t).length;const isA=activePage===t;
          const status=getRosterStatus(t);
          return (
            <button key={t} className="tab-link" onClick={()=>setActivePage(t)} style={{padding:"7px 10px",fontSize:10,fontWeight:500,letterSpacing:".05em",color:isA?c.text:c.text+"55",borderBottom:isA?`2px solid ${c.bg}`:"2px solid transparent",display:"flex",alignItems:"center",gap:4}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:c.bg,flexShrink:0,boxShadow:isA?`0 0 5px ${c.bg}`:"none"}}/>
              {t}
              <span style={{fontSize:9,color:status.remaining===0?"#c9a84c88":"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>({r}/{picksPerTeam})</span>
            </button>
          );
        })}
      </div>
      {/* ── Disclaimer footer ── */}
      <div style={{borderTop:"1px solid #0f1318",padding:"16px 24px",textAlign:"center",marginTop:20}}>
        <div style={{fontSize:10,color:"#2a3040",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1.7,maxWidth:900,margin:"0 auto",letterSpacing:".04em"}}>
          Pinfall Fantasy is an independent fan tool and is not affiliated with, endorsed by, or connected to the NCAA, its member institutions, TrackWrestling, FloWrestling, or any other organization. Athlete names and school affiliations are used for fantasy sports identification purposes only. No commercial use of athlete likenesses is intended or implied. This platform does not facilitate gambling or prize pools of any kind.
        </div>
      </div>
    </div>
  );
}


// ─── BOARD PAGE ───────────────────────────────────────────────────────────────

// ─── BOARD PAGE ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 12; // wrestlers per page per weight column

function BoardPage({wrestlers,picks,points,draftPick,hlKey,getColor,
  availCount,reassignPick,teams,draftOrder,rotationType,totalPicks}){
  const [overrideKey,setOverrideKey]=useState(null);
  // Per-weight page index (0-based). Reset all to 0 whenever a new pick is made.
  const [pages,setPages]=useState(()=>Object.fromEntries(WEIGHT_CLASSES.map(w=>[w,0])));
  const prevPicksRef=useRef(totalPicks);
  if(prevPicksRef.current!==totalPicks){
    prevPicksRef.current=totalPicks;
    // Reset all pages to 0 on each pick (done synchronously during render is fine for a ref-guard)
    const reset=Object.fromEntries(WEIGHT_CLASSES.map(w=>[w,0]));
    // Use a deferred state update instead of setState-during-render:
    setTimeout(()=>setPages(reset),0);
  }

  const setPage=(w,p)=>setPages(prev=>({...prev,[w]:p}));

  // Find wrestler + current team for the modal title
  const overrideMeta=useMemo(()=>{
    if(!overrideKey) return null;
    const [w,s]=overrideKey.split("-");
    const wr=(wrestlers[parseInt(w)]||[]).find(x=>x.seed===parseInt(s));
    return {name:wr?.name||"Wrestler",team:picks[overrideKey]};
  },[overrideKey,wrestlers,picks]);

  // Build upcoming picks queue (next 10)
  const upcomingPicks=useMemo(()=>{
    const n=Math.max(draftOrder.length,1);
    const queue=[];
    for(let offset=0;offset<Math.min(10,n*2);offset++){
      const t=totalPicks+offset;
      const r=Math.floor(t/n);const p=t%n;
      let team;
      if(rotationType==="linear") team=draftOrder[p];
      else team=r%2===0?draftOrder[p]:draftOrder[n-1-p];
      if(team) queue.push({pickNum:t+1,round:r+1,team,isCurrent:offset===0});
    }
    return queue;
  },[draftOrder,rotationType,totalPicks]);

  return (
    <div>
      {/* ── Reassign modal — full-screen backdrop blocks all clicks ── */}
      {overrideKey&&overrideMeta&&(
        <div style={{position:"fixed",inset:0,zIndex:9998,
          background:"rgba(0,0,0,0.78)",
          display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setOverrideKey(null)}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:"#111820",border:"2px solid #c9a84c",borderRadius:10,
              boxShadow:"0 24px 64px #000000",width:260,overflow:"hidden"}}>
            {/* Header */}
            <div style={{padding:"12px 16px",background:"#0a1018",borderBottom:"1px solid #c9a84c44"}}>
              <div style={{fontSize:9,letterSpacing:".18em",color:"#8a7040",
                fontFamily:"'Oswald',sans-serif",marginBottom:4}}>REASSIGN PICK</div>
              <div style={{fontSize:15,fontWeight:700,color:"#e0d8b4",
                fontFamily:"'Barlow Condensed',sans-serif",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {overrideMeta.name}
              </div>
              <div style={{fontSize:10,color:"#4a5040",fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>
                Currently:{" "}
                <span style={{color:overrideMeta.team?getColor(overrideMeta.team).text:"#888",fontWeight:600}}>
                  {overrideMeta.team}
                </span>
              </div>
            </div>
            {/* Scrollable team list — max 4 rows visible */}
            <div style={{maxHeight:176,overflowY:"auto",
              scrollbarWidth:"thin",scrollbarColor:"#c9a84c44 #0a0f16"}}>
              {teams.map(t=>{
                const tc2=getColor(t);
                const isCurrent=t===overrideMeta.team;
                return (
                  <button key={t}
                    onClick={()=>{reassignPick(overrideKey,t);setOverrideKey(null);}}
                    style={{width:"100%",padding:"11px 16px",display:"flex",alignItems:"center",
                      gap:12,background:isCurrent?"#1e2c3a":"#111820",
                      border:"none",borderBottom:"1px solid #1a2028",
                      cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e=>e.currentTarget.style.background=isCurrent?"#243545":"#1a2535"}
                    onMouseLeave={e=>e.currentTarget.style.background=isCurrent?"#1e2c3a":"#111820"}>
                    <span style={{width:12,height:12,borderRadius:"50%",flexShrink:0,
                      background:tc2.bg,boxShadow:`0 0 8px ${tc2.bg}`}}/>
                    <span style={{flex:1,fontSize:14,
                      fontWeight:isCurrent?700:400,
                      color:isCurrent?tc2.text:"#c0c8b8",
                      fontFamily:"'Barlow Condensed',sans-serif"}}>{t}</span>
                    {isCurrent&&(
                      <span style={{fontSize:11,color:tc2.text,
                        fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Cancel */}
            <button onClick={()=>setOverrideKey(null)}
              style={{width:"100%",padding:"10px 16px",background:"#0a0f16",border:"none",
                borderTop:"1px solid #c9a84c44",fontSize:11,letterSpacing:".12em",
                color:"#5a6050",fontFamily:"'Oswald',sans-serif",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.color="#9aa090"}
              onMouseLeave={e=>e.currentTarget.style.color="#5a6050"}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* ── Live draft queue ── */}
      <div className="card" style={{marginBottom:14}}>
        <div style={{padding:"6px 14px 5px",borderBottom:"1px solid #1a1f26",background:"#0d1219",
          display:"flex",alignItems:"center",gap:10,borderRadius:"8px 8px 0 0"}}>
          <span style={{fontSize:10,letterSpacing:".18em",color:"#6a5a30",
            fontFamily:"'Oswald',sans-serif"}}>UPCOMING PICKS</span>
          <span style={{fontSize:10,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>
            {rotationType==="snake"?"🐍 Snake":rotationType==="linear"?"→ Linear":"↕ Custom"}
          </span>
        </div>
        <div style={{display:"flex",overflowX:"auto",padding:"10px 10px 8px",alignItems:"flex-start"}}>
          {upcomingPicks.map((p,i)=>{
            const c=getColor(p.team);
            const isNow=p.isCurrent;
            return (
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",
                flexShrink:0,padding:isNow?"10px 12px 8px":"6px 10px 8px",marginRight:3,
                borderRadius:7,background:isNow?`${c.bg}28`:"transparent",
                border:isNow?`1px solid ${c.bg}66`:"1px solid transparent",
                minWidth:86,position:"relative",transition:"all .25s"}}>
                {isNow&&(
                  <div style={{position:"absolute",top:-1,left:"50%",transform:"translateX(-50%)",
                    fontSize:8,color:"#070a0e",background:c.bg,padding:"1px 8px",
                    borderRadius:"0 0 5px 5px",fontFamily:"'Oswald',sans-serif",fontWeight:700,
                    letterSpacing:".1em",whiteSpace:"nowrap",boxShadow:`0 2px 8px ${c.bg}66`}}>
                    ON CLOCK
                  </div>
                )}
                <div style={{marginTop:isNow?12:0,marginBottom:6,
                  width:isNow?34:22,height:isNow?34:22,borderRadius:"50%",
                  background:isNow?`radial-gradient(circle at 35% 35%,${c.bg},${c.bg}88)`:c.bg+"44",
                  border:`2px solid ${isNow?c.bg:c.bg+"77"}`,
                  boxShadow:isNow?`0 0 16px ${c.bg}77`:"none",
                  flexShrink:0,transition:"all .3s"}}/>
                <div style={{fontSize:isNow?12:10,fontWeight:isNow?700:500,
                  color:isNow?c.text:c.text+"88",fontFamily:"'Barlow Condensed',sans-serif",
                  textAlign:"center",maxWidth:82,overflow:"hidden",textOverflow:"ellipsis",
                  whiteSpace:"nowrap",marginBottom:3}}>
                  {p.team}
                </div>
                <div style={{fontSize:9,color:isNow?"#c9a84c99":"#2a3020",
                  fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".06em"}}>
                  Pk {p.pickNum} · R{p.round}
                </div>
              </div>
            );
          })}
          {upcomingPicks.length===0&&(
            <div style={{padding:"14px 16px",color:"#3a3820",fontSize:12,
              fontFamily:"'Barlow Condensed',sans-serif"}}>
              Draft complete or no teams configured
            </div>
          )}
        </div>
      </div>

      {/* Weight columns */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {WEIGHT_CLASSES.map(w=>{
          const allWrs=wrestlers[w]||[];
          const totalPages=Math.ceil(allWrs.length/PAGE_SIZE);
          const pg=pages[w]||0;
          const pageWrs=allWrs.slice(pg*PAGE_SIZE,(pg+1)*PAGE_SIZE);
          return (
          <div id={`wc-${w}`} key={w} className="card card-h">
            <div style={{padding:"9px 12px 7px",borderBottom:"1px solid #1a1f26",
              display:"flex",alignItems:"flex-end",justifyContent:"space-between",background:"#0d1219"}}>
              <div>
                <span style={{fontSize:26,fontWeight:700,color:"#c9a84c",lineHeight:1}}>{w}</span>
                <span style={{fontSize:11,color:"#4a4020",marginLeft:3,
                  fontFamily:"'Barlow Condensed',sans-serif"}}>lbs</span>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:700,lineHeight:1,
                  color:availCount(w)>16?"#22c55e":availCount(w)>8?"#f59e0b":"#ef4444"}}>
                  {availCount(w)}
                </div>
                <div style={{fontSize:8,color:"#3a3820",letterSpacing:".12em"}}>AVAIL</div>
              </div>
            </div>
            {pageWrs.map((wr,i)=>{
              const key=pickKey(w,wr.seed);
              const tb=picks[key];
              const tc=tb?getColor(tb):null;
              const isHl=hlKey===key;
              const pts=points[key]||0;
              return (
                <div key={wr.seed}
                  className={`wrow ${tb?"taken-row":""} ${isHl?"flash-row":""}`}
                  style={{padding:"5px 8px",
                    borderBottom:i<pageWrs.length-1?"1px solid #0f1318":"none",
                    display:"flex",alignItems:"center",gap:0,
                    background:tb?`${tc.bg}0e`:"transparent",
                    borderLeft:tb?`3px solid ${tc.bg}`:"3px solid transparent"}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,
                    width:20,fontSize:12,flexShrink:0,textAlign:"center",
                    color:wr.seed<=2?"#c9a84c":wr.seed<=4?"#a08030":wr.seed<=8?"#505840":wr.seed<=16?"#2a3838":"#1e2a22"}}>
                    {wr.seed}
                  </span>
                  <div style={{flex:1,minWidth:0,paddingLeft:4}}>
                    <div style={{fontSize:12,color:tb?"#3a3020":"#c0b898",
                      fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.name}</div>
                    <div style={{fontSize:9,color:tb?"#2a2818":"#303830",
                      fontFamily:"'Barlow Condensed',sans-serif",
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.school}</div>
                  </div>
                  {tb?(
                    <button onClick={()=>setOverrideKey(key)}
                      title="Click to reassign to a different team"
                      style={{display:"flex",alignItems:"center",gap:3,padding:"2px 6px",flexShrink:0,
                        background:tc.bg+"33",border:`1px solid ${tc.bg}66`,borderRadius:4,
                        cursor:"pointer",transition:"background .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=tc.bg+"55"}
                      onMouseLeave={e=>e.currentTarget.style.background=tc.bg+"33"}>
                      {pts>0&&(
                        <span style={{fontSize:9,color:"#34d399",
                          fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,marginRight:2}}>
                          {pts}pt
                        </span>
                      )}
                      <span style={{width:5,height:5,borderRadius:"50%",
                        background:tc.bg,flexShrink:0}}/>
                      <span style={{fontSize:9,color:tc.text,
                        fontFamily:"'Barlow Condensed',sans-serif",
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        maxWidth:52,fontWeight:600}}>{tb}</span>
                      <span style={{fontSize:8,color:tc.text+"cc"}}>▾</span>
                    </button>
                  ):(
                    <button className="btn btn-sm" onClick={()=>draftPick(w,wr.seed)}
                      style={{padding:"2px 7px",background:"#0c1e14",border:"1px solid #1a3824",
                        borderRadius:4,color:"#2a6a44",fontSize:9,fontFamily:"'Oswald',sans-serif",
                        fontWeight:600,letterSpacing:".07em",flexShrink:0}}>DRAFT</button>
                  )}
                </div>
              );
            })}
            {/* Pagination footer */}
            {totalPages>1&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"5px 8px",borderTop:"1px solid #0f1318",background:"#080c10"}}>
                <button onClick={()=>setPage(w,pg-1)} disabled={pg===0}
                  style={{width:26,height:26,borderRadius:4,border:"1px solid #1e2530",
                    background:pg===0?"transparent":"#0d1520",color:pg===0?"#1e2530":"#c9a84c",
                    cursor:pg===0?"default":"pointer",fontSize:13,display:"flex",
                    alignItems:"center",justifyContent:"center",flexShrink:0}}>‹</button>
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  {Array.from({length:totalPages}).map((_,pi)=>(
                    <button key={pi} onClick={()=>setPage(w,pi)}
                      style={{width:pi===pg?20:8,height:8,borderRadius:4,border:"none",
                        background:pi===pg?"#c9a84c":"#1e2530",cursor:"pointer",
                        transition:"all .2s",padding:0,flexShrink:0}}/>
                  ))}
                </div>
                <button onClick={()=>setPage(w,pg+1)} disabled={pg===totalPages-1}
                  style={{width:26,height:26,borderRadius:4,border:"1px solid #1e2530",
                    background:pg===totalPages-1?"transparent":"#0d1520",
                    color:pg===totalPages-1?"#1e2530":"#c9a84c",
                    cursor:pg===totalPages-1?"default":"pointer",fontSize:13,display:"flex",
                    alignItems:"center",justifyContent:"center",flexShrink:0}}>›</button>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}



// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage({teams,setTeams,draftOrder,setDraftOrder,rotationType,setRotationType,
  bonusPickEnabled,setBonusPickEnabled,picks,setPicks,setPoints,getRoster,getColor,showToast,picksPerTeam,wrestlers,
  isCommissioner}){
  // Settings are read-only post-draft — shown for reference only

  // Preview next 8 picks (read-only, for reference)
  const pickPreview=useMemo(()=>{
    const n=Math.max(draftOrder.length,1);
    const total=Object.keys(picks).length;
    return Array.from({length:Math.min(8,draftOrder.length*2)}).map((_,offset)=>{
      const t=total+offset;
      const r=Math.floor(t/n);const p=t%n;
      let team;
      if(rotationType==="linear") team=draftOrder[p];
      else team=r%2===0?draftOrder[p]:draftOrder[n-1-p];
      return {pick:total+offset+1,round:r+1,team};
    });
  },[draftOrder,rotationType,picks]);

  return (
    <div style={{maxWidth:860}}>
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:20,fontWeight:700,letterSpacing:".1em",color:"#c9a84c"}}>DRAFT SETTINGS</h2>
        <p style={{color:"#4a4020",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>League configuration — read-only reference while draft is live</p>
      </div>

      {/* ── Live status banner ── */}
      <div className="card" style={{padding:14,marginBottom:14,border:"1px solid #14532d",background:"#050e08",display:"flex",alignItems:"center",gap:12}}>
        <div className="pulse" style={{width:9,height:9,borderRadius:"50%",background:"#34d399",boxShadow:"0 0 8px #34d39977",flexShrink:0}}/>
        <div>
          <div style={{fontSize:12,color:"#34d399",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".15em",fontWeight:700}}>✓ DRAFT IS LIVE</div>
          <div style={{fontSize:10,color:"#1a4a28",fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>Settings were locked when the draft started. Shown here for reference only.</div>
        </div>
      </div>

      {/* ── Rotation type (read-only) ── */}
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:12}}>PICK ROTATION</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {[
            {id:"snake",icon:"🐍",label:"Snake Draft",desc:"Rd 1: 1→10, Rd 2: 10→1, alternates each round"},
            {id:"linear",icon:"→",label:"Linear Draft",desc:"Same order every round (1→10 always)"},
            {id:"third_round_reversal",icon:"↕",label:"3rd Round Reversal",desc:"Snake but reverses direction every other round"},
          ].map(r=>(
            <div key={r.id}
              style={{flex:"1 1 220px",padding:"12px 14px",
                background:rotationType===r.id?"#c9a84c18":"#070a0e",
                border:`2px solid ${rotationType===r.id?"#c9a84c":"#1e2530"}`,
                borderRadius:8,textAlign:"left",opacity:rotationType===r.id?1:0.45}}>
              <div style={{fontSize:20,marginBottom:5}}>{r.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:rotationType===r.id?"#c9a84c":"#c0b898",letterSpacing:".06em",marginBottom:3}}>{r.label}{rotationType===r.id?" ✓":""}</div>
              <div style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1.4}}>{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Roster rules (read-only) ── */}
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:10}}>ROSTER RULES</div>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:"#c0b898",marginBottom:3}}>⭐ Bonus / Dark Horse Pick</div>
            <div style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1.5}}>
              {bonusPickEnabled
                ? `Enabled — each team gets one extra pick at any weight class (${picksPerTeam} total picks per team).`
                : `Disabled — strict 10-wrestler-per-team format (${picksPerTeam} picks per team).`}
            </div>
          </div>
          <div style={{padding:"10px 22px",background:bonusPickEnabled?"#c9a84c22":"#1a1f26",
            color:bonusPickEnabled?"#c9a84c":"#4a4030",
            border:`2px solid ${bonusPickEnabled?"#c9a84c44":"#2a2f36"}`,
            borderRadius:7,fontSize:13,fontWeight:700,fontFamily:"'Oswald',sans-serif",
            letterSpacing:".08em",flexShrink:0,minWidth:100,textAlign:"center"}}>
            {bonusPickEnabled?"ON ✓":"OFF"}
          </div>
        </div>
      </div>

      {/* ── Draft order (read-only) ── */}
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:12}}>DRAFT ORDER ({draftOrder.length} teams)</div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {draftOrder.map((t,i)=>{
            const c=getColor(t);const r=getRoster(t).length;
            return (
              <div key={t}
                style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                  background:"#070a0e",border:`1px solid ${c.bg}33`,
                  borderLeft:`4px solid ${c.bg}`,borderRadius:6}}>
                <span style={{fontSize:13,fontWeight:700,color:"#3a3820",minWidth:22,textAlign:"right",fontFamily:"'Barlow Condensed',sans-serif"}}>{i+1}</span>
                <div style={{width:8,height:8,borderRadius:"50%",background:c.bg,boxShadow:`0 0 5px ${c.bg}`,flexShrink:0}}/>
                <span style={{flex:1,fontSize:14,fontWeight:500,color:c.text,letterSpacing:".05em"}}>{t}</span>
                <span style={{fontSize:10,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>{r} picks</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Upcoming pick order preview ── */}
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:10}}>UPCOMING PICK ORDER PREVIEW</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {pickPreview.map((p,i)=>{
            const c=getColor(p.team);
            return (
              <div key={i} style={{padding:"5px 10px",background:`${c.bg}18`,border:`1px solid ${c.bg}33`,borderRadius:5,display:"flex",gap:7,alignItems:"center"}}>
                <span style={{fontSize:9,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif",minWidth:30}}>Pk {p.pick}</span>
                <span style={{width:6,height:6,borderRadius:"50%",background:c.bg,flexShrink:0}}/>
                <span style={{fontSize:11,color:c.text,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>{p.team}</span>
                <span style={{fontSize:9,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>Rd{p.round}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Danger zone (commissioner only) ── */}
      <CommissionerOnly isCommissioner={isCommissioner} label="Commissioner only">
        <div className="card" style={{padding:16,border:"1px solid #3a1515",width:"100%"}}>
          <div className="sec-label" style={{color:"#7a2020",marginBottom:10}}>DANGER ZONE</div>
          <button className="btn btn-danger btn-md" onClick={()=>{if(window.confirm("Clear all picks and scores?")){{setPicks({});setPoints({});showToast("Cleared","info");}}}}>CLEAR ALL PICKS & SCORES</button>
        </div>
      </CommissionerOnly>
    </div>
  );
}

function ScoresPage({wrestlers,picks,points,setPoints,getColor,allWrestlers,leagueId}){
  const [rawText,setRawText]=useState("");
  const [dragOver,setDragOver]=useState(false);
  const [preview,setPreview]=useState(null);   // {matched, unmatched}
  const [applied,setApplied]=useState(false);
  const [manualKey,setManualKey]=useState("");
  const [manualPts,setManualPts]=useState("");
  const [manualSearch,setManualSearch]=useState("");

  const nameIndex=useMemo(()=>buildNameIndex(wrestlers),[wrestlers]);

  const runParse=()=>{
    if(!rawText.trim()) return;
    const pairs=parseScoreText(rawText);
    const {matched,unmatched}=matchScoresToRoster(pairs,nameIndex,picks);
    setPreview({matched,unmatched});
    setApplied(false);
  };

  const applyPreview=async()=>{
    if(!preview) return;
    const updates={};
    preview.matched.filter(m=>m.drafted).forEach(m=>{updates[m.key]=m.pts;});
    setPoints(prev=>{
      const merged={...prev,...updates};
      // Save to Supabase asynchronously
      if(leagueId) savePoints(leagueId, merged).catch(err=>console.error('savePoints failed:',err));
      return merged;
    });
    setApplied(true);
  };

  const clearAll=()=>{setRawText("");setPreview(null);setApplied(false);};

  const handleFile=(e)=>{
    const file=e.dataTransfer?.files?.[0]||e.target?.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>setRawText(ev.target.result);
    reader.readAsText(file);
  };

  // Manual single edit
  const applyManual=()=>{
    const pts=parseFloat(manualPts);
    if(!manualKey||isNaN(pts)) return;
    setPoints(prev=>{
      const merged={...prev,[manualKey]:pts};
      if(leagueId) savePoints(leagueId, merged).catch(err=>console.error('savePoints failed:',err));
      return merged;
    });
    setManualKey("");setManualPts("");setManualSearch("");
  };

  const draftedWrestlers=useMemo(()=>{
    const out=[];
    [...WEIGHT_CLASSES,0].forEach(w=>{
      (wrestlers[w]||[]).forEach(wr=>{
        const key=pickKey(w,wr.seed);
        if(picks[key]) out.push({...wr,weight:w,team:picks[key],key,pts:points[key]||0});
      });
    });
    return out.sort((a,b)=>b.pts-a.pts);
  },[wrestlers,picks,points]);

  const totalEntered=draftedWrestlers.filter(w=>w.pts>0).length;
  const grandTotal=draftedWrestlers.reduce((s,w)=>s+w.pts,0);

  return (
    <div>

      {/* ── OPTION 1: BULK IMPORT — gold border ── */}
      <div style={{border:"2px solid #c9a84c44",borderRadius:10,background:"#0b0f14",marginBottom:14,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid #c9a84c22",background:"#0d1008"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#c9a84c",letterSpacing:".1em",marginBottom:4}}>OPTION 1 — BULK IMPORT</div>
          <div style={{fontSize:11,color:"#7a6a40",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1.5,marginBottom:6}}>
            Paste or upload a score table from TrackWrestling or FloWrestling. Names are matched automatically and all scores are applied at once.
          </div>
          <div style={{fontSize:11,color:"#7a4a20",fontFamily:"'Barlow Condensed',sans-serif",padding:"5px 8px",background:"#1a0e08",border:"1px solid #3a1e08",borderRadius:4,display:"inline-block"}}>
            ⚠ Each import fully replaces all existing scores — always use cumulative totals, not per-session results.
          </div>
        </div>
        <div style={{padding:"12px 16px"}}>
          {!preview&&(
            <div>
              <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e);}}
                style={{marginBottom:8,padding:"8px 14px",border:`2px dashed ${dragOver?"#c9a84c":"#2a2010"}`,borderRadius:8,background:dragOver?"#1a1500":"#070a0e",transition:"all .2s",textAlign:"center"}}>
                <span style={{fontSize:11,color:"#4a4020",fontFamily:"'Barlow Condensed',sans-serif"}}>
                  📂 Drop a .txt or .csv, or{" "}
                  <label style={{color:"#c9a84c",cursor:"pointer",textDecoration:"underline"}}>
                    browse<input type="file" accept=".txt,.csv,.tsv" onChange={handleFile} style={{display:"none"}}/>
                  </label>
                </span>
              </div>
              <textarea className="inp" rows={8} value={rawText} onChange={e=>setRawText(e.target.value)}
                placeholder={"Paste TrackWrestling fantasy standings or score table here.\n\nWORKS:\n  \u2022 TW standings:  1  Stevo Poulin  Iowa State  14.0\n  \u2022 With pts suffix:  Stevo Poulin (Iowa State) \u2014 14.0 pts\n  \u2022 CSV with header:  Name, School, Points\n\nWONT WORK:\n  \u2022 Raw HTML or webpage source\n  \u2022 Columns without a points/pts header\n  \u2022 Non-wrestler rows mixed in\n\nTip: always import cumulative totals."}
                style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,lineHeight:1.6}}/>
              <div style={{display:"flex",gap:10,marginTop:10,alignItems:"center"}}>
                <button className="btn btn-primary btn-lg" onClick={runParse} disabled={!rawText.trim()} style={{opacity:rawText.trim()?1:.4}}>PARSE & PREVIEW</button>
                <button className="btn btn-ghost btn-md" onClick={()=>setRawText("")}>CLEAR</button>
                {rawText.trim()&&<span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif"}}>{rawText.trim().split("\n").filter(Boolean).length} lines</span>}
              </div>
            </div>
          )}
          {preview&&(
            <div>
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{display:"flex",gap:7}}>
                  <StatCard v={preview.matched.filter(m=>m.drafted).length} l="DRAFTED MATCHED" c="#34d399" bg="#0c2218" bd="#1a4030"/>
                  {preview.matched.filter(m=>!m.drafted).length>0&&
                    <StatCard v={preview.matched.filter(m=>!m.drafted).length} l="NOT DRAFTED" c="#93c5fd" bg="#0f1820" bd="#1a2f40"/>}
                  <StatCard v={preview.unmatched.length} l="NO MATCH" c="#fca5a5" bg="#1e0a0a" bd="#3a1515"/>
                </div>
                <div style={{display:"flex",gap:8,marginLeft:"auto",alignItems:"center"}}>
                  {!applied&&preview.matched.filter(m=>m.drafted).length>0&&(
                    <button className="btn btn-primary btn-lg" onClick={applyPreview}>
                      ✓ APPLY {preview.matched.filter(m=>m.drafted).length} SCORES
                    </button>
                  )}
                  {applied&&<div style={{padding:"8px 16px",background:"#0c2218",border:"1px solid #1a4030",borderRadius:6,fontSize:13,color:"#34d399",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>✓ Scores applied!</div>}
                  <button className="btn btn-ghost btn-md" onClick={clearAll}>RE-PASTE</button>
                </div>
              </div>
              {preview.matched.filter(m=>m.drafted).length>0&&(
                <div className="card" style={{marginBottom:11}}>
                  <div style={{padding:"9px 14px",borderBottom:"1px solid #1a1f26",background:"#0d1219",display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:600,color:"#34d399",letterSpacing:".08em"}}>✓ DRAFTED — WILL BE SCORED</span>
                  </div>
                  {preview.matched.filter(m=>m.drafted).map((m,i)=>{
                    const tc=getColor(picks[m.key]);
                    return (
                      <div key={i} style={{padding:"7px 14px",borderBottom:"1px solid #0f1318",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",minWidth:28}}>{m.entry.weight}lb</span>
                        <span style={{fontSize:10,color:"#3a4040",fontFamily:"'Barlow Condensed',sans-serif",minWidth:16}}>#{m.entry.seed}</span>
                        <span style={{fontSize:14,color:"#d0c8b4",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,minWidth:160}}>{m.entry.name}</span>
                        <span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif",flex:1}}>{m.entry.school}</span>
                        {!m.exact&&<span style={{fontSize:9,color:"#b45309",padding:"1px 5px",background:"#1e1000",border:"1px solid #2a1800",borderRadius:3,fontFamily:"'Barlow Condensed',sans-serif"}}>fuzzy"{m.rawName}"</span>}
                        <span style={{fontSize:16,fontWeight:700,color:"#34d399"}}>{m.pts} <span style={{fontSize:10,color:"#2a5040"}}>pts</span></span>
                        <span style={{fontSize:10,color:tc.text,padding:"1px 8px",background:`${tc.bg}22`,border:`1px solid ${tc.bg}44`,borderRadius:4,fontFamily:"'Barlow Condensed',sans-serif"}}>{picks[m.key]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {preview.matched.filter(m=>!m.drafted).length>0&&(
                <div className="card" style={{marginBottom:11}}>
                  <div style={{padding:"9px 14px",borderBottom:"1px solid #1a1f26",background:"#0d1219"}}>
                    <span style={{fontSize:13,fontWeight:600,color:"#93c5fd",letterSpacing:".08em"}}>ℹ FOUND BUT NOT DRAFTED</span>
                  </div>
                  <div style={{padding:"9px 14px",display:"flex",flexWrap:"wrap",gap:6}}>
                    {preview.matched.filter(m=>!m.drafted).map((m,i)=>(
                      <span key={i} style={{fontSize:11,color:"#4a5060",fontFamily:"'Barlow Condensed',sans-serif",padding:"2px 8px",background:"#0d1219",border:"1px solid #1e2530",borderRadius:4}}>
                        {m.entry.name} ({m.entry.weight}lb) — {m.pts}pt
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {preview.unmatched.length>0&&(
                <div className="card" style={{marginBottom:11}}>
                  <div style={{padding:"9px 14px",borderBottom:"1px solid #1a1f26",background:"#0d1219"}}>
                    <span style={{fontSize:13,fontWeight:600,color:"#fca5a5",letterSpacing:".08em"}}>✗ COULD NOT MATCH</span>
                    <span style={{fontSize:11,color:"#5a3030",fontFamily:"'Barlow Condensed',sans-serif",marginLeft:8}}>not in wrestler database</span>
                  </div>
                  <div style={{padding:"9px 14px",display:"flex",flexWrap:"wrap",gap:6}}>
                    {preview.unmatched.map((u,i)=>(
                      <span key={i} style={{fontSize:11,color:"#7a4040",fontFamily:"'Barlow Condensed',sans-serif",padding:"2px 8px",background:"#1e0a0a",border:"1px solid #3a1515",borderRadius:4}}>{u.rawName} ({u.pts}pt)</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── OPTION 2: MANUAL ENTRY — blue border ── */}
      <div style={{border:"2px solid #1e3a5f",borderRadius:10,background:"#0a0f18",marginBottom:20,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid #1a2a3a",background:"#080e18"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#93c5fd",letterSpacing:".1em",marginBottom:4}}>OPTION 2 — MANUAL ENTRY</div>
          <div style={{fontSize:11,color:"#4a5a6a",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1.5}}>
            Search for a wrestler by name and set their points directly. Best for corrections or single updates. Does not replace other scores.
          </div>
        </div>
        <div style={{padding:"12px 16px"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:manualSearch?8:0}}>
            <input className="inp" type="text" value={manualSearch}
              onChange={e=>{setManualSearch(e.target.value);setManualKey("");}}
              placeholder="Search wrestler name or team..."
              style={{flex:1,minWidth:160,padding:"6px 10px",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif"}}/>
            <input className="inp" type="number" step="0.5" min="0" max="100" value={manualPts}
              onChange={e=>setManualPts(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&applyManual()}
              placeholder="pts" style={{width:75,padding:"6px 10px",fontSize:13}}/>
            <button className="btn btn-primary btn-sm" onClick={applyManual}
              disabled={!manualKey||!manualPts} style={{padding:"6px 16px",opacity:manualKey&&manualPts?1:0.4}}>SET</button>
          </div>
          {manualSearch.trim().length>0&&(
            <div style={{background:"#0d1117",border:"1px solid #1e2f40",borderRadius:6,overflow:"hidden",maxHeight:200,overflowY:"auto"}}>
              {draftedWrestlers
                .filter(w=>w.name.toLowerCase().includes(manualSearch.toLowerCase())||w.team.toLowerCase().includes(manualSearch.toLowerCase()))
                .slice(0,12)
                .map(w=>(
                  <div key={w.key}
                    onClick={()=>{setManualKey(w.key);setManualSearch(w.name);}}
                    className="wrow"
                    style={{padding:"7px 12px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                      background:manualKey===w.key?"#0d2040":"transparent",
                      borderBottom:"1px solid #111820"}}>
                    <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",minWidth:30}}>{w.weight}lb</span>
                    <span style={{fontSize:10,color:"#3a4040",fontFamily:"'Barlow Condensed',sans-serif",minWidth:18}}>#{w.seed}</span>
                    <span style={{flex:1,fontSize:12,color:manualKey===w.key?"#93c5fd":"#d0c8b4",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>{w.name}</span>
                    <span style={{fontSize:10,color:getColor(w.team).text,fontFamily:"'Barlow Condensed',sans-serif"}}>{w.team}</span>
                    {w.pts>0&&<span style={{fontSize:11,color:"#34d399",fontFamily:"'Barlow Condensed',sans-serif"}}>{w.pts}pt</span>}
                  </div>
                ))}
              {draftedWrestlers.filter(w=>w.name.toLowerCase().includes(manualSearch.toLowerCase())||w.team.toLowerCase().includes(manualSearch.toLowerCase())).length===0&&(
                <div style={{padding:"10px 14px",fontSize:12,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif"}}>No drafted wrestlers match "{manualSearch}"</div>
              )}
            </div>
          )}
          {manualKey&&!manualSearch.trim()&&(
            <div style={{fontSize:11,color:"#93c5fd",fontFamily:"'Barlow Condensed',sans-serif",marginTop:4}}>
              ✓ Selected — enter points above and click SET
            </div>
          )}
        </div>
      </div>

      {/* ── CUMULATIVE SCORES TABLE ── */}
      {draftedWrestlers.length>0&&(
        <div className="card">
          <div style={{padding:"9px 14px",borderBottom:"1px solid #1a1f26",background:"#0d1219",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:13,fontWeight:600,color:"#c9a84c",letterSpacing:".08em"}}>CUMULATIVE SCORES — ALL DRAFTED WRESTLERS</span>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif"}}>{totalEntered}/{draftedWrestlers.length} scored · Total: <b style={{color:"#34d399"}}>{grandTotal.toFixed(1)}</b></span>
              <button className="btn btn-danger btn-sm" onClick={()=>{if(window.confirm("Clear all entered points?"))setPoints({});}}>CLEAR SCORES</button>
            </div>
          </div>
          {draftedWrestlers.map((wr,i)=>{
            const tc=getColor(wr.team);
            return (
              <div key={wr.key} className="wrow" style={{padding:"6px 14px",borderBottom:i<draftedWrestlers.length-1?"1px solid #0f1318":"none",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",minWidth:28}}>{wr.weight}lb</span>
                <span style={{fontSize:10,color:"#3a4040",fontFamily:"'Barlow Condensed',sans-serif",minWidth:16}}>#{wr.seed}</span>
                <span style={{flex:1,fontSize:13,color:"#c0b898",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.name}</span>
                <span style={{fontSize:10,color:tc.text,padding:"1px 7px",background:`${tc.bg}22`,border:`1px solid ${tc.bg}44`,borderRadius:4,fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>{wr.team}</span>
                <span style={{fontSize:15,fontWeight:700,color:wr.pts>0?"#34d399":"#3a4040",minWidth:50,textAlign:"right"}}>{wr.pts>0?`${wr.pts}pt`:"—"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({v,l,c,bg,bd}){
  return (
    <div style={{padding:"6px 14px",background:bg,border:`1px solid ${bd}`,borderRadius:6,textAlign:"center",minWidth:80}}>
      <div style={{fontSize:22,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
      <div style={{fontSize:8,color:c+"88",letterSpacing:".12em",marginTop:1}}>{l}</div>
    </div>
  );
}

// ─── STANDINGS PAGE ───────────────────────────────────────────────────────────
function StandingsPage({teamScores,getColor,getRoster}){
  const [expanded,setExpanded]=useState(null);
  const leader=teamScores[0]?.total||0;
  return (
    <div>
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:20,fontWeight:700,letterSpacing:".1em",color:"#c9a84c"}}>LIVE STANDINGS</h2>
        <p style={{color:"#4a4020",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>Updates automatically as scores are imported</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {teamScores.map((ts,i)=>{
          const c=getColor(ts.team);const pct=leader>0?(ts.total/leader)*100:0;const isExp=expanded===ts.team;
          return (
            <div key={ts.team} className="card" style={{borderLeft:`4px solid ${c.bg}`}}>
              <div onClick={()=>setExpanded(isExp?null:ts.team)} style={{padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                <div className="rank-badge" style={{background:i===0?"radial-gradient(circle at 35% 35%,#e6c84e,#7a5810)":i===1?"radial-gradient(circle at 35% 35%,#aaa,#555)":i===2?"radial-gradient(circle at 35% 35%,#cd7f32,#7a4510)":"#1a1f26",color:i<3?"#070a0e":"#5a5030",boxShadow:i===0?"0 0 12px #c9a84c66":"none"}}>
                  {i+1}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:9,height:9,borderRadius:"50%",background:c.bg,boxShadow:`0 0 6px ${c.bg}`,flexShrink:0}}/>
                    <span style={{fontSize:17,fontWeight:600,color:c.text,letterSpacing:".05em"}}>{ts.team}</span>
                    <span style={{fontSize:11,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>{getRoster(ts.team).length} wrestlers</span>
                  </div>
                  <div style={{marginTop:6,height:4,background:"#1a1f26",borderRadius:2,overflow:"hidden"}}>
                    <div className="avail-bar" style={{height:"100%",width:`${pct}%`,background:c.bg,borderRadius:2,boxShadow:`0 0 6px ${c.bg}66`}}/>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:28,fontWeight:700,color:i===0?"#c9a84c":c.text,lineHeight:1}}>{ts.total.toFixed(1)}</div>
                  <div style={{fontSize:9,color:"#3a3820",letterSpacing:".12em"}}>POINTS</div>
                </div>
                <div style={{fontSize:14,color:"#3a3820"}}>{isExp?"▲":"▼"}</div>
              </div>
              {isExp&&(
                <div style={{borderTop:"1px solid #1a1f26",padding:"10px 16px"}}>
                  {ts.breakdown.length===0
                    ?<div style={{fontSize:12,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>No points yet — import scores on the Scores page</div>
                    :<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {ts.breakdown.sort((a,b)=>b.pts-a.pts).map(wr=>(
                        <div key={`${wr.weight}-${wr.seed}`} style={{padding:"5px 10px",background:`${c.bg}18`,border:`1px solid ${c.bg}33`,borderRadius:6,display:"flex",gap:7,alignItems:"center"}}>
                          <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif"}}>{wr.weight}#</span>
                          <span style={{fontSize:12,color:c.text,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>#{wr.seed} {wr.name}</span>
                          <span style={{fontSize:13,fontWeight:700,color:"#34d399"}}>{wr.pts}pt</span>
                        </div>
                      ))}
                    </div>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DATA PAGE ────────────────────────────────────────────────────────────────
function SetupPage({teams,setTeams,picks,setPicks,setPoints,getRoster,getColor,draftTeam,setDraftTeam,showToast}){
  const [newName,setNewName]=useState("");
  const add=()=>{if(newName.trim()&&!teams.includes(newName.trim())){setTeams(p=>[...p,newName.trim()]);setNewName("");showToast("Team added","ok");}};
  return (
    <div style={{maxWidth:680}}>
      <div style={{marginBottom:22}}>
        <h2 style={{fontSize:20,fontWeight:700,letterSpacing:".1em",color:"#c9a84c"}}>DRAFT SETUP</h2>
        <p style={{color:"#4a4020",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>Manage teams · Snake draft order auto-applied</p>
      </div>
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:10}}>ADD TEAM</div>
        <div style={{display:"flex",gap:8}}>
          <input className="inp" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Team name…"/>
          <button className="btn btn-primary btn-md" onClick={add}>ADD</button>
        </div>
      </div>
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:14}}>TEAMS ({teams.length}) — SNAKE ORDER</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {teams.map((t,i)=>{const c=getColor(t);const cnt=getRoster(t).length;return (
            <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#070a0e",border:`1px solid ${c.bg}33`,borderLeft:`4px solid ${c.bg}`,borderRadius:6}}>
              <span style={{fontSize:10,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif",minWidth:20,textAlign:"right"}}>#{i+1}</span>
              <div style={{width:8,height:8,borderRadius:"50%",background:c.bg,boxShadow:`0 0 5px ${c.bg}`,flexShrink:0}}/>
              <span style={{flex:1,fontSize:15,fontWeight:500,color:c.text,letterSpacing:".05em"}}>{t}</span>
              <span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif"}}>{cnt} pick{cnt!==1?"s":""}</span>
              <button className="undo-x" style={{fontSize:15}} onClick={()=>{setTeams(p=>p.filter(x=>x!==t));if(draftTeam===t)setDraftTeam(teams.find(x=>x!==t)||"");}}>✕</button>
            </div>
          );})}
        </div>
      </div>
      <div className="card" style={{padding:16,border:"1px solid #3a1515"}}>
        <div className="sec-label" style={{color:"#7a2020",marginBottom:10}}>DANGER ZONE</div>
        <button className="btn btn-danger btn-md" onClick={()=>{if(window.confirm("Clear all picks and scores?")){{setPicks({});setPoints({});showToast("Cleared","info");}}}}>CLEAR ALL PICKS & SCORES</button>
      </div>
    </div>
  );
}


// ─── ROSTER PAGE ──────────────────────────────────────────────────────────────
function RosterPage({team,roster,getColor,picksPerTeam,allWrestlers,picks,setPicks,
  wrestlers,bonusKeys,setBonusKeys,bonusPickEnabled,showToast}){
  const c=getColor(team);
  const total=roster.reduce((s,w)=>s+w.pts,0);

  // Classify first: bonus = in bonusKeys OR 2nd pick at same weight
  const primaryByWeight2={};
  const bonusPicks=[];
  roster.forEach(wr=>{
    const isManualBonus=bonusKeys.includes(wr.key);
    if(!isManualBonus&&WEIGHT_CLASSES.includes(wr.weight)&&!primaryByWeight2[wr.weight]){
      primaryByWeight2[wr.weight]=wr;
    } else {
      bonusPicks.push(wr);
    }
  });
  const covered=Object.keys(primaryByWeight2).length;

  // byW only shows non-bonus picks so weight slots appear vacant after →⭐
  const byW={};
  WEIGHT_CLASSES.forEach(w=>{byW[w]=roster.filter(r=>r.weight===w&&!bonusPicks.includes(r));});

  // ── Replace mode ──────────────────────────────────────────────────────────
  const [replaceTarget,setReplaceTarget]=useState(null);
  const [replaceQ,setReplaceQ]=useState("");
  const cancelReplace=()=>{setReplaceTarget(null);setReplaceQ("");};

  const undraftedWrestlers=useMemo(()=>{
    const list=[];
    [...WEIGHT_CLASSES,0].forEach(w=>(wrestlers[w]||[]).forEach(wr=>{
      if(!picks[pickKey(w,wr.seed)]) list.push({...wr,weight:w});
    }));
    return list;
  },[wrestlers,picks]);

  const replaceResults=useMemo(()=>{
    if(!replaceQ.trim()) return [];
    const q=replaceQ.toLowerCase();
    return undraftedWrestlers
      .filter(w=>w.name.toLowerCase().includes(q)||w.school.toLowerCase().includes(q))
      .slice(0,8);
  },[replaceQ,undraftedWrestlers]);

  const doReplace=(newWeight,newSeed)=>{
    if(!replaceTarget) return;
    const newKey=pickKey(newWeight,newSeed);
    // Hard guard — reject if anyone already has this key
    if(picks[newKey]){showToast("That wrestler is already drafted","err");return;}
    const oldKey=replaceTarget.key;
    setPicks(prev=>{const n={...prev};delete n[oldKey];n[newKey]=team;return n;});
    // Transfer bonus designation if applicable
    if(bonusKeys.includes(oldKey)){
      setBonusKeys(prev=>[...prev.filter(k=>k!==oldKey),newKey]);
    }
    const newWr=undraftedWrestlers.find(w=>w.weight===newWeight&&w.seed===newSeed);
    showToast(`${replaceTarget.name} → ${newWr?.name||"wrestler"}`,"ok");
    cancelReplace();
  };

  // Move primary → bonus: just add key to bonusKeys, pick stays intact
  const movePrimaryToBonus=(wr)=>{
    if(!bonusPickEnabled){showToast("Enable bonus picks in Settings first","err");return;}
    if(bonusKeys.includes(wr.key)) return;
    setBonusKeys(prev=>[...prev,wr.key]);
    showToast(`${wr.name} moved to ⭐ Bonus`,"info");
  };

  // Move bonus → weight: remove key from bonusKeys; check weight slot not already occupied
  const moveBonusToWeight=(wr)=>{
    const occupant=roster.find(r=>r.weight===wr.weight&&r.key!==wr.key&&!bonusKeys.includes(r.key));
    if(occupant){
      showToast(`${wr.weight}lb already has ${occupant.name} — use Replace first`,"err");
      return;
    }
    setBonusKeys(prev=>prev.filter(k=>k!==wr.key));
    showToast(`${wr.name} moved back to ${wr.weight}lb`,"ok");
  };

  // ── Hover state for button reveal ─────────────────────────────────────────
  const [hoveredKey,setHoveredKey]=useState(null);

  const WrCard=({wr,isBonus})=>{
    const isH=hoveredKey===wr.key;
    return (
      <div
        onMouseEnter={()=>setHoveredKey(wr.key)}
        onMouseLeave={()=>setHoveredKey(null)}
        style={{padding:"6px 8px",marginBottom:4,cursor:"default",borderRadius:6,
          background:isBonus?(isH?"#c9a84c22":"#c9a84c14"):(isH?`${c.bg}28`:`${c.bg}18`),
          border:`1px solid ${isBonus?"#c9a84c2e":c.bg+"2e"}`,
          transition:"background .12s"}}>
        {isBonus&&<div style={{fontSize:8,color:"#c9a84c88",letterSpacing:".1em",marginBottom:1}}>⭐ BONUS</div>}
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",
            fontWeight:700,minWidth:18,flexShrink:0}}>#{wr.seed}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,color:isBonus?"#c9a84c":c.text,fontFamily:"'Barlow Condensed',sans-serif",
              fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.name}</div>
            <div style={{fontSize:9,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif",
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wr.school}</div>
          </div>
          {wr.pts>0&&!isH&&(
            <span style={{fontSize:11,fontWeight:700,color:"#34d399",flexShrink:0}}>{wr.pts}pt</span>
          )}
          {isH&&(
            <div style={{display:"flex",gap:3,flexShrink:0}}>
              <button onClick={()=>{setReplaceTarget({key:wr.key,weight:wr.weight,seed:wr.seed,name:wr.name});setReplaceQ("");}}
                style={{fontSize:9,padding:"2px 7px",background:"#0c1e14",border:"1px solid #1a4828",
                  borderRadius:4,color:"#2aaa64",fontFamily:"'Oswald',sans-serif",fontWeight:600,
                  letterSpacing:".07em",cursor:"pointer",whiteSpace:"nowrap"}}>REPLACE</button>
              {!isBonus&&bonusPickEnabled&&(
                <button onClick={()=>movePrimaryToBonus(wr)}
                  title="Designate as bonus/dark horse pick"
                  style={{fontSize:9,padding:"2px 7px",background:"#181208",border:"1px solid #3a2e10",
                    borderRadius:4,color:"#c9a84c",fontFamily:"'Oswald',sans-serif",fontWeight:600,
                    letterSpacing:".05em",cursor:"pointer",whiteSpace:"nowrap"}}>→⭐</button>
              )}
              {isBonus&&(
                <button onClick={()=>moveBonusToWeight(wr)}
                  title="Move back to weight class slot"
                  style={{fontSize:9,padding:"2px 7px",background:"#080e18",border:"1px solid #1a2e48",
                    borderRadius:4,color:"#6aa0d0",fontFamily:"'Oswald',sans-serif",fontWeight:600,
                    letterSpacing:".05em",cursor:"pointer",whiteSpace:"nowrap"}}>←WT</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* ── Replace mode panel ── */}
      {replaceTarget&&(
        <div style={{position:"sticky",top:0,zIndex:200,marginBottom:12,
          background:"#0d1520",border:"2px solid #c9a84c88",borderRadius:8,
          boxShadow:"0 8px 32px #000000cc",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",background:"#0a1018",borderBottom:"1px solid #c9a84c33",
            display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:9,letterSpacing:".16em",color:"#8a7040",fontFamily:"'Oswald',sans-serif",marginBottom:2}}>
                REPLACING PICK
              </div>
              <div style={{fontSize:14,fontWeight:700,color:"#e0d8b4",fontFamily:"'Barlow Condensed',sans-serif"}}>
                {replaceTarget.name}
                <span style={{fontSize:10,color:"#4a4030",marginLeft:8,fontWeight:400}}>
                  {replaceTarget.weight>0?`${replaceTarget.weight}lb`:"Custom"} · #{replaceTarget.seed}
                </span>
              </div>
            </div>
            <button onClick={cancelReplace}
              style={{padding:"5px 12px",background:"transparent",border:"1px solid #3a3020",
                borderRadius:5,color:"#6a5a30",fontSize:11,fontFamily:"'Oswald',sans-serif",
                cursor:"pointer",letterSpacing:".08em"}}>CANCEL</button>
          </div>
          <div style={{padding:"10px 14px"}}>
            <input autoFocus value={replaceQ} onChange={e=>setReplaceQ(e.target.value)}
              placeholder="Search for replacement by name or school…"
              style={{width:"100%",padding:"9px 12px",background:"#070a0e",
                border:"1px solid #2a3040",borderRadius:6,color:"#d0c8b4",
                fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",boxSizing:"border-box"}}/>
            {replaceResults.length>0&&(
              <div style={{marginTop:6,background:"#070a0e",border:"1px solid #1e2a38",borderRadius:6,overflow:"hidden"}}>
                {replaceResults.map((wr,i)=>(
                  <button key={`${wr.weight}-${wr.seed}`} onClick={()=>doReplace(wr.weight,wr.seed)}
                    style={{width:"100%",padding:"9px 14px",display:"flex",alignItems:"center",gap:10,
                      background:"transparent",border:"none",
                      borderBottom:i<replaceResults.length-1?"1px solid #111820":"none",
                      cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#111820"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",minWidth:38,flexShrink:0}}>
                      {wr.weight>0?`${wr.weight}lb`:"?"}
                    </span>
                    <span style={{fontSize:10,color:"#3a4040",fontFamily:"'Barlow Condensed',sans-serif",minWidth:22,flexShrink:0}}>#{wr.seed}</span>
                    <span style={{flex:1,fontSize:14,color:"#d0c8b4",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>{wr.name}</span>
                    <span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif"}}>{wr.school}</span>
                    <span style={{fontSize:10,color:"#2a6a44",fontFamily:"'Oswald',sans-serif",fontWeight:700,flexShrink:0}}>SELECT</span>
                  </button>
                ))}
              </div>
            )}
            {replaceQ.trim()&&replaceResults.length===0&&(
              <div style={{marginTop:6,padding:"10px 14px",color:"#4a4030",fontSize:12,
                fontFamily:"'Barlow Condensed',sans-serif",background:"#070a0e",
                border:"1px solid #1e2a38",borderRadius:6}}>
                No undrafted wrestlers found matching "{replaceQ}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team header */}
      <div style={{padding:"16px 20px",marginBottom:16,
        background:`linear-gradient(135deg,${c.bg}1a 0%,#0b0f14 55%)`,
        border:`1px solid ${c.bg}33`,borderLeft:`5px solid ${c.bg}`,
        borderRadius:12,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div style={{width:44,height:44,borderRadius:"50%",
          background:`radial-gradient(circle at 35% 35%,${c.bg},${c.bg}66)`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:20,boxShadow:`0 0 18px ${c.glow}`,flexShrink:0}}>🏆</div>
        <div style={{flex:1}}>
          <div style={{fontSize:24,fontWeight:700,color:c.text,letterSpacing:".08em",lineHeight:1.1}}>{team.toUpperCase()}</div>
          <div style={{fontSize:10,color:"#4a4020",letterSpacing:".12em",fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>
            {roster.length}/{picksPerTeam} PICKS · {covered}/10 WEIGHTS · {total.toFixed(1)} PTS
          </div>
        </div>
        <div style={{fontSize:36,fontWeight:700,color:total>0?"#c9a84c":"#3a3820",lineHeight:1}}>
          {total.toFixed(1)}<span style={{fontSize:14,color:"#4a4030"}}> pts</span>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {WEIGHT_CLASSES.map(w=>(
            <div key={w} style={{padding:"3px 7px",borderRadius:4,fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,
              background:byW[w].length>0?`${c.bg}44`:"#1a1f26",border:`1px solid ${byW[w].length>0?c.bg:"#1e2530"}`,
              color:byW[w].length>0?c.text:"#2a3030"}}>
              {w===285?"HWT":w}
            </div>
          ))}
          <div style={{padding:"3px 7px",borderRadius:4,fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,
            background:bonusPicks.length>0?"#c9a84c33":"#1a1f26",border:`1px solid ${bonusPicks.length>0?"#c9a84c55":"#1e2530"}`,
            color:bonusPicks.length>0?"#c9a84c":"#2a3030"}}>⭐ BONUS</div>
        </div>
      </div>

      {/* Weight grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:12}}>
        {WEIGHT_CLASSES.map(w=>{
          const wrs=byW[w]||[];
          return (
            <div key={w} className="card" style={{borderTop:`3px solid ${wrs.length>0?c.bg:"#1e2530"}`}}>
              <div style={{padding:"8px 11px 6px",borderBottom:"1px solid #1a1f26",background:"#0d1219",
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:20,fontWeight:700,color:"#c9a84c"}}>{w}</span>
                <span style={{fontSize:9,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>lbs</span>
              </div>
              <div style={{padding:8,minHeight:48}}>
                {wrs.length===0
                  ?<div style={{padding:"10px 0",textAlign:"center",color:"#1e2218",fontSize:11,fontFamily:"'Barlow Condensed',sans-serif"}}>— empty —</div>
                  :wrs.map(wr=><WrCard key={wr.key} wr={wr} isBonus={bonusPicks.includes(wr)}/>)
                }
              </div>
            </div>
          );
        })}
      </div>

      {/* Bonus / Dark Horse slot */}
      <div className="card" style={{marginBottom:16,borderTop:"3px solid #c9a84c"}}>
        <div style={{padding:"9px 16px",borderBottom:"1px solid #1a1f26",background:"#0d1219",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:700,color:"#c9a84c",letterSpacing:".1em"}}>⭐ BONUS / DARK HORSE PICK</span>
          <span style={{fontSize:11,color:"#4a4020",fontFamily:"'Barlow Condensed',sans-serif"}}>hover any weight pick → click →⭐ to designate</span>
        </div>
        <div style={{padding:12}}>
          {bonusPicks.length===0
            ?<div style={{padding:"14px 0",textAlign:"center",color:"#3a3020",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif"}}>
                No bonus pick yet — hover any weight pick and click →⭐
              </div>
            :bonusPicks.map((wr,i)=>{
              const isH=hoveredKey===wr.key;
              return (
                <div key={wr.key}
                  onMouseEnter={()=>setHoveredKey(wr.key)}
                  onMouseLeave={()=>setHoveredKey(null)}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                    background:isH?"#c9a84c28":"#c9a84c18",border:"1px solid #c9a84c33",
                    borderRadius:7,marginBottom:i<bonusPicks.length-1?6:0,
                    transition:"background .12s",cursor:"default"}}>
                  <span style={{fontSize:18}}>⭐</span>
                  <span style={{fontSize:10,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",minWidth:40}}>
                    {wr.weight>0?`${wr.weight}lb`:"?"}
                  </span>
                  <span style={{fontSize:10,color:"#5a5030",fontFamily:"'Barlow Condensed',sans-serif",minWidth:16}}>#{wr.seed}</span>
                  <span style={{flex:1,fontSize:14,fontWeight:600,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif"}}>{wr.name}</span>
                  <span style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif"}}>{wr.school}</span>
                  {wr.pts>0&&!isH&&<span style={{fontSize:15,fontWeight:700,color:"#34d399"}}>{wr.pts}pt</span>}
                  {isH&&(
                    <div style={{display:"flex",gap:3,flexShrink:0}}>
                      <button onClick={()=>{setReplaceTarget({key:wr.key,weight:wr.weight,seed:wr.seed,name:wr.name});setReplaceQ("");}}
                        style={{fontSize:9,padding:"2px 7px",background:"#0c1e14",border:"1px solid #1a4828",
                          borderRadius:4,color:"#2aaa64",fontFamily:"'Oswald',sans-serif",fontWeight:600,
                          letterSpacing:".07em",cursor:"pointer"}}>REPLACE</button>
                      <button onClick={()=>moveBonusToWeight(wr)}
                        title="Move back to weight class slot"
                        style={{fontSize:9,padding:"2px 7px",background:"#080e18",border:"1px solid #1a2e48",
                          borderRadius:4,color:"#6aa0d0",fontFamily:"'Oswald',sans-serif",fontWeight:600,
                          letterSpacing:".05em",cursor:"pointer"}}>←WT</button>
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
      </div>

      {/* Full pick log */}
      {roster.length>0&&(
        <div className="card" style={{padding:16}}>
          <div className="sec-label" style={{marginBottom:12}}>ALL {roster.length} PICKS — {team}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {[...roster].sort((a,b)=>b.pts-a.pts||a.seed-b.seed).map(wr=>{
              const isB=bonusPicks.includes(wr);const isH=hoveredKey===wr.key;
              return (
                <div key={wr.key}
                  onMouseEnter={()=>setHoveredKey(wr.key)}
                  onMouseLeave={()=>setHoveredKey(null)}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",
                    background:isB?(isH?"#c9a84c28":"#c9a84c18"):(isH?`${c.bg}28`:`${c.bg}18`),
                    border:`1px solid ${isB?"#c9a84c33":c.bg+"33"}`,borderRadius:6,
                    cursor:"default",transition:"background .12s"}}>
                  {isB&&<span style={{fontSize:10}}>⭐</span>}
                  <span style={{fontSize:9,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>
                    {wr.weight>0?`${wr.weight}#`:"?"}
                  </span>
                  <span style={{fontSize:12,color:isB?"#c9a84c":c.text,fontFamily:"'Barlow Condensed',sans-serif"}}>
                    #{wr.seed} {wr.name}
                  </span>
                  {wr.pts>0&&!isH&&<span style={{fontSize:11,fontWeight:700,color:"#34d399"}}>{wr.pts}pt</span>}
                  {isH&&(
                    <button onClick={()=>{setReplaceTarget({key:wr.key,weight:wr.weight,seed:wr.seed,name:wr.name});setReplaceQ("");}}
                      style={{fontSize:9,padding:"1px 6px",background:"transparent",border:"1px solid #2a3820",
                        borderRadius:3,color:"#4a8060",fontFamily:"'Oswald',sans-serif",cursor:"pointer",letterSpacing:".05em"}}>
                      ↺ REPLACE
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

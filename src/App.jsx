import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { DEFAULT_WRESTLERS } from './wrestlers';
import { loadDraftState, savePick, saveSettings } from './leagueService';
import { supabase } from './supabase';
import { useRealtimePicks } from './hooks/useRealtimePicks';
import { useRealtimePoints } from './hooks/useRealtimePoints';
import RejoinApprovalBanner from './RejoinApprovalBanner';
import { WEIGHT_CLASSES, TEAM_COLORS, DEFAULT_TEAMS, PICKS_PER_TEAM_BASE, PICKS_PER_TEAM_BONUS } from './constants';
import { pickKey, buildNameIndex, fuzzyFind, playChime } from './utils/scoreParser';
import Header from './components/Header';
import BoardPage from './components/BoardPage';
import SettingsPage from './components/SettingsPage';
import StandingsPage from './components/StandingsPage';
import SetupPage from './components/SetupPage';
import RosterPage from './components/RosterPage';

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
.pulse{opacity:.72;}
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

export default function App({
  leagueId,
  session,
  leagueName,
  teams: teamsProp,
  settings,
  initialPage = "board",
  commissionerEmail = null,
}){
  const [teams,setTeams]=useState(()=>{
    if(teamsProp&&teamsProp.length>0) return teamsProp.map(t=>t.name);
    return DEFAULT_TEAMS;
  });

  const isCommissioner=session?.role==="commissioner"||session?.role==="co_commissioner";

  const [wrestlers,setWrestlers]=useState(DEFAULT_WRESTLERS);
  const [picks,setPicks]=useState({});
  const [bonusKeys,setBonusKeys]=useState([]);
  const [points,setPoints]=useState({});
  const [picksLog,setPicksLog]=useState([]);
  const wrestlersRef=useRef(wrestlers);
  useEffect(()=>{wrestlersRef.current=wrestlers;},[wrestlers]);
  const [stateLoading,setStateLoading]=useState(!!leagueId);
  // draftHasStarted = true once first pick is made (or picks exist on load)
  const [draftHasStarted,setDraftHasStarted]=useState(false);
  const [draftComplete,setDraftComplete]=useState(()=>!!(settings?.draftComplete));
  const [activePage,setActivePage]=useState(initialPage);

  // ── Load persisted draft state from Supabase on mount ────────────
  useEffect(()=>{
    if(!leagueId) return;
    loadDraftState(leagueId).then(state=>{
      if(!state) return;
      if(Object.keys(state.wrestlers).length>0) setWrestlers(state.wrestlers);
      if(Object.keys(state.picks).length>0){setPicks(state.picks);setDraftHasStarted(true);}
      if(state.bonusKeys.length>0) setBonusKeys(state.bonusKeys);
      if(Object.keys(state.points).length>0) setPoints(state.points);
      if(state.picksLog&&state.picksLog.length>0) setPicksLog(state.picksLog);
    }).catch(err=>{
      console.error('Failed to load draft state:', err);
    }).finally(()=>{
      setStateLoading(false);
    });
  },[leagueId]);

  // ── Ascending pick timer — declared before handleRemotePick to avoid Vite TDZ ──
  const [timerSec,setTimerSec]=useState(0);
  const [timerPaused,setTimerPaused]=useState(false);
  const timerRef=useRef(null);
  const timerPausedRef=useRef(false);
  const resetTimer=useCallback(()=>{
    setTimerSec(0);
    setTimerPaused(false);
    timerPausedRef.current=false;
    if(timerRef.current) clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{if(!timerPausedRef.current)setTimerSec(s=>s+1);},1000);
  },[]);
  const pauseTimer=()=>{timerPausedRef.current=true;setTimerPaused(true);if(leagueId)saveSettings(leagueId,{timerPaused:true}).catch(()=>{});};
  const resumeTimer=()=>{timerPausedRef.current=false;setTimerPaused(false);if(leagueId)saveSettings(leagueId,{timerPaused:false}).catch(()=>{});};
  const [_timerInit]=useState(()=>{
    // Draft is always live on mount — start timer running immediately
    timerPausedRef.current=false;
    timerRef.current=setInterval(()=>{if(!timerPausedRef.current)setTimerSec(s=>s+1);},1000);
    return null;
  });

  // ── Real-time sync — incoming picks from other devices ───────────
  const handleRemotePick = useCallback(({ key, teamName }) => {
    setPicks(p => {
      if (p[key]) return p; // already have it (own pick) — suppress
      return { ...p, [key]: teamName };
    });
    setPicksLog(prev => {
      if (prev.some(e => e.key === key)) return prev; // already logged (own pick)
      const [w, s] = key.split('-').map(Number);
      const wr = (wrestlersRef.current[w] || []).find(x => x.seed === s);
      return [...prev, { key, teamName, weight: w, seed: s, name: wr?.name || key, school: wr?.school || '', isBonus: false }];
    });
    resetTimer();
  }, [resetTimer]);

  // ── Real-time sync — incoming points updates ─────────────────────
  const handleRemotePoints = useCallback(({ key, pts }) => {
    setPoints(p => ({ ...p, [key]: pts }));
  }, []);

  useRealtimePicks(leagueId, wrestlers, teamsProp, handleRemotePick);
  useRealtimePoints(leagueId, wrestlers, handleRemotePoints);

  // ── Realtime timer-pause sync ─────────────────────────────────────────────
  useEffect(()=>{
    if(!leagueId) return;
    const ch=supabase.channel(`timer-pause-${leagueId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leagues',filter:`id=eq.${leagueId}`},
        (payload)=>{
          const s=payload.new?.settings_json;
          if(!s) return;
          if(typeof s.timerPaused==='boolean'){
            timerPausedRef.current=s.timerPaused;
            setTimerPaused(s.timerPaused);
          }
          if(s.draftComplete){
            setDraftComplete(true);
            if(timerRef.current) clearInterval(timerRef.current);
          }
        })
      .subscribe();
    return ()=>ch.unsubscribe();
  },[leagueId]);

  const [searchQ,setSearchQ]=useState("");
  const [toast,setToast]=useState(null);
  const [hlKey,setHlKey]=useState(null);
  // ── Bonus pick confirmation modal ────────────────────────────────
  const [bonusConfirm,setBonusConfirm]=useState(null); // { weight, seed, team } | null

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

  // ── Per-device chime — auto-disabled for solo commissioner ───────────────
  // Solo commissioner = created the league, controls all picks, chime every pick = noise
  const [chimeEnabled,setChimeEnabled]=useState(()=>session?.role!=="commissioner");
  const chimeEnabledRef=useRef(chimeEnabled);
  useEffect(()=>{chimeEnabledRef.current=chimeEnabled;},[chimeEnabled]);

  // ── Draft order computation ───────────────────────────────────────────────
  const totalPicks=Object.keys(picks).length;
  const n=Math.max(draftOrder.length,1);
  const round=Math.floor(totalPicks/n);
  const pos=totalPicks%n;

  // ── Auto-detect draft completion if flag wasn't persisted to DB ──────────
  useEffect(()=>{
    if(draftComplete) return;
    if(draftOrder.length===0||picksPerTeam===0) return;
    if(Object.keys(picks).length>=draftOrder.length*picksPerTeam){
      setDraftComplete(true);
      if(timerRef.current) clearInterval(timerRef.current);
      if(leagueId) saveSettings(leagueId,{draftComplete:true}).catch(()=>{});
    }
  },[picks,draftComplete,draftOrder.length,picksPerTeam,leagueId]);

  const onClock=useMemo(()=>{
    if(draftOrder.length===0) return "";
    if(rotationType==="snake"){
      return round%2===0?draftOrder[pos]:draftOrder[n-1-pos];
    }
    if(rotationType==="linear"){
      return draftOrder[pos];
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

  // ── Chime trigger — fires when totalPicks increases and it's this device's turn ──
  const chimePicksRef=useRef(null);
  useEffect(()=>{
    if(chimePicksRef.current===null){chimePicksRef.current=totalPicks;return;} // skip mount
    if(totalPicks<=chimePicksRef.current){chimePicksRef.current=totalPicks;return;}
    chimePicksRef.current=totalPicks;
    if(chimeEnabledRef.current&&userCanPickNow(onClock)) playChime();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[totalPicks]);

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
  const draftPick=async(weight,seed,forTeam,skipBonusCheck=false)=>{
    if(draftComplete){showToast("Draft is complete — rosters are locked","err");return;}
    const team=forTeam||onClock;
    if(!isCommissioner&&!userCanPickNow(team)){showToast("You can only draft for your own team on your turn","err");return;}
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
    // ── Bonus confirmation logic ──────────────────────────────────
    if(isBonus&&!skipBonusCheck){
      // Count existing bonus picks for this team
      const existingBonusCount=Object.entries(picks).filter(([k,t])=>{
        return t===team&&bonusKeys.includes(k);
      }).length;
      // Also count auto-bonus picks (second pick at same weight, not in bonusKeys)
      const autoBonusCount=Object.entries(picks).filter(([k,t])=>{
        if(t!==team) return false;
        if(bonusKeys.includes(k)) return false;
        const [w]=k.split("-");
        const sameWeight=Object.entries(picks).filter(([k2,t2])=>t2===team&&k2.startsWith(`${w}-`)&&k2!==k);
        return sameWeight.length>0;
      }).length;
      const totalBonusCount=existingBonusCount+autoBonusCount;
      if(totalBonusCount>=1){
        showToast(`${team} already has a bonus pick — no more room on roster`,"err");
        return;
      }
      // Show confirmation modal
      setBonusConfirm({weight,seed,team});
      return;
    }
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
    setPicksLog(prev=>[...prev,{key,teamName:team,weight,seed,name:wr?.name||key,school:wr?.school||'',isBonus}]);
    if(!draftHasStarted){setDraftHasStarted(true);setActivePage("board");}
    // Check if this pick completes the draft
    const newTotal=totalPicks+1;
    if(n>0&&newTotal>=picksPerTeam*n){
      if(leagueId) saveSettings(leagueId,{draftComplete:true}).catch(()=>{});
      setDraftComplete(true);
      if(timerRef.current) clearInterval(timerRef.current);
      showToast("🏆 Draft complete! All rosters are full.","ok");
    } else {
      showToast(`${wr?.name||"Wrestler"} → ${team}${isBonus?" ⭐ BONUS":""}`,isBonus?"info":"ok");
    }
    setHlKey(key);setTimeout(()=>setHlKey(null),1200);
    setSearchQ("");
    if(!draftComplete) resetTimer();
  };

  const draftCustom=(rawName,forTeam)=>{
    const team=forTeam||onClock;
    if(!isCommissioner&&!userCanPickNow(team)){showToast("You can only draft for your own team on your turn","err");return;}
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

  // Override pick assignment (team reassign) — commissioner only
  const reassignPick=(key,newTeam)=>{
    if(!isCommissioner){showToast("Only the commissioner can reassign picks","err");return;}
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
      {/* ── Bonus pick confirmation modal ── */}
      {bonusConfirm&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.78)",
          display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setBonusConfirm(null)}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:"#111820",border:"2px solid #c9a84c",borderRadius:10,
              boxShadow:"0 24px 64px #000000",width:320,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",background:"#0a1018",borderBottom:"1px solid #c9a84c44"}}>
              <div style={{fontSize:9,letterSpacing:".18em",color:"#8a7040",
                fontFamily:"'Oswald',sans-serif",marginBottom:6}}>BONUS PICK</div>
              <div style={{fontSize:15,fontWeight:700,color:"#e0d8b4",
                fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1.4}}>
                {bonusConfirm.team} already has a wrestler at {bonusConfirm.weight}lb.
                Would you like to add this as their bonus pick?
              </div>
            </div>
            <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
              <button
                onClick={()=>{const {weight,seed,team}=bonusConfirm;setBonusConfirm(null);draftPick(weight,seed,team,true);}}
                style={{width:"100%",padding:"12px",background:"#c9a84c",border:"none",
                  borderRadius:6,fontSize:14,fontWeight:700,color:"#070a0e",
                  fontFamily:"'Oswald',sans-serif",letterSpacing:".08em",cursor:"pointer"}}>
                YES — ADD AS BONUS ⭐
              </button>
              <button
                onClick={()=>setBonusConfirm(null)}
                style={{width:"100%",padding:"12px",background:"none",
                  border:"1px solid #2a3040",borderRadius:6,fontSize:13,
                  fontWeight:600,color:"#7a8a9a",fontFamily:"'Oswald',sans-serif",
                  letterSpacing:".08em",cursor:"pointer"}}>
                CHOOSE ANOTHER WRESTLER
              </button>
            </div>
          </div>
        </div>
      )}
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
      {draftComplete&&(
        <div style={{background:"#0a1e0d",borderBottom:"2px solid #34d399",padding:"10px 20px",
          textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          <span style={{color:"#34d399",fontWeight:700,fontFamily:"'Oswald',sans-serif",
            fontSize:14,letterSpacing:".12em"}}>
            🏆 DRAFT COMPLETE — ALL ROSTERS ARE LOCKED
          </span>
        </div>
      )}
      <Header onClock={onClock} totalPicks={totalPicks} round={round} pos={pos}
        teams={teams} draftOrder={draftOrder} rotationType={rotationType}
        searchQ={searchQ} setSearchQ={setSearchQ} searchResults={searchResults}
        picks={picks} getColor={getColor} draftPick={draftPick} draftCustom={draftCustom}
        activePage={activePage} setActivePage={setActivePage} getRoster={getRoster}
        timerSec={timerSec} timerPaused={timerPaused} pauseTimer={pauseTimer} resumeTimer={resumeTimer}
        isCommissioner={isCommissioner} canPickNow={userCanPickNow(onClock)} draftStarted={true}
        draftComplete={draftComplete}
        getRosterStatus={getRosterStatus} picksPerTeam={picksPerTeam} showToast={showToast}
        chimeEnabled={chimeEnabled} setChimeEnabled={setChimeEnabled}/>

      <div style={{maxWidth:1600,margin:"0 auto",padding:"16px 16px 40px"}}>
        {activePage==="board"&&<BoardPage wrestlers={wrestlers} picks={picks} points={points}
          draftPick={draftPick} hlKey={hlKey} teams={teams}
          getColor={getColor} availCount={availCount} reassignPick={reassignPick}
          draftOrder={draftOrder} rotationType={rotationType} totalPicks={totalPicks}
          isCommissioner={isCommissioner} canPickNow={userCanPickNow(onClock)}
          picksLog={picksLog} draftComplete={draftComplete}
          controlledTeamNames={isCommissioner?teams:(teamsProp||[]).filter(t=>session?.teamIds?.includes(t.id)).map(t=>t.name)}/>}
        {activePage==="standings"&&<StandingsPage teamScores={teamScores} getColor={getColor} getRoster={getRoster} isCommissioner={isCommissioner} leagueId={leagueId}/>}

        {activePage==="settings"&&<SettingsPage
          teams={teams} setTeams={setTeams}
          draftOrder={draftOrder} setDraftOrder={setDraftOrder}
          rotationType={rotationType} setRotationType={setRotationType}
          bonusPickEnabled={bonusPickEnabled} setBonusPickEnabled={setBonusPickEnabled}
          picks={picks} setPicks={setPicks} setPoints={setPoints}
          setBonusKeys={setBonusKeys} resetTimer={resetTimer}
          teamsProp={teamsProp}
          getRoster={getRoster} getColor={getColor} showToast={showToast}
          picksPerTeam={picksPerTeam} wrestlers={wrestlers}
          leagueId={leagueId}
          draftHasStarted={draftHasStarted}
          setDraftHasStarted={setDraftHasStarted}
          setActivePage={setActivePage}
          isCommissioner={isCommissioner}
          draftComplete={draftComplete}
          hasRecoveryEmail={!!commissionerEmail}
          commissionerEmail={commissionerEmail}
          session={session}/>}
        {teams.includes(activePage)&&<RosterPage team={activePage} roster={getRoster(activePage)}
          getColor={getColor} picksPerTeam={picksPerTeam}
          allWrestlers={allWrestlers} picks={picks} setPicks={setPicks} wrestlers={wrestlers}
          bonusKeys={bonusKeys} setBonusKeys={setBonusKeys}
          bonusPickEnabled={bonusPickEnabled} showToast={showToast}
          isCommissioner={isCommissioner}/>}
      </div>
    </div>
  );
}

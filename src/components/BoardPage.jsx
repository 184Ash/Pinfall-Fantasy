import { useState, useMemo } from 'react';
import { WEIGHT_CLASSES, DEFAULT_WC_PAGES, DEFAULT_WC_HIDDEN, PAGE_SIZE } from '../constants';
import { pickKey } from '../utils/scoreParser';

// ─── BOARD PAGE ───────────────────────────────────────────────────────────────
export default function BoardPage({wrestlers,picks,points,draftPick,hlKey,getColor,
  availCount,reassignPick,teams,draftOrder,rotationType,totalPicks,isCommissioner,canPickNow,picksLog,
  draftComplete,controlledTeamNames}){
  // ── Declared at top before any hooks to avoid Vite production TDZ ──
  const _n=draftOrder.length;
  const _round=_n>0?Math.floor(totalPicks/_n):0;
  const _pos=_n>0?totalPicks%_n:0;

  const [overrideKey,setOverrideKey]=useState(null);

  // ── Compute onClock inside BoardPage for per-team config switching ──
  const onClock=useMemo(()=>{
    if(!_n) return "";
    if(rotationType==="snake") return _round%2===0?draftOrder[_pos]:draftOrder[_n-1-_pos];
    return draftOrder[_pos];
  },[draftOrder,rotationType,_round,_pos,_n]);

  // ── Per-team config switching (multi-team devices + solo commissioners) ──
  const isMultiTeamDevice=(controlledTeamNames||[]).length>1;

  // Global state used for single-team devices
  const [globalPages,setGlobalPages]=useState(()=>({...DEFAULT_WC_PAGES}));
  const [globalHidden,setGlobalHidden]=useState(()=>({...DEFAULT_WC_HIDDEN}));
  // Per-team configs: { teamName: { pages: {w:num}, hidden: {w:bool} } }
  const [teamConfigs,setTeamConfigs]=useState({});

  // ── "Next controlled team": look ahead to find the next team this device controls.
  //    Config and glow always reflect the team preparing to pick, not the current onClock.
  const nextControlledTeam=useMemo(()=>{
    const ctn=controlledTeamNames||[];
    if(ctn.length===0) return "";
    if(ctn.length===1) return ctn[0];
    if(!_n) return ctn[0];
    for(let offset=0;offset<_n*2+1;offset++){
      const t=totalPicks+offset;
      const r=Math.floor(t/_n);const p=t%_n;
      let team;
      if(rotationType==="snake") team=r%2===0?draftOrder[p]:draftOrder[_n-1-p];
      else team=draftOrder[p];
      if(ctn.includes(team)) return team;
    }
    return ctn[0];
  },[draftOrder,rotationType,totalPicks,controlledTeamNames,_n]);

  // Derived view state — switches to the next controlled team's saved config
  const pages=isMultiTeamDevice?(teamConfigs[nextControlledTeam]?.pages||DEFAULT_WC_PAGES):globalPages;
  const hidden=isMultiTeamDevice?(teamConfigs[nextControlledTeam]?.hidden||DEFAULT_WC_HIDDEN):globalHidden;

  // Glow color — derived from next controlled team; null for sessionless viewers
  const glowColor=(controlledTeamNames||[]).length>0&&nextControlledTeam
    ?getColor(nextControlledTeam):null;

  const setPage=(w,p)=>{
    if(isMultiTeamDevice&&nextControlledTeam){
      setTeamConfigs(tc=>({...tc,[nextControlledTeam]:{...(tc[nextControlledTeam]||{}),
        pages:{...(tc[nextControlledTeam]?.pages||DEFAULT_WC_PAGES),[w]:p}}}));
    } else {
      setGlobalPages(prev=>({...prev,[w]:p}));
    }
  };
  const toggleHidden=(w)=>{
    if(isMultiTeamDevice&&nextControlledTeam){
      setTeamConfigs(tc=>{
        const cur=tc[nextControlledTeam]?.hidden||DEFAULT_WC_HIDDEN;
        return {...tc,[nextControlledTeam]:{...(tc[nextControlledTeam]||{}),hidden:{...cur,[w]:!cur[w]}}};
      });
    } else {
      setGlobalHidden(prev=>({...prev,[w]:!prev[w]}));
    }
  };

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

      {/* ── Live draft queue — hidden when draft is complete ── */}
      {!draftComplete&&<div className="card" style={{marginBottom:14}}>
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
      </div>}

      {/* ── Recent Picks Log ── */}
      {picksLog&&picksLog.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div style={{padding:"6px 14px 5px",borderBottom:"1px solid #1a1f26",background:"#0d1219",
            display:"flex",alignItems:"center",gap:10,borderRadius:"8px 8px 0 0"}}>
            <span style={{fontSize:10,letterSpacing:".18em",color:"#6a5a30",
              fontFamily:"'Oswald',sans-serif"}}>RECENT PICKS</span>
            <span style={{fontSize:10,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif"}}>
              {picksLog.length} pick{picksLog.length!==1?"s":""}
            </span>
          </div>
          <div style={{maxHeight:160,overflowY:"auto",
            scrollbarWidth:"thin",scrollbarColor:"#c9a84c44 #0a0f16"}}>
            {[...picksLog].reverse().map((p,i)=>{
              const c=getColor(p.teamName);
              const pickNum=picksLog.length-i;
              const isFirst=i===0;
              return (
                <div key={p.key} style={{
                  display:"flex",alignItems:"center",gap:8,
                  padding:"5px 12px",
                  background:isFirst?`${c.bg}18`:"transparent",
                  borderBottom:i<picksLog.length-1?"1px solid #0f1318":"none",
                  transition:"background .15s"}}>
                  <span style={{fontSize:9,color:"#3a3820",fontFamily:"'Barlow Condensed',sans-serif",
                    minWidth:22,textAlign:"right",flexShrink:0}}>#{pickNum}</span>
                  <span style={{width:8,height:8,borderRadius:"50%",flexShrink:0,
                    background:c.bg,boxShadow:`0 0 6px ${c.bg}88`}}/>
                  <span style={{fontSize:11,fontWeight:600,color:c.text,
                    fontFamily:"'Barlow Condensed',sans-serif",
                    minWidth:90,flexShrink:0,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.teamName}</span>
                  <span style={{fontSize:12,fontWeight:600,color:isFirst?"#e0d8b4":"#c0b898",
                    fontFamily:"'Barlow Condensed',sans-serif",flex:1,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                  <span style={{fontSize:10,color:"#4a4020",fontFamily:"'Barlow Condensed',sans-serif",
                    flexShrink:0,whiteSpace:"nowrap"}}>
                    {p.weight>0?`${p.weight}lb`:"Custom"} · #{p.seed}
                  </span>
                  {p.isBonus&&<span style={{fontSize:10,flexShrink:0}}>⭐</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weight columns */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,borderRadius:8,
        transition:'box-shadow 0.9s ease',
        boxShadow:glowColor
          ?`0 0 0 1px ${glowColor.bg}28, 0 0 28px 5px ${glowColor.bg}18, 0 0 75px 18px ${glowColor.bg}0e, 0 0 160px 55px ${glowColor.bg}08`
          :'none'}}>
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
            {!hidden[w]&&pageWrs.map((wr,i)=>{
              const key=pickKey(w,wr.seed);
              const tb=picks[key];
              const tc=tb?getColor(tb):null;
              const isHl=hlKey===key;
              const pts=points[key]||0;
              return (
                <div key={wr.seed}
                  className={`wrow ${isHl?"flash-row":""}`}
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
                    <button onClick={()=>isCommissioner&&setOverrideKey(key)}
                      title={isCommissioner?"Click to reassign to a different team":undefined}
                      style={{display:"flex",alignItems:"center",gap:3,padding:"2px 6px",flexShrink:0,
                        background:tc.bg+"33",border:`1px solid ${tc.bg}66`,borderRadius:4,
                        cursor:isCommissioner?"pointer":"default",transition:"background .15s"}}
                      onMouseEnter={e=>isCommissioner&&(e.currentTarget.style.background=tc.bg+"55")}
                      onMouseLeave={e=>isCommissioner&&(e.currentTarget.style.background=tc.bg+"33")}>
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
                      {isCommissioner&&<span style={{fontSize:8,color:tc.text+"cc"}}>▾</span>}
                    </button>
                  ):(
                    (isCommissioner||canPickNow)&&<button className="btn btn-sm" onClick={()=>draftPick(w,wr.seed)}
                      style={{padding:"2px 7px",background:"#0c1e14",border:"1px solid #1a3824",
                        borderRadius:4,color:"#2a6a44",fontSize:9,fontFamily:"'Oswald',sans-serif",
                        fontWeight:600,letterSpacing:".07em",flexShrink:0}}>DRAFT</button>
                  )}
                </div>
              );
            })}
            {/* Weight class footer — pagination + hide toggle (always visible) */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"5px 8px",borderTop:"1px solid #0f1318",background:"#080c10"}}>
              {totalPages>1
                ?<button onClick={()=>setPage(w,pg-1)} disabled={pg===0}
                  style={{width:26,height:26,borderRadius:4,border:"1px solid #1e2530",
                    background:pg===0?"transparent":"#0d1520",color:pg===0?"#1e2530":"#c9a84c",
                    cursor:pg===0?"default":"pointer",fontSize:13,display:"flex",
                    alignItems:"center",justifyContent:"center",flexShrink:0}}>‹</button>
                :<div style={{width:26}}/>
              }
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                {totalPages>1&&Array.from({length:totalPages}).map((_,pi)=>(
                  <button key={pi} onClick={()=>setPage(w,pi)}
                    style={{width:pi===pg?20:8,height:8,borderRadius:4,border:"none",
                      background:pi===pg?"#c9a84c":"#1e2530",cursor:"pointer",
                      transition:"all .2s",padding:0,flexShrink:0}}/>
                ))}
                <button onClick={()=>toggleHidden(w)}
                  title={hidden[w]?"Show wrestlers":"Hide wrestlers"}
                  style={{width:22,height:22,borderRadius:3,
                    border:`1px solid ${hidden[w]?"#2a3a50":"#3a4830"}`,
                    background:"transparent",
                    color:hidden[w]?"#3a4a5a":"#7a9860",
                    cursor:"pointer",fontSize:10,display:"flex",
                    alignItems:"center",justifyContent:"center",
                    flexShrink:0,padding:0,transition:"color .15s,border-color .15s"}}>
                  {hidden[w]?"▸":"▾"}
                </button>
              </div>
              {totalPages>1
                ?<button onClick={()=>setPage(w,pg+1)} disabled={pg===totalPages-1}
                  style={{width:26,height:26,borderRadius:4,border:"1px solid #1e2530",
                    background:pg===totalPages-1?"transparent":"#0d1520",
                    color:pg===totalPages-1?"#1e2530":"#c9a84c",
                    cursor:pg===totalPages-1?"default":"pointer",fontSize:13,display:"flex",
                    alignItems:"center",justifyContent:"center",flexShrink:0}}>›</button>
                :<div style={{width:26}}/>
              }
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}




import { useState, useMemo } from 'react';
import { WEIGHT_CLASSES } from '../constants';
import { pickKey } from '../utils/scoreParser';
import { useIsMobile } from '../hooks/useIsMobile';

// ─── ROSTER PAGE ──────────────────────────────────────────────────────────────
export default function RosterPage({team,roster,getColor,picksPerTeam,allWrestlers,picks,setPicks,
  wrestlers,bonusKeys,setBonusKeys,bonusPickEnabled,showToast,isCommissioner}){
  const isMobile = useIsMobile();
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

  const statusColor=(s)=>{
    if(!s) return '#3a3820';
    if(s==='Eliminated') return '#f87171';
    if(s==='Champion'||s.includes('Place')) return '#c9a84c';
    if(s.includes('Champ')||s==='Finals') return '#60a5fa';
    if(s.includes('Cons')||s==='3rd Place') return '#fbbf24';
    return '#6a8a6a';
  };

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
            {wr.status&&(
              <div style={{fontSize:9,color:statusColor(wr.status),fontFamily:"'Barlow Condensed',sans-serif",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600}}>
                {wr.status}
              </div>
            )}
          </div>
          {wr.pts>0&&!isH&&(
            <span style={{fontSize:11,fontWeight:700,color:"#34d399",flexShrink:0}}>{wr.pts}pt</span>
          )}
          {isH&&isCommissioner&&(
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
        borderRadius:12,display:"flex",alignItems:isMobile?"flex-start":"center",
        flexDirection:isMobile?"column":"row",gap:isMobile?10:16,flexWrap:"wrap"}}>
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
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(5,1fr)",gap:10,marginBottom:12}}>
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
                  {isH&&isCommissioner&&(
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
                  {isH&&isCommissioner&&(
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


import { useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { saveSettings, requestRejoin, requestLateJoin, listenForRejoinApproval, clearLeagueData, resetDraft } from '../leagueService';
import CommissionerOnly from './CommissionerOnly';
import { DEFAULT_TEAMS } from '../constants';

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
export default function SettingsPage({teams,setTeams,draftOrder,setDraftOrder,rotationType,setRotationType,
  bonusPickEnabled,setBonusPickEnabled,picks,setPicks,setPoints,setBonusKeys,resetTimer,
  teamsProp,getRoster,getColor,showToast,picksPerTeam,wrestlers,leagueId,
  draftHasStarted,setDraftHasStarted,setActivePage,
  isCommissioner,draftComplete,hasRecoveryEmail,commissionerEmail,session}){

  const [starting,setStarting]=useState(false);

  // ── Commissioner recovery state ──
  const [showRecovery,setShowRecovery]=useState(false);
  const [recoveryEmail,setRecoveryEmail]=useState("");
  const [recoverySent,setRecoverySent]=useState(false);
  const [recoverySending,setRecoverySending]=useState(false);

  // ── Join Draft state (no-session members) ──
  const [showJoin,setShowJoin]=useState(false);
  const [rejoinTeamId,setRejoinTeamId]=useState("");
  const [rejoinSent,setRejoinSent]=useState(false);
  const [lateJoinNames,setLateJoinNames]=useState({});
  const [lateJoinSent,setLateJoinSent]=useState({});

  const handleRecoveryLink=async()=>{
    if(!recoveryEmail.trim()) return;
    setRecoverySending(true);
    await supabase.auth.signInWithOtp({
      email:recoveryEmail.trim(),
      options:{emailRedirectTo:`${window.location.origin}/auth/callback?league=${leagueId}`},
    });
    setRecoverySent(true);
    setRecoverySending(false);
  };

  const handleRejoin=async()=>{
    if(!rejoinTeamId) return;
    const requestId=await requestRejoin(leagueId,rejoinTeamId);
    listenForRejoinApproval(requestId,leagueId,rejoinTeamId,'member',()=>{window.location.reload();});
    setRejoinSent(true);
  };

  const handleLateJoin=async(team)=>{
    const name=(lateJoinNames[team.id]||'').trim();
    if(!name) return;
    const requestId=await requestLateJoin(leagueId,team.id,name);
    listenForRejoinApproval(requestId,leagueId,team.id,'member',()=>{window.location.reload();});
    setLateJoinSent(prev=>({...prev,[team.id]:true}));
  };

  const claimedTeams=(teamsProp||[]).filter(t=>t.is_claimed);
  const unclaimedTeams=(teamsProp||[]).filter(t=>!t.is_claimed);
  const showJoinSection=!session&&!isCommissioner&&leagueId&&teamsProp&&teamsProp.length>0;
  const [dragIdx,setDragIdx]=useState(null);
  const [dragOverIdx,setDragOverIdx]=useState(null);

  // Preview next 8 picks
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

  const handleRandomize=()=>{
    const shuffled=[...draftOrder];
    for(let i=shuffled.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
    }
    setDraftOrder(shuffled);
    showToast("Draft order randomized!","ok");
  };

  const handleDragStart=(i)=>setDragIdx(i);
  const handleDragOver=(e,i)=>{e.preventDefault();setDragOverIdx(i);};
  const handleDrop=(i)=>{
    if(dragIdx===null||dragIdx===i) return;
    const next=[...draftOrder];
    const [moved]=next.splice(dragIdx,1);
    next.splice(i,0,moved);
    setDraftOrder(next);
    setDragIdx(null);setDragOverIdx(null);
  };

  const handleStartDraft=async()=>{
    if(!isCommissioner) return;
    setStarting(true);
    try{
      // Save final draft order to Supabase then flip draftStarted
      if(leagueId){
        const orderPositions=draftOrder.map((name,i)=>{
          const team=teamsProp?.find(t=>t.name===name);
          return team?.draft_position||i+1;
        });
        await saveSettings(leagueId,{draftStarted:true,draftOrder:orderPositions});
      }
      setDraftHasStarted(true);
      setActivePage("board");
      resetTimer();
    }catch(err){
      showToast("Failed to start draft — try again","err");
      setStarting(false);
    }
  };

  return (
    <div style={{maxWidth:860}}>
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:20,fontWeight:700,letterSpacing:".1em",color:"#c9a84c"}}>DRAFT SETTINGS</h2>
        <p style={{color:"#4a4020",fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>
          {draftHasStarted?"League configuration — reference only while draft is live":"Configure your league before starting the draft"}
        </p>
      </div>

      {/* ── Status banner ── */}
      {draftHasStarted?(
        <div className="card" style={{padding:14,marginBottom:14,border:"1px solid #14532d",background:"#050e08",display:"flex",alignItems:"center",gap:12}}>
          <div className="pulse" style={{width:9,height:9,borderRadius:"50%",background:"#34d399",boxShadow:"0 0 8px #34d39977",flexShrink:0}}/>
          <div>
            <div style={{fontSize:12,color:"#34d399",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".15em",fontWeight:700}}>✓ DRAFT IS LIVE</div>
            <div style={{fontSize:10,color:"#1a4a28",fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>Settings locked. Shown here for reference only.</div>
          </div>
        </div>
      ):(
        <div className="card" style={{padding:14,marginBottom:14,border:"1px solid #c9a84c44",background:"#0d1008",display:"flex",alignItems:"center",gap:12}}>
          <div className="pulse" style={{width:9,height:9,borderRadius:"50%",background:"#c9a84c",boxShadow:"0 0 8px #c9a84c77",flexShrink:0}}/>
          <div>
            <div style={{fontSize:12,color:"#c9a84c",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".15em",fontWeight:700}}>DRAFT NOT STARTED</div>
            <div style={{fontSize:10,color:"#6a5a30",fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>Customize the draft order below, then click Start Draft when ready.</div>
          </div>
        </div>
      )}

      {/* ── Rotation type (read-only) ── */}
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div className="sec-label" style={{marginBottom:12}}>PICK ROTATION</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {[
            {id:"snake",icon:"🐍",label:"Snake Draft",desc:"Rd 1: 1→10, Rd 2: 10→1, alternates each round"},
            {id:"linear",icon:"→",label:"Linear Draft",desc:"Same order every round (1→10 always)"},
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
                ?`Enabled — each team gets one extra pick at any weight class (${picksPerTeam} total picks per team).`
                :`Disabled — strict 10-wrestler-per-team format (${picksPerTeam} picks per team).`}
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

      {/* ── Draft order — editable pre-start, read-only post-start ── */}
      <div className="card" style={{padding:16,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <div className="sec-label">DRAFT ORDER ({draftOrder.length} teams)</div>
          {!draftHasStarted&&isCommissioner&&(
            <button
              onClick={handleRandomize}
              style={{padding:"5px 14px",background:"#0d1520",border:"1px solid #c9a84c44",
                borderRadius:5,color:"#c9a84c",fontSize:11,fontFamily:"'Oswald',sans-serif",
                fontWeight:600,letterSpacing:".1em",cursor:"pointer"}}>
              🎲 RANDOMIZE
            </button>
          )}
        </div>
        {!draftHasStarted&&isCommissioner&&(
          <div style={{fontSize:11,color:"#4a4030",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:10,lineHeight:1.5}}>
            Drag teams to reorder, or click Randomize for a random draft order.
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {draftOrder.map((t,i)=>{
            const c=getColor(t);const r=getRoster(t).length;
            const isDragging=dragIdx===i;
            const isDragOver=dragOverIdx===i;
            return (
              <div key={t}
                draggable={!draftHasStarted&&isCommissioner}
                onDragStart={()=>handleDragStart(i)}
                onDragOver={(e)=>handleDragOver(e,i)}
                onDrop={()=>handleDrop(i)}
                onDragEnd={()=>{setDragIdx(null);setDragOverIdx(null);}}
                style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                  background:isDragOver?"#1a2535":"#070a0e",
                  border:`1px solid ${isDragOver?"#c9a84c":c.bg+"33"}`,
                  borderLeft:`4px solid ${c.bg}`,borderRadius:6,
                  opacity:isDragging?0.4:1,
                  cursor:!draftHasStarted&&isCommissioner?"grab":"default",
                  transition:"background .1s,border .1s"}}>
                {!draftHasStarted&&isCommissioner&&(
                  <span style={{fontSize:12,color:"#3a4050",marginRight:2}}>⠿</span>
                )}
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

      {/* ── Start Draft / Danger Zone ── */}
      <CommissionerOnly isCommissioner={isCommissioner} label="Commissioner only">
        {!draftHasStarted?(
          <div className="card" style={{padding:20,border:"1px solid #c9a84c44",width:"100%",background:"#0d1008"}}>
            <div style={{fontSize:11,color:"#6a5a30",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".12em",marginBottom:8,textAlign:"center"}}>
              WHEN YOU'RE READY — ALL PARTICIPANTS WILL BE MOVED TO THE DRAFT BOARD
            </div>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleStartDraft}
              disabled={starting}
              style={{width:"100%",padding:"16px",fontSize:16,fontWeight:700,
                letterSpacing:".1em",opacity:starting?0.6:1}}>
              {starting?"STARTING...":"🏁 START DRAFT"}
            </button>
          </div>
        ):!draftComplete?(
          <div className="card" style={{padding:16,border:"1px solid #3a1515",width:"100%"}}>
            <div className="sec-label" style={{color:"#7a2020",marginBottom:10}}>DANGER ZONE</div>
            <button className="btn btn-danger btn-md" onClick={async()=>{
              if(window.confirm("Clear all picks and scores? Everyone will be brought back to settings.")){
                setPicks({});
                setPoints({});
                setBonusKeys([]);
                resetTimer();
                const originalOrder=teamsProp&&teamsProp.length>0
                  ?[...teamsProp].sort((a,b)=>a.draft_position-b.draft_position).map(t=>t.name)
                  :DEFAULT_TEAMS;
                setDraftOrder(originalOrder);
                setDraftHasStarted(false);
                if(leagueId){
                  try{
                    await clearLeagueData(leagueId);
                    await resetDraft(leagueId);
                  }catch(err){console.error('reset failed:',err);}
                }
                showToast("Cleared — back to pre-draft settings","info");
              }
            }}>CLEAR ALL PICKS & SCORES</button>
          </div>
        ):null}
      </CommissionerOnly>

      {/* ── Join Draft (no session, non-commissioner) ── */}
      {showJoinSection&&(
        <div className="card" style={{padding:16,border:"1px solid #2A3A50",width:"100%",marginTop:12}}>
          <div className="sec-label" style={{marginBottom:10}}>JOIN DRAFT</div>
          {!showJoin?(
            <button className="btn btn-secondary btn-md" style={{width:"100%"}} onClick={()=>setShowJoin(true)}>
              🏷️ JOIN DRAFT
            </button>
          ):(
            <div>
              {/* Rejoin — reclaim a previously held team */}
              {claimedTeams.length>0&&(
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#E8EDF2",marginBottom:4}}>Already have a team?</div>
                  <div style={{fontSize:12,color:"#7A8A9A",marginBottom:12,lineHeight:"1.5"}}>
                    Select your team and request to rejoin — the commissioner will approve your access.
                  </div>
                  {!rejoinSent?(
                    <>
                      <select
                        value={rejoinTeamId}
                        onChange={e=>setRejoinTeamId(e.target.value)}
                        style={{width:"100%",background:"#0D1520",border:"1px solid #2A3A50",
                          borderRadius:6,color:"#E8EDF2",fontSize:14,padding:"10px 12px",
                          marginBottom:10,outline:"none",boxSizing:"border-box"}}
                      >
                        <option value="">Select your team...</option>
                        {claimedTeams.map(t=>(
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button
                        className="btn btn-secondary btn-md"
                        style={{width:"100%",opacity:rejoinTeamId?1:0.4}}
                        disabled={!rejoinTeamId}
                        onClick={handleRejoin}
                      >Request to Rejoin</button>
                    </>
                  ):(
                    <div style={{background:"#1A3A2A",border:"1px solid #2A6A3A",borderRadius:6,
                      color:"#4CAF7D",fontSize:13,padding:"12px 14px",lineHeight:"1.5"}}>
                      ✓ Request sent — keep this window open. You'll be redirected when the commissioner approves.
                    </div>
                  )}
                </div>
              )}

              {/* Late join — claim an unclaimed team */}
              {unclaimedTeams.length>0&&(
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:"#E8EDF2",marginBottom:4}}>Claim an open team</div>
                  <div style={{fontSize:12,color:"#7A8A9A",marginBottom:12,lineHeight:"1.5"}}>
                    Pick an unclaimed team, enter your name, and submit — the commissioner will approve your access.
                  </div>
                  {unclaimedTeams.map(team=>(
                    <div key={team.id} style={{background:"#0D1520",border:"1px solid #2A3A50",
                      borderRadius:8,padding:"12px 14px",marginBottom:10}}>
                      <div style={{fontSize:11,color:"#C9A84C",letterSpacing:"1px",
                        textTransform:"uppercase",fontWeight:700,marginBottom:8}}>
                        {team.name}
                      </div>
                      {lateJoinSent[team.id]?(
                        <div style={{background:"#1A3A2A",border:"1px solid #2A6A3A",borderRadius:6,
                          color:"#4CAF7D",fontSize:13,padding:"10px 12px",lineHeight:"1.5"}}>
                          ✓ Request sent — keep this window open. You'll be redirected when approved.
                        </div>
                      ):(
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <input
                            style={{flex:1,background:"#1A2535",border:"1px solid #2A3A50",borderRadius:6,
                              color:"#E8EDF2",fontSize:14,padding:"9px 12px",outline:"none",boxSizing:"border-box"}}
                            type="text"
                            placeholder="Your name..."
                            maxLength={40}
                            value={lateJoinNames[team.id]||''}
                            onChange={e=>setLateJoinNames(prev=>({...prev,[team.id]:e.target.value}))}
                          />
                          <button
                            className="btn btn-secondary btn-md"
                            style={{whiteSpace:"nowrap",flexShrink:0,
                              opacity:(lateJoinNames[team.id]||'').trim()?1:0.4}}
                            disabled={!(lateJoinNames[team.id]||'').trim()}
                            onClick={()=>handleLateJoin(team)}
                          >Request to Join</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                style={{background:"none",border:"none",color:"#4A5A6A",fontSize:12,
                  cursor:"pointer",textDecoration:"underline",marginTop:8,display:"block"}}
                onClick={()=>{setShowJoin(false);setRejoinTeamId("");setRejoinSent(false);}}
              >← Back</button>
            </div>
          )}
        </div>
      )}

      {/* ── Recover Commissioner Access (draft complete, visible to all) ── */}
      {draftComplete&&hasRecoveryEmail&&(
        <div className="card" style={{padding:16,border:"1px solid #2A3A50",width:"100%",marginTop:12}}>
          <div className="sec-label" style={{marginBottom:10}}>COMMISSIONER ACCESS</div>
          {!showRecovery?(
            <button
              className="btn btn-secondary btn-md"
              style={{width:"100%"}}
              onClick={()=>setShowRecovery(true)}>
              🔑 RECOVER COMMISSIONER ACCESS
            </button>
          ):(
            <div>
              <div style={{fontSize:12,color:"#7A8A9A",marginBottom:12,lineHeight:"1.5"}}>
                Enter your recovery email to receive a magic link that restores your commissioner session. Open the link on the device you want to use.
              </div>
              {recoverySent?(
                <div style={{background:"#1A3A2A",border:"1px solid #2A6A3A",borderRadius:6,
                  color:"#4CAF7D",fontSize:13,padding:"12px 14px",lineHeight:"1.5"}}>
                  ✓ Check your email for the magic link. Open it on the device you want to use as commissioner.
                </div>
              ):(
                <>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={recoveryEmail}
                    onChange={e=>setRecoveryEmail(e.target.value)}
                    style={{width:"100%",background:"#0D1520",border:"1px solid #2A3A50",
                      borderRadius:6,color:"#E8EDF2",fontSize:15,padding:"11px 14px",
                      outline:"none",boxSizing:"border-box",marginBottom:10}}
                  />
                  <div style={{display:"flex",gap:8}}>
                    <button
                      className="btn btn-secondary btn-md"
                      style={{flex:1}}
                      onClick={()=>{setShowRecovery(false);setRecoveryEmail("");}}
                    >Cancel</button>
                    <button
                      className="btn btn-primary btn-md"
                      style={{flex:2,opacity:(!recoveryEmail.trim()||recoverySending)?0.5:1}}
                      disabled={!recoveryEmail.trim()||recoverySending}
                      onClick={handleRecoveryLink}
                    >{recoverySending?"Sending...":"Send Recovery Link"}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


import { useState, useMemo } from 'react';
import { WEIGHT_CLASSES } from '../constants';
import { pickKey, buildNameIndex, parseScoreText, matchScoresToRoster } from '../utils/scoreParser';
import { savePoints } from '../leagueService';

// ─── SCORES PAGE ──────────────────────────────────────────────────────────────
export default function ScoresPage({wrestlers,picks,points,setPoints,getColor,allWrestlers,leagueId,isCommissioner}){
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

      {!isCommissioner&&(
        <div style={{padding:"10px 14px",marginBottom:12,background:"#0d1219",border:"1px solid #1e2530",borderRadius:7,fontSize:11,color:"#4a5a6a",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".08em"}}>
          🔒 COMMISSIONER ONLY — Score import and manual entry are restricted to the commissioner.
        </div>
      )}

      {/* ── OPTION 1: BULK IMPORT — gold border (commissioner only) ── */}
      {isCommissioner&&<div style={{border:"2px solid #c9a84c44",borderRadius:10,background:"#0b0f14",marginBottom:14,overflow:"hidden"}}>
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
      </div>}

      {/* ── OPTION 2: MANUAL ENTRY — blue border (commissioner only) ── */}
      {isCommissioner&&<div style={{border:"2px solid #1e3a5f",borderRadius:10,background:"#0a0f18",marginBottom:20,overflow:"hidden"}}>
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
      </div>}

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


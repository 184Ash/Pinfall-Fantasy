import { useState } from 'react';

// ─── STANDINGS PAGE ───────────────────────────────────────────────────────────
// ─── STANDINGS PAGE ───────────────────────────────────────────────────────────
export default function StandingsPage({teamScores,getColor,getRoster}){
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

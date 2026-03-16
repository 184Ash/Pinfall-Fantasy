import { useState } from 'react';

// ─── DATA PAGE ────────────────────────────────────────────────────────────────
export default function SetupPage({teams,setTeams,picks,setPicks,setPoints,getRoster,getColor,draftTeam,setDraftTeam,showToast}){
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

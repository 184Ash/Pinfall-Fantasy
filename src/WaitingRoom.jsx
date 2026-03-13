// src/WaitingRoom.jsx — placeholder until Section 3
export default function WaitingRoom({ leagueName }) {
  return (
    <div style={{ minHeight:"100vh", background:"#0D1520", color:"#E8EDF2",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"Arial, sans-serif", fontSize:"18px" }}>
      ⏳ Waiting for {leagueName} to start...
    </div>
  )
}
// src/pickem/PoolPage.jsx — route wrapper for /pickem/:joinCode
// Loads the pool, runs the frictionless join flow (enter a name → you're in,
// same no-accounts model as the draft product), then renders PickemApp.
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchPool, joinPool } from "./pickemService";
import { getPickemSession, savePickemSession } from "./pickemSession";
import PickemApp from "./PickemApp";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#070a0e;}
.pk-inp{background:#070a0e;border:1px solid #1e2530;border-radius:6px;color:#d0c8b4;
  font-family:'Barlow Condensed',sans-serif;font-size:15px;padding:10px 13px;width:100%;}
.pk-inp:focus{outline:none;border-color:#c9a84c;box-shadow:0 0 0 2px #c9a84c22;}
.pk-btn{cursor:pointer;border:none;transition:all .13s;font-family:'Oswald',sans-serif;}
.pk-btn:hover{filter:brightness(1.15);}
.pk-member-row:hover{border-color:#c9a84c66 !important;background:#c9a84c0a !important;}
`;

const page = {
  minHeight: "100vh", background: "#070a0e", color: "#d0c8b4",
  fontFamily: "'Oswald',sans-serif", display: "flex",
  alignItems: "center", justifyContent: "center", padding: "40px 20px",
};

export default function PoolPage() {
  const { joinCode } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState(null);       // { poolName, season, settings, members }
  const [session, setSession] = useState(() => getPickemSession(joinCode));
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [showRejoin, setShowRejoin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPool(joinCode).then(data => {
      if (!cancelled) { setPool(data); setLoading(false); }
    }).catch(() => {
      if (!cancelled) { setPool(null); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [joinCode]);

  const handleJoin = async () => {
    if (!joinName.trim()) { setError("Enter your name to join."); return; }
    setJoining(true);
    setError(null);
    try {
      const { memberId, role } = await joinPool(joinCode, joinName.trim());
      setSession({ poolId: joinCode, memberId, role });
    } catch (err) {
      setError(err.message || "Could not join — try again.");
    } finally {
      setJoining(false);
    }
  };

  // Trust-based rejoin for members who lost their device session (private-group
  // model). Always restores as 'member' — commissioner access only persists via
  // this device's saved session. Hardening item, same as the draft product.
  const handleRejoin = (member) => {
    savePickemSession(joinCode, member.id, "member");
    setSession({ poolId: joinCode, memberId: member.id, role: "member" });
  };

  if (loading) {
    return (
      <div style={page}>
        <style>{css}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ width: 40, height: 40, border: "3px solid #1e2530", borderTop: "3px solid #c9a84c",
            borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          <div style={{ fontSize: 14, letterSpacing: ".15em", color: "#6a5a30" }}>LOADING POOL...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div style={page}>
        <style>{css}</style>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#b04040", marginBottom: 10 }}>Pool not found</div>
          <div style={{ fontSize: 14, color: "#7a8a9a", fontFamily: "'Barlow Condensed',sans-serif",
            lineHeight: 1.7, marginBottom: 20 }}>
            No pick&apos;em pool exists at code <b style={{ color: "#c9a84c" }}>{joinCode}</b>.
            Double-check the link you were sent.
          </div>
          <button className="pk-btn" onClick={() => navigate("/")}
            style={{ background: "#c9a84c", color: "#070a0e", borderRadius: 6,
              padding: "11px 26px", fontSize: 13, fontWeight: 700, letterSpacing: ".08em" }}>
            BACK TO HOME
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={page}>
        <style>{css}</style>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div style={{ fontSize: 11, letterSpacing: ".25em", color: "#6a5a30", marginBottom: 8 }}>
              {pool.season} PICK&apos;EM POOL
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#c9a84c" }}>{pool.poolName}</h1>
            <div style={{ fontSize: 14, color: "#7a8a9a", fontFamily: "'Barlow Condensed',sans-serif", marginTop: 8 }}>
              {pool.members.length} {pool.members.length === 1 ? "member" : "members"} in the pool
            </div>
          </div>

          <div style={{ background: "#0b0f14", border: "1px solid #1a1f26", borderRadius: 12, padding: "26px 24px" }}>
            {!showRejoin ? (
              <>
                <label style={{ display: "block", fontSize: 10, letterSpacing: ".18em", color: "#6a5a30", marginBottom: 6 }}>
                  YOUR NAME
                </label>
                <input className="pk-inp" placeholder="e.g. Katie" value={joinName}
                  onChange={e => setJoinName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                  style={{ marginBottom: 14 }} />
                {error && (
                  <div style={{ background: "#1e0a0a", border: "1px solid #7f1d1d", color: "#fca5a5",
                    borderRadius: 6, padding: "9px 13px", fontSize: 13, marginBottom: 14,
                    fontFamily: "'Barlow Condensed',sans-serif" }}>
                    {error}
                  </div>
                )}
                <button className="pk-btn" disabled={joining} onClick={handleJoin}
                  style={{ width: "100%", padding: "14px", background: "#c9a84c", color: "#070a0e",
                    borderRadius: 6, fontSize: 15, fontWeight: 700, letterSpacing: ".1em",
                    opacity: joining ? 0.6 : 1 }}>
                  {joining ? "JOINING..." : "JOIN THE POOL →"}
                </button>
                {pool.members.length > 0 && (
                  <button className="pk-btn" onClick={() => setShowRejoin(true)}
                    style={{ width: "100%", marginTop: 12, padding: "10px", background: "none",
                      color: "#6a7480", fontSize: 12, letterSpacing: ".1em",
                      border: "1px solid #1e2530", borderRadius: 6 }}>
                    ALREADY JOINED? REJOIN AS YOURSELF
                  </button>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 10, letterSpacing: ".18em", color: "#6a5a30", marginBottom: 10 }}>
                  SELECT YOUR NAME TO REJOIN
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {pool.members.map(m => (
                    <button key={m.id} className="pk-btn pk-member-row" onClick={() => handleRejoin(m)}
                      style={{ background: "#070a0e", border: "1px solid #1e2530", borderRadius: 6,
                        padding: "11px 14px", textAlign: "left", color: "#d0c8b4", fontSize: 14,
                        fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600 }}>
                      {m.name}
                      {m.role === "commissioner" && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: "#6a5a30", letterSpacing: ".14em" }}>
                          COMMISSIONER
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button className="pk-btn" onClick={() => setShowRejoin(false)}
                  style={{ width: "100%", padding: "10px", background: "none", color: "#6a7480",
                    fontSize: 12, letterSpacing: ".1em", border: "1px solid #1e2530", borderRadius: 6 }}>
                  ← BACK — I&apos;M NEW HERE
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <PickemApp
      poolId={joinCode}
      session={session}
      poolName={pool.poolName}
      season={pool.season}
      settings={pool.settings}
      initialMembers={pool.members}
    />
  );
}

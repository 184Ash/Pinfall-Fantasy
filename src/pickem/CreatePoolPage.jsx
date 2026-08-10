// src/pickem/CreatePoolPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPool } from "./pickemService";
import { PICKEM_CREATION_OPEN, PICKEM_SEASON, PICK_MODES, DEFAULT_SCORING } from "./pickemConstants";
import { validatePasscode, generatePasscode } from "./passcode";
import ConferencePicker from "./ConferencePicker";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#070a0e;}
.pk-inp{background:#070a0e;border:1px solid #1e2530;border-radius:6px;color:#d0c8b4;
  font-family:'Barlow Condensed',sans-serif;font-size:15px;padding:10px 13px;width:100%;}
.pk-inp:focus{outline:none;border-color:#c9a84c;box-shadow:0 0 0 2px #c9a84c22;}
.pk-btn{cursor:pointer;border:none;transition:all .13s;font-family:'Oswald',sans-serif;}
.pk-btn:hover{filter:brightness(1.15);}
.pk-mode{cursor:pointer;transition:all .15s;text-align:left;}
`;

const page = {
  minHeight: "100vh", background: "#070a0e", color: "#d0c8b4",
  fontFamily: "'Oswald',sans-serif", display: "flex",
  alignItems: "center", justifyContent: "center", padding: "40px 20px",
};

export default function CreatePoolPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("setup"); // setup | loading | error | done
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { joinCode, joinUrl }
  const [copied, setCopied] = useState(false);

  const [poolName, setPoolName] = useState("");
  const [commissionerName, setCommissionerName] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [defaultPickMode, setDefaultPickMode] = useState("matches");
  const [conferences, setConferences] = useState(["big-ten"]);
  const [teamScope, setTeamScope] = useState({});

  const handleCreate = async () => {
    if (!poolName.trim() || !commissionerName.trim()) {
      setError("Pool name and your name are both required.");
      return;
    }
    const codeCheck = validatePasscode(passcode);
    if (!codeCheck.ok) {
      setError(`Access code: ${codeCheck.reason}`);
      return;
    }
    if (!PICKEM_CREATION_OPEN) { setPhase("closed"); return; }
    setError(null);
    setPhase("loading");
    try {
      const data = await createPool({
        poolName: poolName.trim(),
        commissionerName: commissionerName.trim(),
        recoveryEmail: recoveryEmail.trim() || null,
        passcode: codeCheck.code,
        defaultPickMode,
        conferences,
        teamScope,
      });
      setResult(data);
      setPhase("done");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setPhase("setup");
    }
  };

  if (phase === "loading") {
    return (
      <div style={page}>
        <style>{css}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ width: 40, height: 40, border: "3px solid #1e2530", borderTop: "3px solid #c9a84c",
            borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          <div style={{ fontSize: 14, letterSpacing: ".15em", color: "#6a5a30" }}>CREATING YOUR POOL...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  if (phase === "closed") {
    return (
      <div style={page}>
        <style>{css}</style>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ color: "#c9a84c", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            Pick&apos;em pool creation is currently closed
          </div>
          <div style={{ color: "#7a8a9a", fontSize: 14, lineHeight: 1.7, fontFamily: "'Barlow Condensed',sans-serif" }}>
            Pools for the {PICKEM_SEASON} dual-meet season aren&apos;t open yet. Check back soon.
          </div>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div style={page}>
        <style>{css}</style>
        <div style={{ width: "100%", maxWidth: 520, background: "#0b0f14", border: "1px solid #1a1f26",
          borderRadius: 12, padding: "36px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: ".25em", color: "#6a5a30", marginBottom: 10 }}>
            {PICKEM_SEASON} PICK&apos;EM POOL
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#e0d8b4", marginBottom: 6 }}>
            {poolName} is live! 🎯
          </div>
          <div style={{ fontSize: 14, color: "#7a8a9a", fontFamily: "'Barlow Condensed',sans-serif",
            lineHeight: 1.7, marginBottom: 26 }}>
            Share this link with your group — anyone who opens it can enter a name and start picking.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input className="pk-inp" readOnly value={result.joinUrl} onFocus={e => e.target.select()} />
            <button className="pk-btn" onClick={() => {
              navigator.clipboard?.writeText(result.joinUrl).then(() => {
                setCopied(true); setTimeout(() => setCopied(false), 1800);
              }).catch(() => {});
            }}
              style={{ background: copied ? "#0a1e14" : "#c9a84c", color: copied ? "#34d399" : "#070a0e",
                border: copied ? "1px solid #14532d" : "none",
                borderRadius: 6, padding: "0 18px", fontSize: 13, fontWeight: 700, letterSpacing: ".08em", whiteSpace: "nowrap" }}>
              {copied ? "COPIED ✓" : "COPY"}
            </button>
          </div>
          <div style={{ fontSize: 13, color: "#6a5a30", fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 26 }}>
            Join code: <span style={{ color: "#c9a84c", fontWeight: 700, letterSpacing: ".2em" }}>{result.joinCode}</span>
          </div>
          <button className="pk-btn" onClick={() => navigate(`/pickem/${result.joinCode}`)}
            style={{ width: "100%", padding: "14px", background: "#c9a84c", color: "#070a0e",
              borderRadius: 6, fontSize: 15, fontWeight: 700, letterSpacing: ".1em" }}>
            GO TO MY POOL →
          </button>
        </div>
      </div>
    );
  }

  // ── Setup (default) ────────────────────────────────────────────────
  return (
    <div style={page}>
      <style>{css}</style>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{ fontSize: 11, letterSpacing: ".25em", color: "#6a5a30", marginBottom: 8 }}>
            {PICKEM_SEASON} DUAL MEET SEASON
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: "#c9a84c", letterSpacing: ".04em" }}>
            Create a Pick&apos;em Pool
          </h1>
          <div style={{ fontSize: 15, color: "#7a8a9a", fontFamily: "'Barlow Condensed',sans-serif",
            marginTop: 10, lineHeight: 1.6 }}>
            Each week, everyone in your pool picks winners from the weekend&apos;s dual meets.
            Most points at the end of the season takes the crown.
          </div>
        </div>

        <div style={{ background: "#0b0f14", border: "1px solid #1a1f26", borderRadius: 12, padding: "28px 26px" }}>
          <label style={{ display: "block", fontSize: 10, letterSpacing: ".18em", color: "#6a5a30", marginBottom: 6 }}>
            POOL NAME
          </label>
          <input className="pk-inp" placeholder="e.g. Hawkeye Homies Pick'em"
            value={poolName} onChange={e => setPoolName(e.target.value)} style={{ marginBottom: 18 }} />

          <label style={{ display: "block", fontSize: 10, letterSpacing: ".18em", color: "#6a5a30", marginBottom: 6 }}>
            YOUR NAME (COMMISSIONER)
          </label>
          <input className="pk-inp" placeholder="e.g. Jake" maxLength={60}
            value={commissionerName} onChange={e => setCommissionerName(e.target.value)} style={{ marginBottom: 18 }} />

          <label style={{ display: "block", fontSize: 10, letterSpacing: ".18em", color: "#6a5a30", marginBottom: 6 }}>
            RECOVERY EMAIL <span style={{ color: "#3a4250" }}>(RECOMMENDED — RECEIVES MEMBER ACCESS-CODE BACKUPS)</span>
          </label>
          <input className="pk-inp" placeholder="you@email.com" type="email"
            value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} style={{ marginBottom: 18 }} />

          <label style={{ display: "block", fontSize: 10, letterSpacing: ".18em", color: "#6a5a30", marginBottom: 6 }}>
            YOUR ACCESS CODE
          </label>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input className="pk-inp" placeholder="At least 4 characters"
              value={passcode} onChange={e => setPasscode(e.target.value)} />
            <button className="pk-btn" onClick={() => setPasscode(generatePasscode())}
              style={{ background: "transparent", color: "#c9a84c", border: "1px solid #c9a84c44",
                borderRadius: 6, padding: "0 14px", fontSize: 11, fontWeight: 700,
                letterSpacing: ".08em", whiteSpace: "nowrap" }}>
              GENERATE
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#4a5260", fontFamily: "'Barlow Condensed',sans-serif",
            lineHeight: 1.5, marginBottom: 22 }}>
            You&apos;ll use this to get back into the pool from any device. Don&apos;t reuse a real
            password — access codes are backed up by email for recovery.
            {!recoveryEmail.trim() && (
              <span style={{ color: "#8a7040" }}>
                {" "}Without a recovery email above, no backup copies of anyone&apos;s codes are sent.
              </span>
            )}
          </div>

          <label style={{ display: "block", fontSize: 10, letterSpacing: ".18em", color: "#6a5a30", marginBottom: 8 }}>
            DEFAULT PICK MODE <span style={{ color: "#3a4250" }}>(CHANGEABLE PER WEEK)</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
            {Object.entries(PICK_MODES).map(([mode, info]) => (
              <button key={mode} className="pk-mode" onClick={() => setDefaultPickMode(mode)}
                style={{ background: defaultPickMode === mode ? "#c9a84c14" : "#070a0e",
                  border: defaultPickMode === mode ? "1px solid #c9a84c" : "1px solid #1e2530",
                  borderRadius: 8, padding: "14px 14px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: defaultPickMode === mode ? "#c9a84c" : "#9aa4ae",
                  fontFamily: "'Oswald',sans-serif", letterSpacing: ".06em", marginBottom: 4 }}>
                  {info.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 12, color: "#6a7480", fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.5 }}>
                  {info.desc}
                </div>
              </button>
            ))}
          </div>

          <label style={{ display: "block", fontSize: 10, letterSpacing: ".18em", color: "#6a5a30", marginBottom: 8 }}>
            POOL SCOPE <span style={{ color: "#3a4250" }}>(WHICH CONFERENCES ARE IN PLAY)</span>
          </label>
          <div style={{ marginBottom: 24 }}>
            <ConferencePicker selected={conferences} onChange={setConferences} pickMode={defaultPickMode}
              teamScope={teamScope} onTeamScopeChange={setTeamScope} />
          </div>

          <div style={{ background: "#070a0e", border: "1px solid #1e2530", borderRadius: 8,
            padding: "12px 16px", marginBottom: 24, fontFamily: "'Barlow Condensed',sans-serif" }}>
            <div style={{ fontSize: 10, letterSpacing: ".18em", color: "#6a5a30", marginBottom: 8,
              fontFamily: "'Oswald',sans-serif" }}>SCORING (DEFAULT)</div>
            <div style={{ fontSize: 13, color: "#9aa4ae", lineHeight: 1.9 }}>
              Correct match pick — <span style={{ color: "#c9a84c", fontWeight: 700 }}>{DEFAULT_SCORING.matchWin} pt</span><br />
              Perfect 10-match card — <span style={{ color: "#c9a84c", fontWeight: 700 }}>+{DEFAULT_SCORING.perfectCard} pts</span><br />
              Correct dual winner (Duals Only mode) — <span style={{ color: "#c9a84c", fontWeight: 700 }}>{DEFAULT_SCORING.dualWin} pts</span>
            </div>
          </div>

          {error && (
            <div style={{ background: "#1e0a0a", border: "1px solid #7f1d1d", color: "#fca5a5",
              borderRadius: 6, padding: "10px 14px", fontSize: 13, marginBottom: 16,
              fontFamily: "'Barlow Condensed',sans-serif" }}>
              {error}
            </div>
          )}

          <button className="pk-btn" onClick={handleCreate}
            style={{ width: "100%", padding: "15px", background: "#c9a84c", color: "#070a0e",
              borderRadius: 6, fontSize: 15, fontWeight: 700, letterSpacing: ".1em" }}>
            CREATE POOL →
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button className="pk-btn" onClick={() => navigate("/")}
            style={{ background: "none", color: "#4a5260", fontSize: 12, letterSpacing: ".12em" }}>
            ← BACK TO PINFALL FANTASY
          </button>
        </div>
      </div>
    </div>
  );
}

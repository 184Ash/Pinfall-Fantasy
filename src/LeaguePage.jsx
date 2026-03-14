// src/LeaguePage.jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getSession, clearSession } from "./session";
import { fetchLeague } from "./leagueService";
import JoinScreen from "./JoinScreen";
import WaitingRoom from "./WaitingRoom";
import App from "./App";
import { claimTeam, claimAdditionalTeam } from "./leagueService";

const styles = {
  centered: {
    minHeight: "100vh",
    background: "#0D1520",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#7A8A9A",
    fontFamily: "Arial, sans-serif",
    fontSize: "15px",
  },
  notFound: {
    textAlign: "center",
  },
  notFoundTitle: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#E8EDF2",
    marginBottom: "10px",
  },
  leaveBtn: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    background: "none",
    border: "1px solid #2A3A50",
    borderRadius: "6px",
    color: "#4A5A6A",
    fontSize: "12px",
    padding: "8px 14px",
    cursor: "pointer",
    zIndex: 500,
  },
};

function ReadOnlyLeague({ joinCode, leagueName, teams, settings, hasRecoveryEmail }) {
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSendLink = async () => {
    if (!recoveryEmail.trim()) return;
    setSending(true);
    await supabase.auth.signInWithOtp({
      email: recoveryEmail.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?league=${joinCode}`,
      },
    });
    setSent(true);
    setSending(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0D1520", color: "#E8EDF2",
      fontFamily: "Arial, sans-serif", padding: "0 0 80px",
    }}>
      <div style={{
        background: "#1A2535", borderBottom: "2px solid #C9A84C",
        padding: "28px 24px 20px", textAlign: "center",
      }}>
        <div style={{ fontSize: "13px", letterSpacing: "3px", color: "#C9A84C",
          textTransform: "uppercase", marginBottom: "6px" }}>Pinfall Fantasy</div>
        <h1 style={{ fontSize: "26px", fontWeight: "700", color: "#FFF", margin: "0 0 4px" }}>
          {leagueName}
        </h1>
        <div style={{ fontSize: "13px", color: "#7A8A9A" }}>Draft complete — read only</div>
      </div>

      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "0 16px" }}>
        <div style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase",
          color: "#7A8A9A", margin: "28px 0 12px", fontWeight: "600" }}>Teams</div>
        {teams.map((team) => (
          <div key={team.id} style={{
            background: "#1A2535", border: "1px solid #2A3A50", borderRadius: "10px",
            padding: "14px 16px", marginBottom: "10px", display: "flex",
            justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: "15px", fontWeight: "600" }}>{team.name}</span>
            {team.is_claimed && (
              <span style={{ fontSize: "12px", color: "#4CAF7D" }}>✓ Claimed</span>
            )}
          </div>
        ))}

        {/* Commissioner recovery */}
        {hasRecoveryEmail && (
          <>
            <button
              onClick={() => setShowRecovery(v => !v)}
              style={{
                background: "none", border: "none", color: "#4A5A6A",
                fontSize: "13px", cursor: "pointer", textDecoration: "underline",
                marginTop: "32px", display: "block", width: "100%", textAlign: "center",
              }}
            >
              {showRecovery ? "▲ Hide" : "Commissioner? Recover access"}
            </button>

            {showRecovery && (
              <div style={{
                background: "#1A2535", border: "1px solid #2A3A50", borderRadius: "10px",
                padding: "20px", marginTop: "12px",
              }}>
                <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>
                  Recover Commissioner Access
                </div>
                <div style={{ fontSize: "12px", color: "#7A8A9A", marginBottom: "14px",
                  lineHeight: "1.5" }}>
                  Enter your recovery email and we'll send you a magic link to restore
                  your commissioner session.
                </div>
                {!sent ? (
                  <>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={recoveryEmail}
                      onChange={e => setRecoveryEmail(e.target.value)}
                      style={{
                        width: "100%", background: "#0D1520", border: "1px solid #2A3A50",
                        borderRadius: "6px", color: "#E8EDF2", fontSize: "15px",
                        padding: "11px 14px", outline: "none", boxSizing: "border-box",
                        marginBottom: "12px",
                      }}
                    />
                    <button
                      onClick={handleSendLink}
                      disabled={sending || !recoveryEmail.trim()}
                      style={{
                        width: "100%", background: recoveryEmail.trim() ? "#C9A84C" : "#2A3A50",
                        color: recoveryEmail.trim() ? "#0D1520" : "#4A5A6A",
                        border: "none", borderRadius: "6px", padding: "12px",
                        fontSize: "14px", fontWeight: "700", cursor: recoveryEmail.trim()
                          ? "pointer" : "not-allowed",
                      }}
                    >
                      {sending ? "Sending..." : "Send Recovery Link"}
                    </button>
                  </>
                ) : (
                  <div style={{
                    background: "#1A3A2A", border: "1px solid #2A6A3A", borderRadius: "6px",
                    color: "#4CAF7D", fontSize: "13px", padding: "12px 14px", lineHeight: "1.5",
                  }}>
                    ✓ Check your email for the magic link. Keep this window open and click
                    the link — you'll be brought back here as commissioner.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function LeaguePage() {
  const { joinCode } = useParams();
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState(null);   // { leagueName, teams, settings }
  const [session, setSession] = useState(null); // { leagueId, teamIds, role }
  const [teams, setTeams] = useState([]);

  // ── Load league from Supabase on mount ───────────────────────────
  useEffect(() => {
    const load = async () => {
      const data = await fetchLeague(joinCode);
      if (data) {
        setLeague(data);
        setTeams(data.teams);
      }
      setSession(getSession());
      setLoading(false);
    };
    load();
  }, [joinCode]);

  // ── Claiming ──────────────────────────────────────────────────────
  const handleClaim = async (teamId, displayName) => {
  const result = await claimTeam(joinCode, teamId, displayName);
  if (result.success) {
    // Refresh teams so the claimed team shows as yours
    const updated = await fetchLeague(joinCode);
    if (updated) setTeams(updated.teams);
    // Update session in state but don't trigger navigation yet —
    // user stays on JoinScreen so they can claim additional teams
    setSession(getSession());
  } else if (result.reason === "already_claimed") {
    alert("Someone just claimed that team — please choose another.");
  }
};

  const handleClaimAnother = async (teamId, displayName) => {
    const result = await claimAdditionalTeam(joinCode, teamId, displayName);
    if (result.success) {
      setSession(getSession());
      const updated = await fetchLeague(joinCode);
      if (updated) setTeams(updated.teams);
    } else if (result.reason === "already_claimed") {
      alert("Someone just claimed that team — please choose another.");
    }
  };

  // ── Leave team ────────────────────────────────────────────────────
  const handleLeave = () => {
    clearSession();
    window.location.reload();
  };

  // ── Render states ─────────────────────────────────────────────────
  if (loading) {
    return <div style={styles.centered}>Loading...</div>;
  }

  if (!league) {
    return (
      <div style={styles.centered}>
        <div style={styles.notFound}>
          <div style={styles.notFoundTitle}>League not found</div>
          <div>Double-check the link and try again.</div>
        </div>
      </div>
    );
  }

  // Show JoinScreen if draft hasn't started, regardless of session,
// so users can claim multiple teams before entering the waiting room
if (!league.settings?.draftStarted) {
  if (!session) {
    return (
      <JoinScreen
        leagueId={joinCode}
        leagueName={league.leagueName}
        teams={teams}
        currentSession={null}
        onClaim={handleClaim}
        onClaimAnother={handleClaimAnother}
      />
    );
  }
  // Has session — show JoinScreen with current session so they can
  // claim more teams, with an Enter League button to proceed
  return (
    <>
      <JoinScreen
        leagueId={joinCode}
        leagueName={league.leagueName}
        teams={teams}
        currentSession={session}
        onClaim={handleClaim}
        onClaimAnother={handleClaimAnother}
      />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#1A2535", borderTop: "2px solid #C9A84C",
        padding: "16px 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: "16px", zIndex: 100,
      }}>
        <div style={{ fontSize: "13px", color: "#7A8A9A" }}>
          {session.teamIds?.length ?? 0} team{session.teamIds?.length !== 1 ? "s" : ""} claimed on this device
        </div>
        <button
          onClick={async () => {
  const data = await fetchLeague(joinCode);
  if (data) setLeague(data);
  setSession(getSession());
}}
          style={{
            background: "#C9A84C", color: "#0D1520", border: "none",
            borderRadius: "6px", padding: "12px 28px", fontSize: "14px",
            fontWeight: "700", cursor: "pointer",
          }}
        >
          Enter Waiting Room →
        </button>
      </div>
    </>
  );
}

// Draft not started check is handled above — if we reach here draft has started
if (!session) {
  return (
    <ReadOnlyLeague
      joinCode={joinCode}
      leagueName={league.leagueName}
      teams={teams}
      settings={league.settings}
      hasRecoveryEmail={!!league.commissionerEmail}
    />
  );
}

  // Session exists and draft is live → main App
  return (
    <>
      <App
        leagueId={joinCode}
        leagueName={league.leagueName}
        teams={teams}
        session={session}
        settings={league.settings}
      />
      <button style={styles.leaveBtn} onClick={handleLeave}>
        Leave
      </button>
    </>
  );
}
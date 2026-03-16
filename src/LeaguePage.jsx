// src/LeaguePage.jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getSession, clearSession } from "./session";
import { fetchLeague, requestRejoin, requestLateJoin, listenForRejoinApproval } from "./leagueService";
import JoinScreen from "./JoinScreen";
import WaitingRoom from "./WaitingRoom";
import App from "./App";
import { supabase } from "./supabase";
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

  // Rejoin (lost session on a previously claimed team)
  const [showRejoin, setShowRejoin] = useState(false);
  const [rejoinTeamId, setRejoinTeamId] = useState("");
  const [rejoinSent, setRejoinSent] = useState(false);

  // Late join (claiming an unclaimed team after draft started)
  const [lateJoinNames, setLateJoinNames] = useState({});
  const [lateJoinSent, setLateJoinSent] = useState({});

  const claimedTeams = teams.filter(t => t.is_claimed);
  const unclaimedTeams = teams.filter(t => !t.is_claimed);

  const subtitle = settings?.draftComplete ? "Draft complete" : settings?.draftStarted ? "Draft live" : "Draft in progress";

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

  const handleRejoin = async () => {
    if (!rejoinTeamId) return;
    const requestId = await requestRejoin(joinCode, rejoinTeamId);
    listenForRejoinApproval(requestId, joinCode, rejoinTeamId, 'member', () => {
      window.location.reload();
    });
    setRejoinSent(true);
  };

  const handleLateJoin = async (team) => {
    const name = (lateJoinNames[team.id] || '').trim();
    if (!name) return;
    const requestId = await requestLateJoin(joinCode, team.id, name);
    listenForRejoinApproval(requestId, joinCode, team.id, 'member', () => {
      window.location.reload();
    });
    setLateJoinSent(prev => ({ ...prev, [team.id]: true }));
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
        <div style={{ fontSize: "13px", color: "#7A8A9A" }}>{subtitle}</div>
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
            {team.is_claimed
              ? <span style={{ fontSize: "12px", color: "#4CAF7D" }}>✓ Claimed</span>
              : <span style={{ fontSize: "12px", color: "#4A5A6A", fontStyle: "italic" }}>Unclaimed</span>
            }
          </div>
        ))}

        {/* ── Late Join — claim an unclaimed team after draft started ── */}
        {unclaimedTeams.length > 0 && (
          <div style={{
            background: "#141E2E", border: "1px dashed #2A3A50", borderRadius: "10px",
            padding: "20px", marginTop: "28px",
          }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#C9A84C", marginBottom: "6px" }}>
              Join as a Late Addition
            </div>
            <div style={{ fontSize: "13px", color: "#7A8A9A", lineHeight: "1.5", marginBottom: "16px" }}>
              The draft is live. Pick an unclaimed team, enter your name, and submit — the commissioner will approve your access.
            </div>
            {unclaimedTeams.map(team => (
              <div key={team.id} style={{
                background: "#1A2535", border: "1px solid #2A3A50", borderRadius: "10px",
                padding: "14px 16px", marginBottom: "10px",
              }}>
                <div style={{ fontSize: "11px", color: "#C9A84C", marginBottom: "6px",
                  letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600" }}>
                  {team.name}
                </div>
                {lateJoinSent[team.id] ? (
                  <div style={{
                    background: "#1A3A2A", border: "1px solid #2A6A3A", borderRadius: "6px",
                    color: "#4CAF7D", fontSize: "13px", padding: "10px 12px", lineHeight: "1.5",
                  }}>
                    ✓ Request sent — keep this window open. You'll be redirected when approved.
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      style={{
                        flex: 1, background: "#0D1520", border: "1px solid #2A3A50",
                        borderRadius: "6px", color: "#E8EDF2", fontSize: "15px",
                        padding: "10px 12px", outline: "none", boxSizing: "border-box",
                      }}
                      type="text"
                      placeholder="Your team name..."
                      maxLength={40}
                      value={lateJoinNames[team.id] || ''}
                      onChange={e => setLateJoinNames(prev => ({ ...prev, [team.id]: e.target.value }))}
                      onFocus={e => (e.target.style.borderColor = "#C9A84C")}
                      onBlur={e => (e.target.style.borderColor = "#2A3A50")}
                    />
                    <button
                      disabled={!(lateJoinNames[team.id] || '').trim()}
                      onClick={() => handleLateJoin(team)}
                      style={{
                        background: (lateJoinNames[team.id] || '').trim() ? "#C9A84C" : "#2A3A50",
                        color: (lateJoinNames[team.id] || '').trim() ? "#0D1520" : "#4A5A6A",
                        border: "none", borderRadius: "6px", padding: "10px 18px",
                        fontSize: "13px", fontWeight: "700", cursor: (lateJoinNames[team.id] || '').trim() ? "pointer" : "not-allowed",
                        whiteSpace: "nowrap", flexShrink: 0,
                      }}
                    >
                      Request to Join
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Rejoin — restore session for a previously claimed team ── */}
        {claimedTeams.length > 0 && (
          <>
            <button
              onClick={() => setShowRejoin(v => !v)}
              style={{
                background: "none", border: "none", color: "#4A5A6A",
                fontSize: "13px", cursor: "pointer", textDecoration: "underline",
                marginTop: "32px", display: "block", width: "100%", textAlign: "center",
              }}
            >
              {showRejoin ? "▲ Hide" : "Lost your team?"}
            </button>
            {showRejoin && (
              <div style={{
                background: "#1A2535", border: "1px solid #2A3A50", borderRadius: "10px",
                padding: "20px", marginTop: "12px",
              }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#E8EDF2", marginBottom: "6px" }}>
                  Request to Rejoin
                </div>
                <div style={{ fontSize: "12px", color: "#7A8A9A", marginBottom: "14px", lineHeight: "1.5" }}>
                  If you lost your session, select your team and submit a request.
                  The commissioner will approve it and restore your access.
                </div>
                {!rejoinSent ? (
                  <>
                    <select
                      value={rejoinTeamId}
                      onChange={e => setRejoinTeamId(e.target.value)}
                      style={{
                        width: "100%", background: "#0D1520", border: "1px solid #2A3A50",
                        borderRadius: "6px", color: "#E8EDF2", fontSize: "15px",
                        padding: "11px 14px", marginBottom: "12px", outline: "none",
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="">Select your team...</option>
                      {claimedTeams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      disabled={!rejoinTeamId}
                      onClick={handleRejoin}
                      style={{
                        background: "none", border: `1px solid ${rejoinTeamId ? "#C9A84C" : "#4A5A6A"}`,
                        borderRadius: "6px", color: rejoinTeamId ? "#C9A84C" : "#9EA8B0",
                        fontSize: "13px", fontWeight: "600", padding: "10px 18px",
                        cursor: rejoinTeamId ? "pointer" : "not-allowed", width: "100%",
                      }}
                    >
                      Submit Rejoin Request
                    </button>
                  </>
                ) : (
                  <div style={{
                    background: "#1A3A2A", border: "1px solid #2A6A3A", borderRadius: "6px",
                    color: "#4CAF7D", fontSize: "13px", padding: "12px 14px", lineHeight: "1.5",
                  }}>
                    ✓ Request sent. The commissioner will approve your access shortly — keep this window open.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Commissioner magic-link recovery ── */}
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
                    ✓ Check your email for the magic link. Important — open the link on the
                    device you want to use as commissioner during the draft. Your session
                    is tied to that device. Clicking it on your phone won't restore
                    access on your laptop.
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
  const [league, setLeague] = useState(null);
  const [session, setSession] = useState(null);
  const [teams, setTeams] = useState([]);
  const [enterWaiting, setEnterWaiting] = useState(false);
  const [initialPage, setInitialPage] = useState("settings");

  // ── Load league from Supabase on mount ───────────────────────────
  useEffect(() => {
    const load = async () => {
      const data = await fetchLeague(joinCode);
      if (data) {
        setLeague(data);
        setTeams(data.teams);
        if (data.settings?.draftComplete) {
          setInitialPage("standings");
        } else if (data.settings?.draftStarted && Object.keys(data.settings).length > 0) {
          // If already past goToDraft, open to board not settings
          setInitialPage("board");
        }
      }
      setSession(getSession());
      setLoading(false);
    };
    load();
  }, [joinCode]);

  // ── Realtime listener — handle goToDraft and draftStarted ────────
  useEffect(() => {
    if (!joinCode) return;

    const channel = supabase
      .channel(`league-settings-${joinCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leagues",
          filter: `id=eq.${joinCode}`,
        },
        (payload) => {
          const settings = payload.new?.settings_json;
          if (!settings) return;
          // draftComplete fired — update state so routing re-evaluates
          if (settings.draftComplete) {
            setInitialPage("standings");
            setLeague((prev) =>
              prev ? { ...prev, settings: { ...prev.settings, ...settings } } : prev
            );
            return;
          }
          // goToDraft fired — navigate everyone to App at settings page
          if (settings.goToDraft && !settings.draftStarted) {
            setInitialPage("settings");
            setLeague((prev) =>
              prev ? { ...prev, settings: { ...prev.settings, ...settings } } : prev
            );
          }
          // draftStarted fired — navigate to board
          if (settings.draftStarted) {
            setInitialPage("board");
            setLeague((prev) =>
              prev ? { ...prev, settings: { ...prev.settings, ...settings } } : prev
            );
          }
          // Reset fired (draftStarted flipped back to false)
          if (settings.goToDraft && settings.draftStarted === false) {
            setInitialPage("settings");
            setLeague((prev) =>
              prev ? { ...prev, settings: { ...prev.settings, ...settings } } : prev
            );
          }
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [joinCode]);

  // ── Claiming ──────────────────────────────────────────────────────
  const handleClaim = async (teamId, displayName) => {
    const result = await claimTeam(joinCode, teamId, displayName);
    if (result.success) {
      const updated = await fetchLeague(joinCode);
      if (updated) setTeams(updated.teams);
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

  // ── Leave ─────────────────────────────────────────────────────────
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

  // ── Draft complete — everyone sees full App (read-only for non-commissioners) ─
  if (league.settings?.draftComplete) {
    return (
      <>
        <App
          leagueId={joinCode}
          leagueName={league.leagueName}
          teams={teams}
          session={session}
          settings={league.settings}
          initialPage={initialPage}
        />
        {session && (
          <button style={styles.leaveBtn} onClick={handleLeave}>
            Leave
          </button>
        )}
      </>
    );
  }

  // ── Pre-draft ─────────────────────────────────────────────────────
  if (!league.settings?.draftStarted && !league.settings?.goToDraft) {

    // Commissioner and co-commissioner go straight to WaitingRoom
    // Members go to WaitingRoom after clicking Enter Waiting Room
    if (session?.role === 'commissioner' || session?.role === 'co_commissioner' || enterWaiting) {
      return (
        <>
          <WaitingRoom
            leagueId={joinCode}
            leagueName={league.leagueName}
            teams={teams}
            session={session}
          />
          <button style={styles.leaveBtn} onClick={handleLeave}>
            Leave
          </button>
        </>
      );
    }

    // No session — show JoinScreen to claim a team
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

    // Has session but not commissioner — show JoinScreen with Enter Waiting Room bar
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
              setEnterWaiting(true);
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

  // ── Post-draft, no session → read only ────────────────────────────
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

  // ── Draft live or goToDraft → main App ───────────────────────────
  return (
    <>
      <App
        leagueId={joinCode}
        leagueName={league.leagueName}
        teams={teams}
        session={session}
        settings={league.settings}
        initialPage={initialPage}
      />
      <button style={styles.leaveBtn} onClick={handleLeave}>
        Leave
      </button>
    </>
  );
}

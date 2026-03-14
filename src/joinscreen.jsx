// src/JoinScreen.jsx
import { useState } from "react";
import { requestRejoin, listenForRejoinApproval, unclaimTeam } from './leagueService'

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: "#0D1520",
    color: "#E8EDF2",
    fontFamily: "'Arial', sans-serif",
    padding: "0 0 60px 0",
  },
  header: {
    background: "#1A2535",
    borderBottom: "2px solid #C9A84C",
    padding: "28px 24px 20px",
    textAlign: "center",
  },
  logo: {
    fontSize: "13px",
    letterSpacing: "3px",
    color: "#C9A84C",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  leagueName: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#FFFFFF",
    margin: "0",
  },
  body: {
    maxWidth: "480px",
    margin: "0 auto",
    padding: "0 16px",
  },
  sectionTitle: {
    fontSize: "11px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: "#7A8A9A",
    margin: "28px 0 12px",
    fontWeight: "600",
  },
  teamCard: {
    background: "#1A2535",
    border: "1px solid #2A3A50",
    borderRadius: "10px",
    padding: "14px 16px",
    marginBottom: "10px",
  },
  teamCardYours: {
    background: "#1A2535",
    border: "1px solid #2A6A3A",
    borderRadius: "10px",
    padding: "14px 16px",
    marginBottom: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  teamCardClaimed: {
    background: "#1A2535",
    border: "1px solid #2A3A50",
    borderRadius: "10px",
    padding: "14px 16px",
    marginBottom: "10px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    opacity: 0.6,
  },
  teamName: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#E8EDF2",
    flex: 1,
  },
  claimRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    marginTop: "2px",
  },
  input: {
    flex: 1,
    background: "#0D1520",
    border: "1px solid #2A3A50",
    borderRadius: "6px",
    color: "#E8EDF2",
    fontSize: "15px",
    padding: "10px 12px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  claimBtn: {
    background: "#C9A84C",
    color: "#0D1520",
    border: "none",
    borderRadius: "6px",
    padding: "10px 18px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.2s, opacity 0.2s",
    flexShrink: 0,
  },
  claimBtnDisabled: {
    background: "#2A3A50",
    color: "#4A5A6A",
    border: "none",
    borderRadius: "6px",
    padding: "10px 18px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "not-allowed",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  yoursLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#4CAF7D",
    fontSize: "13px",
    fontWeight: "700",
  },
  claimedLabel: {
    color: "#4A5A6A",
    fontSize: "13px",
    fontStyle: "italic",
  },
  claimAnotherSection: {
    background: "#141E2E",
    border: "1px dashed #2A3A50",
    borderRadius: "10px",
    padding: "20px",
    marginTop: "28px",
  },
  claimAnotherTitle: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#C9A84C",
    marginBottom: "6px",
  },
  claimAnotherDesc: {
    fontSize: "13px",
    color: "#7A8A9A",
    lineHeight: "1.5",
    marginBottom: "16px",
  },
  rejoinToggle: {
    background: "none",
    border: "none",
    color: "#4A5A6A",
    fontSize: "13px",
    cursor: "pointer",
    padding: "0",
    textDecoration: "underline",
    marginTop: "32px",
    display: "block",
    width: "100%",
    textAlign: "center",
  },
  rejoinSection: {
    background: "#1A2535",
    border: "1px solid #2A3A50",
    borderRadius: "10px",
    padding: "20px",
    marginTop: "12px",
  },
  rejoinTitle: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#E8EDF2",
    marginBottom: "6px",
  },
  rejoinDesc: {
    fontSize: "12px",
    color: "#7A8A9A",
    marginBottom: "14px",
    lineHeight: "1.5",
  },
  select: {
    width: "100%",
    background: "#0D1520",
    border: "1px solid #2A3A50",
    borderRadius: "6px",
    color: "#E8EDF2",
    fontSize: "15px",
    padding: "11px 14px",
    marginBottom: "12px",
    outline: "none",
    boxSizing: "border-box",
  },
  rejoinBtn: {
    background: "none",
    border: "1px solid #4A5A6A",
    borderRadius: "6px",
    color: "#9EA8B0",
    fontSize: "13px",
    fontWeight: "600",
    padding: "10px 18px",
    cursor: "pointer",
    width: "100%",
    transition: "border-color 0.2s, color 0.2s",
  },
  successMsg: {
    background: "#1A3A2A",
    border: "1px solid #2A6A3A",
    borderRadius: "6px",
    color: "#4CAF7D",
    fontSize: "13px",
    padding: "12px 14px",
    marginTop: "10px",
    lineHeight: "1.5",
  },
};

export default function JoinScreen({
  leagueId,
  leagueName,
  teams = [],
  currentSession,
  onClaim,
  onClaimAnother,
}) {
  const [teamNames, setTeamNames] = useState({});
  const [anotherNames, setAnotherNames] = useState({});
  const [showRejoin, setShowRejoin] = useState(false);
  const [rejoinTeamId, setRejoinTeamId] = useState("");
  const [rejoinSent, setRejoinSent] = useState(false);
  const [claiming, setClaiming] = useState(null);

  const sessionTeamIds = currentSession?.teamIds ?? [];

  const getTeamName = (team) =>
    teamNames[team.id] !== undefined ? teamNames[team.id] : team.name;

  const handleClaim = async (team) => {
    const name = getTeamName(team).trim();
    if (!name) return;
    setClaiming(team.id);
    await onClaim(team.id, name);
    setClaiming(null);
  };

  const handleClaimAnother = async (team) => {
    const name = (anotherNames[team.id] || "").trim();
    if (!name) return;
    setClaiming(team.id);
    await onClaimAnother(team.id, name);
    setClaiming(null);
  };

  const handleRejoin = async () => {
    if (!rejoinTeamId) return;
    const requestId = await requestRejoin(leagueId, rejoinTeamId);
    listenForRejoinApproval(requestId, leagueId, rejoinTeamId, 'member', () => {
      window.location.reload();
    });
    setRejoinSent(true);
  };

  const handleUnclaim = async (teamId) => {
    if (!window.confirm("Are you sure you want to unclaim this team? The spot will become available again.")) return;
    await unclaimTeam(leagueId, teamId);
    window.location.reload();
  };

  const unclaimedTeams = teams.filter(
    (t) => !t.is_claimed && !sessionTeamIds.includes(t.id)
  );

  return (
    <div style={styles.wrapper}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.logo}>Pinfall Fantasy</div>
        <h1 style={styles.leagueName}>{leagueName}</h1>
      </div>

      <div style={styles.body}>
        {/* ── Team List ── */}
        <div style={styles.sectionTitle}>
          {currentSession ? "Teams" : "Claim Your Team"}
        </div>

        {teams.map((team) => {
          const isYours = sessionTeamIds.includes(team.id);
          const isClaimed = team.is_claimed && !isYours;
          const isLoading = claiming === team.id;
          const nameVal = getTeamName(team);
          const canClaim = nameVal.trim().length > 0;

          // ── Yours ──
          if (isYours) {
            return (
              <div key={team.id} style={styles.teamCardYours}>
                <span style={styles.teamName}>{team.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={styles.yoursLabel}>
                    <span style={{ fontSize: "16px" }}>✓</span> Yours
                  </span>
                  <button
                    onClick={() => handleUnclaim(team.id)}
                    style={{
                      background: "none",
                      border: "1px solid #3A2A2A",
                      borderRadius: "5px",
                      color: "#5A3A3A",
                      fontSize: "11px",
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = "#8B2020";
                      e.target.style.color = "#C0392B";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = "#3A2A2A";
                      e.target.style.color = "#5A3A3A";
                    }}
                  >
                    Unclaim
                  </button>
                </div>
              </div>
            );
          }

          // ── Claimed by someone else ──
          if (isClaimed) {
            return (
              <div key={team.id} style={styles.teamCardClaimed}>
                <span style={styles.teamName}>{team.name}</span>
                <span style={styles.claimedLabel}>Claimed</span>
              </div>
            );
          }

          // ── Unclaimed ──
          return (
            <div key={team.id} style={styles.teamCard}>
              <div style={{
                fontSize: "11px",
                color: "#C9A84C",
                marginBottom: "6px",
                letterSpacing: "1px",
                textTransform: "uppercase",
                fontWeight: "600",
              }}>
                Enter your team name to claim
              </div>
              <div style={styles.claimRow}>
                <input
                  style={styles.input}
                  type="text"
                  value={nameVal}
                  onChange={(e) =>
                    setTeamNames((prev) => ({ ...prev, [team.id]: e.target.value }))
                  }
                  placeholder="e.g. Iron Wolves, Gold Rush..."
                  maxLength={40}
                  disabled={!!currentSession}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#2A3A50")}
                />
                {!currentSession && (
                  <button
                    style={canClaim ? styles.claimBtn : styles.claimBtnDisabled}
                    disabled={!canClaim || isLoading}
                    onClick={() => handleClaim(team)}
                    title={!canClaim ? "Enter a team name first" : ""}
                  >
                    {isLoading ? "..." : "Claim"}
                  </button>
                )}
              </div>
              {!canClaim && !currentSession && (
                <div style={{
                  fontSize: "11px",
                  color: "#4A5A6A",
                  marginTop: "5px",
                  fontStyle: "italic",
                }}>
                  ↑ Enter a name above before claiming
                </div>
              )}
            </div>
          );
        })}

        {/* ── Claim Another Team ── */}
        {currentSession && unclaimedTeams.length > 0 && (
          <div style={styles.claimAnotherSection}>
            <div style={styles.claimAnotherTitle}>Claim Another Team</div>
            <div style={styles.claimAnotherDesc}>
              A second person on this device can claim an additional team.
              Enter their team name below and click Claim.
            </div>
            <div style={styles.sectionTitle}>Available Teams</div>
            {unclaimedTeams.map((team) => {
              const isLoading = claiming === team.id;
              const nameVal = anotherNames[team.id] || "";
              const canClaim = nameVal.trim().length > 0;
              return (
                <div key={team.id} style={styles.teamCard}>
                  <div style={{
                    fontSize: "11px",
                    color: "#C9A84C",
                    marginBottom: "6px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    fontWeight: "600",
                  }}>
                    Enter team name to claim
                  </div>
                  <div style={styles.claimRow}>
                    <input
                      style={styles.input}
                      type="text"
                      value={nameVal}
                      onChange={(e) =>
                        setAnotherNames((prev) => ({
                          ...prev,
                          [team.id]: e.target.value,
                        }))
                      }
                      placeholder="e.g. Iron Wolves, Gold Rush..."
                      maxLength={40}
                      onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                      onBlur={(e) => (e.target.style.borderColor = "#2A3A50")}
                    />
                    <button
                      style={canClaim ? styles.claimBtn : styles.claimBtnDisabled}
                      disabled={!canClaim || isLoading}
                      onClick={() => handleClaimAnother(team)}
                    >
                      {isLoading ? "..." : "Claim"}
                    </button>
                  </div>
                  {!canClaim && (
                    <div style={{
                      fontSize: "11px",
                      color: "#4A5A6A",
                      marginTop: "5px",
                      fontStyle: "italic",
                    }}>
                      ↑ Enter a name above before claiming
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Lost Your Team / Rejoin ── */}
        <button
          style={styles.rejoinToggle}
          onClick={() => setShowRejoin((v) => !v)}
        >
          {showRejoin ? "▲ Hide" : "Lost your team?"}
        </button>

        {showRejoin && (
          <div style={styles.rejoinSection}>
            <div style={styles.rejoinTitle}>Request to Rejoin</div>
            <div style={styles.rejoinDesc}>
              If you lost your session, select your team and submit a request.
              The commissioner or co-commissioner will approve it and restore
              your access.
            </div>
            {!rejoinSent ? (
              <>
                <select
                  style={styles.select}
                  value={rejoinTeamId}
                  onChange={(e) => setRejoinTeamId(e.target.value)}
                >
                  <option value="">Select your team...</option>
                  {teams
                    .filter((t) => t.is_claimed)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <button
                  style={{
                    ...styles.rejoinBtn,
                    ...(rejoinTeamId
                      ? { borderColor: "#C9A84C", color: "#C9A84C" }
                      : {}),
                  }}
                  disabled={!rejoinTeamId}
                  onClick={handleRejoin}
                >
                  Submit Rejoin Request
                </button>
              </>
            ) : (
              <div style={styles.successMsg}>
                ✓ Request sent. The commissioner will approve your access
                shortly — keep this window open.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

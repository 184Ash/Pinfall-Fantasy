// src/JoinScreen.jsx
import { useState } from "react";
import { requestRejoin, listenForRejoinApproval } from './leagueService'

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
  nameSection: {
    background: "#1A2535",
    border: "1px solid #2A3A50",
    borderRadius: "10px",
    padding: "20px",
    marginTop: "24px",
  },
  label: {
    display: "block",
    fontSize: "11px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: "#C9A84C",
    marginBottom: "8px",
    fontWeight: "600",
  },
  input: {
    width: "100%",
    background: "#0D1520",
    border: "1px solid #2A3A50",
    borderRadius: "6px",
    color: "#E8EDF2",
    fontSize: "16px",
    padding: "12px 14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
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
    padding: "16px 18px",
    marginBottom: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  teamCardYours: {
    background: "#1A2535",
    border: "1px solid #2A6A3A",
    borderRadius: "10px",
    padding: "16px 18px",
    marginBottom: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  teamName: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#E8EDF2",
    flex: 1,
  },
  claimBtn: {
    background: "#C9A84C",
    color: "#0D1520",
    border: "none",
    borderRadius: "6px",
    padding: "9px 18px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    letterSpacing: "0.5px",
    whiteSpace: "nowrap",
    transition: "background 0.2s, opacity 0.2s",
  },
  claimBtnDisabled: {
    background: "#2A3A50",
    color: "#4A5A6A",
    border: "none",
    borderRadius: "6px",
    padding: "9px 18px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "not-allowed",
    letterSpacing: "0.5px",
    whiteSpace: "nowrap",
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
    whiteSpace: "nowrap",
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
  const [displayName, setDisplayName] = useState("");
  const [anotherName, setAnotherName] = useState("");
  const [showRejoin, setShowRejoin] = useState(false);
  const [rejoinTeamId, setRejoinTeamId] = useState("");
  const [rejoinSent, setRejoinSent] = useState(false);
  const [claiming, setClaiming] = useState(null);

  const sessionTeamIds = currentSession?.teamIds ?? [];

  const handleClaim = async (teamId) => {
    if (!displayName.trim()) return;
    setClaiming(teamId);
    await onClaim(teamId, displayName.trim());
    setClaiming(null);
  };

  const handleClaimAnother = async (teamId) => {
    if (!anotherName.trim() || !teamId) return;
    setClaiming(teamId);
    await onClaimAnother(teamId, anotherName.trim());
    setClaiming(null);
  };

  const handleRejoin = async () => {
  if (!rejoinTeamId) return
  const requestId = await requestRejoin(leagueId, rejoinTeamId)
  listenForRejoinApproval(requestId, leagueId, rejoinTeamId, 'member', () => {
    window.location.reload()
  })
  setRejoinSent(true)
}

  const unclaimedTeams = teams.filter((t) => !t.is_claimed);

  return (
    <div style={styles.wrapper}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.logo}>Pinfall Fantasy</div>
        <h1 style={styles.leagueName}>{leagueName}</h1>
      </div>

      <div style={styles.body}>
        {/* ── Name Input (first-time claim) ── */}
        {!currentSession && (
          <div style={styles.nameSection}>
            <label style={styles.label}>Your Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Enter your name to claim a team"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
              onBlur={(e) => (e.target.style.borderColor = "#2A3A50")}
            />
          </div>
        )}

        {/* ── Team List ── */}
        <div style={styles.sectionTitle}>Teams</div>
        {teams.map((team) => {
          const isYours = sessionTeamIds.includes(team.id);
          const isClaimed = team.is_claimed && !isYours;
          const isLoading = claiming === team.id;
          const canClaim =
            !team.is_claimed &&
            !currentSession &&
            displayName.trim().length > 0;

          return (
            <div
              key={team.id}
              style={isYours ? styles.teamCardYours : styles.teamCard}
            >
              <span style={styles.teamName}>{team.name}</span>

              {isYours && (
                <span style={styles.yoursLabel}>
                  <span style={{ fontSize: "16px" }}>✓</span> Yours
                </span>
              )}

              {isClaimed && (
                <span style={styles.claimedLabel}>
                  Claimed by {team.claimed_by || "someone"}
                </span>
              )}

              {!team.is_claimed && !currentSession && (
                <button
                  style={canClaim ? styles.claimBtn : styles.claimBtnDisabled}
                  disabled={!canClaim || isLoading}
                  onClick={() => handleClaim(team.id)}
                >
                  {isLoading ? "..." : "Claim"}
                </button>
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
              Enter their name below and select a team.
            </div>
            <label style={styles.label}>Their Name</label>
            <input
              style={{ ...styles.input, marginBottom: "14px" }}
              type="text"
              placeholder="Enter their name"
              value={anotherName}
              onChange={(e) => setAnotherName(e.target.value)}
              maxLength={40}
              onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
              onBlur={(e) => (e.target.style.borderColor = "#2A3A50")}
            />
            <div style={styles.sectionTitle}>Available Teams</div>
            {unclaimedTeams.map((team) => {
              const isLoading = claiming === team.id;
              const canClaim = anotherName.trim().length > 0;
              return (
                <div key={team.id} style={styles.teamCard}>
                  <span style={styles.teamName}>{team.name}</span>
                  <button
                    style={canClaim ? styles.claimBtn : styles.claimBtnDisabled}
                    disabled={!canClaim || isLoading}
                    onClick={() => handleClaimAnother(team.id)}
                  >
                    {isLoading ? "..." : "Claim"}
                  </button>
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
                        {t.claimed_by ? ` — ${t.claimed_by}` : ""}
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
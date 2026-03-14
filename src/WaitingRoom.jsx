// src/WaitingRoom.jsx
import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { fetchLeague } from "./leagueService";

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: "#0D1520",
    color: "#E8EDF2",
    fontFamily: "'Arial', sans-serif",
    padding: "0 0 80px 0",
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
  title: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#FFFFFF",
    margin: "0 0 4px 0",
  },
  subtitle: {
    fontSize: "13px",
    color: "#7A8A9A",
    margin: "0",
  },
  body: {
    maxWidth: "520px",
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
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamName: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#E8EDF2",
  },
  claimedBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#4CAF7D",
    fontWeight: "600",
  },
  unclaimedBadge: {
    fontSize: "12px",
    color: "#4A5A6A",
    fontStyle: "italic",
  },
  waitingBox: {
    background: "#1A2535",
    border: "1px solid #2A3A50",
    borderRadius: "10px",
    padding: "24px",
    marginTop: "24px",
    textAlign: "center",
  },
  waitingTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#E8EDF2",
    marginBottom: "8px",
  },
  waitingDesc: {
    fontSize: "13px",
    color: "#7A8A9A",
    lineHeight: "1.6",
    marginBottom: "0",
  },
  pulse: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#C9A84C",
    marginRight: "8px",
    animation: "pulseAnim 2s infinite",
  },
  startBtn: {
    width: "100%",
    background: "#C9A84C",
    color: "#0D1520",
    border: "none",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    letterSpacing: "0.5px",
    marginTop: "28px",
    transition: "opacity 0.2s",
  },
  startBtnDisabled: {
    width: "100%",
    background: "#2A3A50",
    color: "#4A5A6A",
    border: "none",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "not-allowed",
    letterSpacing: "0.5px",
    marginTop: "28px",
  },
  progressBar: {
    background: "#0D1520",
    borderRadius: "4px",
    height: "6px",
    marginTop: "16px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#C9A84C",
    borderRadius: "4px",
    transition: "width 0.4s ease",
  },
  progressLabel: {
    fontSize: "12px",
    color: "#7A8A9A",
    marginTop: "8px",
    textAlign: "center",
  },
};

const styleTag = document.createElement("style");
styleTag.textContent = `@keyframes pulseAnim { 0%,100%{opacity:1} 50%{opacity:.3} }`;
document.head.appendChild(styleTag);

export default function WaitingRoom({
  leagueId,
  leagueName,
  teams: initialTeams,
  session,
  onDraftStarted,
}) {
  const [teams, setTeams] = useState(initialTeams || []);
  const [starting, setStarting] = useState(false);

  const isCommissioner =
    session?.role === "commissioner" || session?.role === "co_commissioner";

  const claimedCount = teams.filter((t) => t.is_claimed).length;
  const totalCount = teams.length;
  const allClaimed = claimedCount === totalCount;
  const progressPct = totalCount > 0 ? (claimedCount / totalCount) * 100 : 0;

  // ── Real-time team updates ────────────────────────────────────────
  useEffect(() => {
    if (!leagueId) return;

    const channel = supabase
      .channel(`waitingroom-${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `league_id=eq.${leagueId}`,
        },
        async () => {
          // Re-fetch full team list on any change
          const updated = await fetchLeague(leagueId);
          if (updated) setTeams(updated.teams);
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [leagueId]);

   // ── Start Draft ───────────────────────────────────────────────────
  const handleStartDraft = async () => {
    if (!isCommissioner) return;
    setStarting(true);
    try {
      // Fetch current settings first to preserve existing fields
      const { data: league, error } = await supabase
        .from("leagues")
        .select("settings_json")
        .eq("id", leagueId)
        .single();

      if (error) throw new Error(error.message);

      const updatedSettings = {
        ...league.settings_json,
        draftStarted: true,
      };

      const { error: updateError } = await supabase
        .from("leagues")
        .update({ settings_json: updatedSettings })
        .eq("id", leagueId);

      if (updateError) throw new Error(updateError.message);

      // Notify parent — LeaguePage will re-fetch and transition
      onDraftStarted();
    } catch (err) {
      alert("Failed to start draft: " + err.message);
      setStarting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.logo}>Pinfall Fantasy</div>
        <h1 style={styles.title}>{leagueName}</h1>
        <p style={styles.subtitle}>
          <span style={styles.pulse} />
          Waiting for participants to claim their teams
        </p>
      </div>

      <div style={styles.body}>
        {/* ── Progress ── */}
        <div style={{ marginTop: "28px" }}>
          <div style={styles.progressBar}>
            <div
              style={{ ...styles.progressFill, width: `${progressPct}%` }}
            />
          </div>
          <div style={styles.progressLabel}>
            {claimedCount} of {totalCount} teams claimed
          </div>
        </div>

        {/* ── Team List ── */}
        <div style={styles.sectionTitle}>Teams</div>
        {teams.map((team) => (
          <div key={team.id} style={styles.teamCard}>
            <span style={styles.teamName}>{team.name}</span>
            {team.is_claimed ? (
              <span style={styles.claimedBadge}>
                <span style={{ fontSize: "14px" }}>✓</span> Claimed
              </span>
            ) : (
              <span style={styles.unclaimedBadge}>Waiting...</span>
            )}
          </div>
        ))}

        {/* ── Commissioner controls ── */}
        {isCommissioner ? (
          <>
            <button
              style={allClaimed || true ? styles.startBtn : styles.startBtnDisabled}
              onClick={handleStartDraft}
              disabled={starting}
            >
              {starting ? "Starting draft..." : "Start Draft →"}
            </button>
            {!allClaimed && (
              <div style={{
                fontSize: "12px",
                color: "#7A8A9A",
                textAlign: "center",
                marginTop: "10px",
                lineHeight: "1.5",
              }}>
                {totalCount - claimedCount} team{totalCount - claimedCount !== 1 ? "s" : ""} still unclaimed —
                you can start anyway or wait for everyone.
              </div>
            )}
          </>
        ) : (
          <div style={styles.waitingBox}>
            <div style={styles.waitingTitle}>You're in!</div>
            <div style={styles.waitingDesc}>
              Waiting for the commissioner to start the draft.
              This page will update automatically — no need to refresh.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
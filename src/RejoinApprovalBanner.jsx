// src/RejoinApprovalBanner.jsx
import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { approveRejoin } from "./leagueService";

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px 16px",
    pointerEvents: "none",
  },
  banner: {
    background: "#1A2535",
    border: "1px solid #C9A84C",
    borderRadius: "10px",
    padding: "16px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
    pointerEvents: "all",
    animation: "slideDown 0.25s ease",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flex: 1,
    minWidth: 0,
  },
  icon: {
    fontSize: "22px",
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  teamName: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#E8EDF2",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  subtext: {
    fontSize: "12px",
    color: "#7A8A9A",
    marginTop: "2px",
  },
  buttons: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  },
  approveBtn: {
    background: "#C9A84C",
    color: "#0D1520",
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  denyBtn: {
    background: "none",
    border: "1px solid #4A5A6A",
    borderRadius: "6px",
    color: "#7A8A9A",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};

// Inject keyframe animation once
const styleTag = document.createElement("style");
styleTag.textContent = `@keyframes slideDown {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}`;
document.head.appendChild(styleTag);

export default function RejoinApprovalBanner({ leagueId, currentUserRole }) {
  const [requests, setRequests] = useState([]);

  // Only commissioners and co-commissioners see this
  const canApprove =
    currentUserRole === "commissioner" ||
    currentUserRole === "co_commissioner";

  useEffect(() => {
    if (!canApprove || !leagueId) return;

    // ── 1. Load any already-pending requests on mount ─────────────
    const loadPending = async () => {
      const { data, error } = await supabase
        .from("rejoin_requests")
        .select(`id, team_id, status, teams(name, role, is_claimed, claimed_by)`)
        .eq("league_id", leagueId)
        .eq("status", "pending");

      if (!error && data) setRequests(data);
    };
    loadPending();

    // ── 2. Subscribe to new pending requests via Realtime ─────────
    const channel = supabase
      .channel(`rejoin-banner-${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rejoin_requests",
          filter: `league_id=eq.${leagueId}`,
        },
        async (payload) => {
          // Fetch the team name to display in the banner
          const { data: team } = await supabase
            .from("teams")
            .select("name, role, is_claimed, claimed_by")
            .eq("id", payload.new.team_id)
            .single();

          if (payload.new.status === "pending") {
            setRequests((prev) => [
              ...prev,
              { ...payload.new, teams: team },
            ]);
          }
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [leagueId, canApprove]);

  const handleApprove = async (request) => {
    await approveRejoin(request.id);
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
  };

  const handleDeny = async (request) => {
    // If this was a late-join request, clear the temporary claimed_by we stored
    if (!request.teams?.is_claimed) {
      await supabase.from("teams").update({ claimed_by: null }).eq("id", request.team_id);
    }
    await supabase
      .from("rejoin_requests")
      .update({ status: "denied" })
      .eq("id", request.id);
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
  };

  if (!canApprove || requests.length === 0) return null;

  return (
    <div style={styles.overlay}>
      {requests.map((request) => {
        const teamName = request.teams?.name ?? "Unknown Team";
        const claimedBy = request.teams?.claimed_by ?? null;
        const isLateJoin = !request.teams?.is_claimed;
        // Late-join: claimed_by holds the requested name, name holds the placeholder ("Team 3")
        // Rejoin: claimed_by holds their display name, name holds their chosen team name
        const displayName = isLateJoin
          ? (claimedBy ?? "Unknown")
          : (claimedBy ? `${claimedBy} (${teamName})` : teamName);
        const subtext = isLateJoin
          ? `wants to join as ${teamName} — approve access?`
          : "wants to rejoin — restore their access?";

        return (
          <div key={request.id} style={styles.banner}>
            <div style={styles.left}>
              <span style={styles.icon}>🔔</span>
              <div style={styles.text}>
                <div style={styles.teamName}>{displayName}</div>
                <div style={styles.subtext}>{subtext}</div>
              </div>
            </div>
            <div style={styles.buttons}>
              <button
                style={styles.approveBtn}
                onClick={() => handleApprove(request)}
              >
                Approve
              </button>
              <button
                style={styles.denyBtn}
                onClick={() => handleDeny(request)}
              >
                Deny
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
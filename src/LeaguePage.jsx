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
      setSession(getSession());
      // Refresh team list so claimed_by label updates for everyone
      const updated = await fetchLeague(joinCode);
      if (updated) setTeams(updated.teams);
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

  // No session → show JoinScreen
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

  // Session exists but draft not started → WaitingRoom
  if (!league.settings?.draftStarted) {
    return (
      <>
        <WaitingRoom
          leagueId={joinCode}
          leagueName={league.leagueName}
          teams={teams}
          session={session}
          onDraftStarted={async () => {
            const updated = await fetchLeague(joinCode);
            if (updated) setLeague(updated);
          }}
        />
        <button style={styles.leaveBtn} onClick={handleLeave}>
          Leave
        </button>
      </>
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
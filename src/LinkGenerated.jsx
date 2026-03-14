// src/LinkGenerated.jsx
import { useState } from "react";
import { claimTeamAsCommissioner } from "./leagueService";
import { supabase } from "./supabase";

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
    color: "#4CAF7D",
    margin: "0",
  },
  body: {
    maxWidth: "520px",
    margin: "0 auto",
    padding: "0 16px",
  },
  section: {
    background: "#1A2535",
    border: "1px solid #2A3A50",
    borderRadius: "10px",
    padding: "24px",
    marginTop: "24px",
  },
  sectionTitle: {
    fontSize: "11px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: "#C9A84C",
    fontWeight: "600",
    marginBottom: "16px",
  },
  urlBox: {
    background: "#0D1520",
    border: "1px solid #C9A84C",
    borderRadius: "8px",
    padding: "16px 18px",
    marginBottom: "14px",
  },
  urlText: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#C9A84C",
    wordBreak: "break-all",
    lineHeight: "1.4",
  },
  copyBtn: {
    width: "100%",
    background: "#C9A84C",
    color: "#0D1520",
    border: "none",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    letterSpacing: "0.5px",
    transition: "background 0.2s",
  },
  copyBtnSuccess: {
    width: "100%",
    background: "#2A6A3A",
    color: "#4CAF7D",
    border: "none",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "default",
    letterSpacing: "0.5px",
  },
  lockedNote: {
    background: "#0D1520",
    border: "1px solid #2A3A50",
    borderRadius: "6px",
    padding: "12px 14px",
    fontSize: "12px",
    color: "#7A8A9A",
    lineHeight: "1.6",
    marginTop: "14px",
  },
  teamCard: {
    background: "#0D1520",
    border: "1px solid #2A3A50",
    borderRadius: "8px",
    padding: "12px 14px",
    marginBottom: "10px",
  },
  teamCardClaimed: {
    background: "#0D1520",
    border: "1px solid #2A6A3A",
    borderRadius: "8px",
    padding: "12px 14px",
    marginBottom: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  claimRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  input: {
    flex: 1,
    background: "#1A2535",
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
  claimedLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#4CAF7D",
    fontSize: "13px",
    fontWeight: "700",
  },
  claimedName: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#E8EDF2",
  },
  joinCodeDisplay: {
    fontSize: "36px",
    fontWeight: "700",
    color: "#C9A84C",
    letterSpacing: "8px",
    textAlign: "center",
    padding: "8px 0",
  },
  goBtn: {
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
    transition: "background 0.2s",
  },
  footerNote: {
    textAlign: "center",
    fontSize: "12px",
    color: "#4A5A6A",
    marginTop: "12px",
    lineHeight: "1.5",
  },
  skipNote: {
    textAlign: "center",
    fontSize: "12px",
    color: "#4A5A6A",
    marginTop: "10px",
    lineHeight: "1.5",
  },
};

export default function LinkGenerated({ joinCode, leagueUrl, teams: initialTeams = [], onGoToLeague }) {
  const [copied, setCopied] = useState(false);
  const [teams, setTeams] = useState(initialTeams);
  const [teamNames, setTeamNames] = useState(() =>
  Object.fromEntries(initialTeams.map(t => [t.id, t.name]))
);
  const [claiming, setClaiming] = useState(null);
  const [claimError, setClaimError] = useState(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(leagueUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const el = document.createElement("textarea");
      el.value = leagueUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleClaim = async (team) => {
    const name = (teamNames[team.id] ?? "").trim();
    if (!name) return;
    setClaiming(team.id);
    setClaimError(null);
    try {
      const result = await claimTeamAsCommissioner(joinCode, team.id, name);
      if (result.success) {
        // Update local team list to show as claimed
        setTeams(prev => prev.map(t =>
          t.id === team.id
            ? { ...t, is_claimed: true, name, claimed_by: name }
            : t
        ));
      } else if (result.reason === "already_claimed") {
        setClaimError(`${team.name} was already claimed.`);
      }
    } catch (err) {
      setClaimError("Something went wrong. Please try again.");
    }
    setClaiming(null);
  };
const handleUnclaimCommissioner = async (teamId) => {
  if (!window.confirm("Unclaim this team? It will become available again.")) return;
  try {
    const { error } = await supabase
      .from('teams')
      .update({
        is_claimed: false,
        claimed_at: null,
        claimed_by: null,
        name: teams.find(t => t.id === teamId)?.draft_position
  ? `Team ${teams.find(t => t.id === teamId).draft_position}`
  : 'Team',
role: 'member',
})
.eq('id', teamId);
if (error) throw new Error(error.message);
setTeams(prev => prev.map(t =>
  t.id === teamId
    ? { ...t, is_claimed: false, name: `Team ${t.draft_position}`, claimed_by: null }
    : t
));
  } catch (err) {
    alert("Something went wrong: " + err.message);
  }
};
  const claimedCount = teams.filter(t => t.is_claimed).length;

  return (
    <div style={styles.wrapper}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.logo}>Pinfall Fantasy</div>
        <h1 style={styles.title}>Your League is Ready</h1>
        <p style={styles.subtitle}>✓ League created successfully</p>
      </div>

      <div style={styles.body}>

        {/* ── Shareable URL ── */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Share This Link</div>
          <div style={styles.urlBox}>
            <div style={styles.urlText}>{leagueUrl}</div>
          </div>
          <button
            style={copied ? styles.copyBtnSuccess : styles.copyBtn}
            onClick={handleCopy}
          >
            {copied ? "✓ Copied to clipboard" : "Copy Link"}
          </button>
          <div style={styles.lockedNote}>
            🔒 Send this link to your league. Participants open it, enter their
            team name, and claim their spot. No passcodes needed.
          </div>
        </div>

        {/* ── Claim Your Teams ── */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            Claim Your Team{claimedCount > 0 ? ` — ${claimedCount} claimed` : ""}
          </div>
          <div style={{ fontSize: "12px", color: "#7A8A9A", lineHeight: "1.6", marginBottom: "16px" }}>
            Claim one or more teams for yourself before sharing the link.
            If you're running the draft solo, claim all of them here.
            Leave any unclaimed — participants will name and claim them when they open the link.
          </div>

          {claimError && (
            <div style={{ color: "#C0392B", fontSize: "12px", marginBottom: "12px" }}>
              {claimError}
            </div>
          )}

          {teams.map((team) => {
            if (team.is_claimed) {
  return (
    <div key={team.id} style={styles.teamCardClaimed}>
      <span style={styles.claimedName}>{team.name}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={styles.claimedLabel}>
          <span style={{ fontSize: "16px" }}>✓</span> Yours
        </span>
        <button
          onClick={() => handleUnclaimCommissioner(team.id)}
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

            const canClaim = (teamNames[team.id] ?? "").trim().length > 0;
            const isLoading = claiming === team.id;

            return (
              <div key={team.id} style={styles.teamCard}>
                <div style={styles.claimRow}>
                  <input
                    style={styles.input}
                    type="text"
                    value={teamNames[team.id] ?? ""}
                    onChange={(e) =>
                      setTeamNames(prev => ({ ...prev, [team.id]: e.target.value }))
                    }
                    placeholder="Enter your team name"
                    maxLength={40}
                    onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                    onBlur={(e) => (e.target.style.borderColor = "#2A3A50")}
                  />
                  <button
                    style={canClaim ? styles.claimBtn : styles.claimBtnDisabled}
                    disabled={!canClaim || isLoading}
                    onClick={() => handleClaim(team)}
                  >
                    {isLoading ? "..." : "Claim"}
                  </button>
                </div>
              </div>
            );
          })}

          <div style={styles.skipNote}>
            Skip claiming entirely if you're just the host — you'll have
            commissioner access to draft for all teams without owning one.
          </div>
        </div>

        {/* ── Join Code ── */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Join Code</div>
          <div style={styles.joinCodeDisplay}>{joinCode}</div>
          <div style={{ fontSize: "12px", color: "#7A8A9A", textAlign: "center", lineHeight: "1.6" }}>
            The last 5 characters of your league URL. Useful if someone needs
            to type it in manually.
          </div>
        </div>

        {/* ── Go to League ── */}
        <button style={styles.goBtn} onClick={onGoToLeague}>
          Go to My League →
        </button>
        <div style={styles.footerNote}>
          You already have commissioner access on this device.
          <br />
          Your session is active until you close this browser tab.
        </div>

      </div>
    </div>
  );
}

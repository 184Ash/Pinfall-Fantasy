// src/CreateLeaguePage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CommissionerSetup from "./CommissionerSetup";
import LinkGenerated from "./LinkGenerated";
import { createLeague } from "./leagueService";

const styles = {
  loading: {
    minHeight: "100vh",
    background: "#0D1520",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
    gap: "20px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #2A3A50",
    borderTop: "3px solid #C9A84C",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    color: "#C9A84C",
    fontSize: "15px",
    letterSpacing: "1px",
  },
  errorBox: {
    minHeight: "100vh",
    background: "#0D1520",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
    padding: "40px 24px",
    textAlign: "center",
    gap: "16px",
  },
  errorTitle: {
    color: "#C0392B",
    fontSize: "18px",
    fontWeight: "700",
  },
  errorMsg: {
    color: "#9EA8B0",
    fontSize: "14px",
    lineHeight: "1.6",
    maxWidth: "400px",
  },
  retryBtn: {
    background: "#C9A84C",
    color: "#0D1520",
    border: "none",
    borderRadius: "8px",
    padding: "12px 28px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "8px",
  },
};

// Inject spinner keyframe once
const styleTag = document.createElement("style");
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleTag);

export default function CreateLeaguePage() {
  const navigate = useNavigate();

  // Track which screen to show
  const [phase, setPhase] = useState("setup"); // "setup" | "loading" | "error" | "done"
  const [result, setResult] = useState(null);   // { joinCode, joinUrl, teams }
  const [error, setError] = useState(null);
  const [savedFormData, setSavedFormData] = useState(null); // preserved on error

  const handleConfirm = async (formData) => {
    setSavedFormData(formData);
    setPhase("loading");
    try {
      const data = await createLeague(formData);
      // Build team list for LinkGenerated from formData
      const teams = Array.from({ length: formData.teamCount }, (_, i) => ({
        name: `Team ${i + 1}`,
      }));
      setResult({ ...data, teams });
      setPhase("done");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setPhase("error");
    }
  };

  const handleGoToLeague = () => {
    navigate(`/join/${result.joinCode}`);
  };

  // ── Loading ───────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <div style={styles.loadingText}>Generating your league...</div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div style={styles.errorBox}>
        <div style={styles.errorTitle}>Something went wrong</div>
        <div style={styles.errorMsg}>{error}</div>
        <button
          style={styles.retryBtn}
          onClick={() => {
            setError(null);
            setPhase("setup");
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <LinkGenerated
        joinCode={result.joinCode}
        leagueUrl={result.joinUrl}
        teams={result.teams}
        onGoToLeague={handleGoToLeague}
      />
    );
  }

  // ── Setup (default) ───────────────────────────────────────────────
  return (
    <CommissionerSetup
      onConfirm={handleConfirm}
      initialData={savedFormData}
    />
  );
}
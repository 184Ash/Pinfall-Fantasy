// src/LinkGenerated.jsx
import { useState } from "react";

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
  teamList: {
    listStyle: "none",
    padding: "0",
    margin: "0",
  },
  teamItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 0",
    borderBottom: "1px solid #2A3A50",
    fontSize: "14px",
    color: "#E8EDF2",
  },
  teamNumber: {
    fontSize: "12px",
    color: "#4A5A6A",
    minWidth: "24px",
    fontWeight: "600",
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
};

export default function LinkGenerated({ joinCode, leagueUrl, teams = [], onGoToLeague }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(leagueUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback for browsers that block clipboard API
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
            🔒 This is the only link for your league. Send it to your group
            chat — participants open it, enter their team name, and claim their
            spot. No passcodes needed.
          </div>
        </div>

        {/* ── Team Summary ── */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            {teams.length} Teams Created
          </div>
          <ul style={styles.teamList}>
            {teams.map((team, i) => (
              <li key={i} style={{
                ...styles.teamItem,
                ...(i === teams.length - 1 ? { borderBottom: "none" } : {}),
              }}>
                <span style={styles.teamNumber}>{i + 1}</span>
                <span>{team.name}</span>
                <span style={{ marginLeft: "auto", fontSize: "12px", color: "#4A5A6A" }}>
                  Unclaimed
                </span>
              </li>
            ))}
          </ul>
          <div style={{ ...styles.lockedNote, marginTop: "16px" }}>
            🔒 Team count and draft settings are now locked. Participants will
            choose their own team names when they claim a spot.
          </div>
        </div>

        {/* ── Join Code ── */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Join Code</div>
          <div style={{
            fontSize: "36px",
            fontWeight: "700",
            color: "#C9A84C",
            letterSpacing: "8px",
            textAlign: "center",
            padding: "8px 0",
          }}>
            {joinCode}
          </div>
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
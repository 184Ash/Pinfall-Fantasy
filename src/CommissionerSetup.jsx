// src/CommissionerSetup.jsx
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
    color: "#7A8A9A",
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
  fieldGroup: {
    marginBottom: "20px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    color: "#9EA8B0",
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
  inputError: {
    width: "100%",
    background: "#0D1520",
    border: "1px solid #8B2020",
    borderRadius: "6px",
    color: "#E8EDF2",
    fontSize: "16px",
    padding: "12px 14px",
    outline: "none",
    boxSizing: "border-box",
  },
  errorMsg: {
    color: "#C0392B",
    fontSize: "12px",
    marginTop: "6px",
  },
  select: {
    width: "100%",
    background: "#0D1520",
    border: "1px solid #2A3A50",
    borderRadius: "6px",
    color: "#E8EDF2",
    fontSize: "15px",
    padding: "12px 14px",
    outline: "none",
    boxSizing: "border-box",
    cursor: "pointer",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%239EA8B0' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 14px center",
    paddingRight: "36px",
  },
  teamCountRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  countBtn: {
    background: "#0D1520",
    border: "1px solid #2A3A50",
    borderRadius: "6px",
    color: "#C9A84C",
    fontSize: "20px",
    fontWeight: "700",
    width: "44px",
    height: "44px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "border-color 0.2s",
    userSelect: "none",
  },
  countDisplay: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#E8EDF2",
    minWidth: "48px",
    textAlign: "center",
  },
  countLabel: {
    fontSize: "13px",
    color: "#7A8A9A",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    cursor: "pointer",
    padding: "4px 0",
  },
  checkbox: {
    width: "20px",
    height: "20px",
    accentColor: "#C9A84C",
    cursor: "pointer",
    flexShrink: 0,
    marginTop: "1px",
  },
  checkboxLabel: {
    fontSize: "14px",
    color: "#E8EDF2",
    lineHeight: "1.5",
  },
  checkboxDesc: {
    fontSize: "12px",
    color: "#7A8A9A",
    marginTop: "3px",
  },
  divider: {
    height: "1px",
    background: "#2A3A50",
    margin: "20px 0",
  },
  optionalLabel: {
    fontSize: "11px",
    color: "#4A5A6A",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginLeft: "8px",
    fontWeight: "normal",
  },
  warningBox: {
    background: "#1A1200",
    border: "1px solid #4A3800",
    borderRadius: "6px",
    padding: "12px 14px",
    marginTop: "14px",
    fontSize: "12px",
    color: "#C9A84C",
    lineHeight: "1.6",
  },
  warningBoxGreen: {
    background: "#0D1F0D",
    border: "1px solid #2A4A2A",
    borderRadius: "6px",
    padding: "12px 14px",
    marginTop: "14px",
    fontSize: "12px",
    color: "#4CAF7D",
    lineHeight: "1.6",
  },
  confirmBtn: {
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
    transition: "background 0.2s, opacity 0.2s",
  },
  confirmBtnDisabled: {
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
  previewNote: {
    textAlign: "center",
    fontSize: "12px",
    color: "#4A5A6A",
    marginTop: "12px",
    lineHeight: "1.5",
  },
};

const ROTATION_OPTIONS = [
  { value: "snake", label: "Snake", desc: "1→N then N→1, alternating each round" },
  { value: "linear", label: "Linear", desc: "1→N repeating every round" },
  { value: "third_round_reversal", label: "Third Round Reversal", desc: "Snake, but reverses again on round 3" },
];

export default function CommissionerSetup({ onConfirm }) {
  const [leagueName, setLeagueName] = useState("");
  const [teamCount, setTeamCount] = useState(8);
  const [rotationType, setRotationType] = useState("snake");
  const [bonusPickEnabled, setBonusPickEnabled] = useState(true);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [showError, setShowError] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = leagueName.trim().length > 0;

  const adjustCount = (delta) => {
    setTeamCount((n) => Math.min(30, Math.max(2, n + delta)));
  };

  const countWarning =
    teamCount > 20
      ? `${teamCount} teams is a large league — draft times will be long. Hard cap is 30.`
      : teamCount === 20
      ? "20 teams is the recommended maximum for a smooth draft."
      : null;

  const handleConfirm = async () => {
    if (!canSubmit) {
      setShowError(true);
      return;
    }
    setLoading(true);
    await onConfirm({
      leagueName: leagueName.trim(),
      teamCount,
      rotationType,
      bonusPickEnabled,
      recoveryEmail: recoveryEmail.trim() || null,
    });
    setLoading(false);
  };

  return (
    <div style={styles.wrapper}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.logo}>Pinfall Fantasy</div>
        <h1 style={styles.title}>Create a League</h1>
        <p style={styles.subtitle}>
          Set up your league privately. The link is generated at the end.
        </p>
      </div>

      <div style={styles.body}>

        {/* ── League Name ── */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>League</div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>League Name</label>
            <input
              style={showError && !leagueName.trim() ? styles.inputError : styles.input}
              type="text"
              placeholder="e.g. Fratelli Fantasy Wrestling"
              value={leagueName}
              onChange={(e) => {
                setLeagueName(e.target.value);
                if (e.target.value.trim()) setShowError(false);
              }}
              maxLength={60}
              onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
              onBlur={(e) =>
                (e.target.style.borderColor =
                  showError && !leagueName.trim() ? "#8B2020" : "#2A3A50")
              }
            />
            {showError && !leagueName.trim() && (
              <div style={styles.errorMsg}>League name is required.</div>
            )}
          </div>
        </div>

        {/* ── Teams ── */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Teams</div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Number of Teams</label>
            <div style={styles.teamCountRow}>
              <button
                style={{
                  ...styles.countBtn,
                  opacity: teamCount <= 2 ? 0.4 : 1,
                  cursor: teamCount <= 2 ? "not-allowed" : "pointer",
                }}
                onClick={() => adjustCount(-1)}
                disabled={teamCount <= 2}
              >
                −
              </button>
              <div>
                <div style={styles.countDisplay}>{teamCount}</div>
                <div style={styles.countLabel}>teams</div>
              </div>
              <button
                style={{
                  ...styles.countBtn,
                  opacity: teamCount >= 30 ? 0.4 : 1,
                  cursor: teamCount >= 30 ? "not-allowed" : "pointer",
                }}
                onClick={() => adjustCount(1)}
                disabled={teamCount >= 30}
              >
                +
              </button>
            </div>
          </div>

          {/* Team count warning */}
          {countWarning && (
            <div style={{
              fontSize: "12px",
              color: teamCount > 20 ? "#C9A84C" : "#7A8A9A",
              background: teamCount > 20 ? "#1A1500" : "transparent",
              border: teamCount > 20 ? "1px solid #3A2A00" : "none",
              borderRadius: "6px",
              padding: teamCount > 20 ? "10px 12px" : "0",
              marginBottom: "12px",
              lineHeight: "1.6",
            }}>
              {teamCount > 20 ? "⚠ " : ""}{countWarning}
            </div>
          )}

          <div style={styles.divider} />
          <div style={{ fontSize: "12px", color: "#7A8A9A", lineHeight: "1.6" }}>
            Teams will be named by participants when they claim their spot.
            Placeholder names (Team 1, Team 2…) are used until then.
          </div>
        </div>

        {/* ── Draft Settings ── */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Draft Settings</div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Rotation Type</label>
            <select
              style={styles.select}
              value={rotationType}
              onChange={(e) => setRotationType(e.target.value)}
            >
              {ROTATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.desc}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.divider} />

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={bonusPickEnabled}
              onChange={(e) => setBonusPickEnabled(e.target.checked)}
            />
            <div>
              <div style={styles.checkboxLabel}>Enable Bonus Pick Round</div>
              <div style={styles.checkboxDesc}>
                Adds an extra pick round after all standard rounds are complete.
              </div>
            </div>
          </label>
        </div>

        {/* ── Recovery Email ── */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            Commissioner Recovery
            <span style={styles.optionalLabel}>optional</span>
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Recovery Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="your@email.com"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
              onBlur={(e) => (e.target.style.borderColor = "#2A3A50")}
            />
          </div>

          {/* Warning or confirmation based on whether email is entered */}
          {!recoveryEmail.trim() ? (
            <div style={styles.warningBox}>
              ⚠ Without a recovery email, you will lose commissioner access if
              you close your browser after the draft. Everyone — including you —
              will have read-only access only.{" "}
              <strong>Add a recovery email if you plan to import scores
              during the tournament.</strong>
            </div>
          ) : (
            <div style={styles.warningBoxGreen}>
              ✓ If you lose your session after the draft, enter this email on
              the league page to receive a magic link and restore commissioner
              access.
            </div>
          )}
        </div>

        {/* ── Confirm Button ── */}
        <button
          style={canSubmit ? styles.confirmBtn : styles.confirmBtnDisabled}
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? "Generating your league..." : "Confirm and Generate Link"}
        </button>
        <div style={styles.previewNote}>
          The shareable link is created when you click this button.
          <br />
          Team count and draft settings cannot be changed after this point.
        </div>

      </div>
    </div>
  );
}

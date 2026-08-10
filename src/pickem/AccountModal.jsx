// src/pickem/AccountModal.jsx — self-service account management.
// Members change their own access code / recovery email here; the commissioner
// deliberately gets NO in-UI controls over other members' accounts — their
// recovery power is the emailed backup copies, not the interface.
import { useState } from "react";
import { verifyMemberPasscode, setMemberPasscode, claimLegacyPasscode, updateMemberEmail } from "./pickemService";
import { validatePasscode, generatePasscode } from "./passcode";
import { clearPickemSession } from "./pickemSession";

const label = { display: "block", fontSize: 10, letterSpacing: ".16em", color: "#6a5a30", marginBottom: 5 };
const helper = { fontSize: 12, color: "#4a5260", fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.5 };

export default function AccountModal({ poolId, member, onClose, onChanged, showToast, hasCommissionerBackup = false }) {
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [email, setEmail] = useState(member?.email || "");
  const [busyCode, setBusyCode] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);
  const [error, setError] = useState(null);

  const handleChangeCode = async () => {
    if (busyCode) return;
    const check = validatePasscode(newCode);
    if (!check.ok) { setError(`New code: ${check.reason}`); return; }
    setBusyCode(true);
    setError(null);
    try {
      if (member.hasPasscode) {
        const result = await verifyMemberPasscode(member.id, currentCode);
        if (result === "wrong") { setError("Current code doesn't match."); return; }
        await setMemberPasscode(poolId, member.id, check.code, "changed");
      } else {
        // Legacy member setting a first code — race-safe claim
        const claimed = await claimLegacyPasscode(poolId, member.id, check.code);
        if (!claimed) {
          setError("A code was already set for this account (maybe on another device). Enter it as the current code.");
          onChanged();
          return;
        }
      }
      setCurrentCode("");
      setNewCode("");
      onChanged();
      showToast(hasCommissionerBackup
        ? "Access code updated — commissioner backup refreshed"
        : "Access code updated", "ok");
    } catch (err) {
      setError(err.message || "Could not update the code — try again.");
    } finally { setBusyCode(false); }
  };

  const handleSaveEmail = async () => {
    const trimmed = email.trim();
    if (trimmed && !trimmed.includes("@")) { setError("That doesn't look like an email."); return; }
    setBusyEmail(true);
    setError(null);
    try {
      await updateMemberEmail(member.id, trimmed || null);
      onChanged();
      showToast(trimmed ? "Recovery email saved" : "Recovery email removed", "ok");
    } catch (err) {
      setError(err.message || "Could not save the email — try again.");
    } finally { setBusyEmail(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.78)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#0b0f14", border: "1px solid #1a1f26", borderRadius: 12,
          boxShadow: "0 24px 64px #000000", width: "100%", maxWidth: 420, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", background: "#0a1018", borderBottom: "1px solid #1a1f26",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e0d8b4", letterSpacing: ".08em",
            fontFamily: "'Oswald',sans-serif" }}>
            YOUR ACCOUNT — {member?.name?.toUpperCase()}
          </div>
          <button className="pk-btn" onClick={onClose}
            style={{ background: "none", color: "#5a6470", fontSize: 16, padding: "0 4px" }}>
            ✕
          </button>
        </div>

        <div style={{ padding: "18px 20px 20px" }}>
          {/* ── Access code ── */}
          <span style={label}>{member?.hasPasscode ? "CHANGE ACCESS CODE" : "SET YOUR ACCESS CODE"}</span>
          {member?.hasPasscode && (
            <input className="pk-inp" placeholder="Current code" value={currentCode}
              onChange={e => setCurrentCode(e.target.value)} style={{ marginBottom: 8 }} />
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input className="pk-inp" placeholder="New code (4+ characters)" value={newCode}
              onChange={e => setNewCode(e.target.value)} />
            <button className="pk-btn" onClick={() => setNewCode(generatePasscode())}
              style={{ background: "transparent", color: "#c9a84c", border: "1px solid #c9a84c44",
                borderRadius: 6, padding: "0 12px", fontSize: 10, fontWeight: 700,
                letterSpacing: ".08em", whiteSpace: "nowrap" }}>
              GENERATE
            </button>
          </div>
          <div style={{ ...helper, marginBottom: 10 }}>
            Don&apos;t reuse a real password{hasCommissionerBackup
              ? " — your commissioner receives a backup copy of every code."
              : " — and keep a recovery email below, it's how you reset a forgotten code."}
          </div>
          <button className="pk-btn" disabled={busyCode} onClick={handleChangeCode}
            style={{ width: "100%", padding: "11px", background: "#c9a84c", color: "#070a0e",
              borderRadius: 6, fontSize: 13, fontWeight: 700, letterSpacing: ".08em",
              opacity: busyCode ? 0.6 : 1, marginBottom: 20 }}>
            {busyCode ? "SAVING..." : "UPDATE CODE"}
          </button>

          {/* ── Recovery email ── */}
          <span style={label}>RECOVERY EMAIL</span>
          <input className="pk-inp" placeholder="you@email.com" type="email" value={email}
            onChange={e => setEmail(e.target.value)} style={{ marginBottom: 6 }} />
          <div style={{ ...helper, marginBottom: 10 }}>
            Lets you reset a forgotten code yourself with an emailed 6-digit verification.
          </div>
          <button className="pk-btn" disabled={busyEmail} onClick={handleSaveEmail}
            style={{ width: "100%", padding: "11px", background: "transparent", color: "#c9a84c",
              border: "1px solid #c9a84c44", borderRadius: 6, fontSize: 13, fontWeight: 700,
              letterSpacing: ".08em", opacity: busyEmail ? 0.6 : 1 }}>
            {busyEmail ? "SAVING..." : "SAVE EMAIL"}
          </button>

          {error && (
            <div style={{ marginTop: 14, background: "#1e0a0a", border: "1px solid #7f1d1d",
              color: "#fca5a5", borderRadius: 6, padding: "9px 13px", fontSize: 13,
              fontFamily: "'Barlow Condensed',sans-serif" }}>
              {error}
            </div>
          )}

          {/* ── Sign out of this device ── */}
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid #131820", textAlign: "center" }}>
            <button className="pk-btn"
              onClick={() => { clearPickemSession(poolId); window.location.reload(); }}
              style={{ background: "none", border: "1px solid #2a3040", borderRadius: 6,
                color: "#7a8a9a", fontSize: 11, letterSpacing: ".1em", padding: "8px 18px" }}>
              SIGN OUT ON THIS DEVICE
            </button>
            <div style={{ ...helper, marginTop: 8 }}>
              You&apos;ll need your access code to sign back in.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

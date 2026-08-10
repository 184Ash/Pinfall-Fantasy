// src/pickem/PoolPage.jsx — route wrapper for /pickem/:joinCode
// Loads the pool and runs the account flow, then renders PickemApp.
//
// Accounts model: joining creates a member row secured by an ACCESS CODE the
// member chooses (salted hash in the DB; plaintext emailed to the commissioner
// as the recovery backup — which is why the UI says not to reuse a real
// password). Returning on a new device = pick your name + enter your code.
// Forgot it = Supabase email OTP proves address ownership, then set a new one.
// Members who joined before accounts existed (no hash) claim theirs on the
// next rejoin.
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchPool, joinPool, verifyMemberPasscode, setMemberPasscode, claimLegacyPasscode,
  updateMemberEmail, requestPasscodeReset, confirmPasscodeReset, membersByEmail,
} from "./pickemService";
import { validatePasscode, generatePasscode } from "./passcode";
import { getPickemSession, savePickemSession } from "./pickemSession";
import PickemApp from "./PickemApp";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#070a0e;}
.pk-inp{background:#070a0e;border:1px solid #1e2530;border-radius:6px;color:#d0c8b4;
  font-family:'Barlow Condensed',sans-serif;font-size:15px;padding:10px 13px;width:100%;}
.pk-inp:focus{outline:none;border-color:#c9a84c;box-shadow:0 0 0 2px #c9a84c22;}
.pk-btn{cursor:pointer;border:none;transition:all .13s;font-family:'Oswald',sans-serif;}
.pk-btn:hover:not(:disabled){filter:brightness(1.15);}
.pk-btn:disabled{cursor:default;opacity:.6;}
.pk-member-row:hover{border-color:#c9a84c66 !important;background:#c9a84c0a !important;}
`;

const page = {
  minHeight: "100vh", background: "#070a0e", color: "#d0c8b4",
  fontFamily: "'Oswald',sans-serif", display: "flex",
  alignItems: "center", justifyContent: "center", padding: "40px 20px",
};

const label = { display: "block", fontSize: 10, letterSpacing: ".18em", color: "#6a5a30", marginBottom: 6 };
const helper = { fontSize: 12, color: "#4a5260", fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.5 };

function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div style={{ background: "#1e0a0a", border: "1px solid #7f1d1d", color: "#fca5a5",
      borderRadius: 6, padding: "9px 13px", fontSize: 13, marginBottom: 14,
      fontFamily: "'Barlow Condensed',sans-serif" }}>
      {children}
    </div>
  );
}

function GoldButton({ children, ...props }) {
  return (
    <button className="pk-btn" {...props}
      style={{ width: "100%", padding: "14px", background: "#c9a84c", color: "#070a0e",
        borderRadius: 6, fontSize: 15, fontWeight: 700, letterSpacing: ".1em", ...props.style }}>
      {children}
    </button>
  );
}

function GhostButton({ children, ...props }) {
  return (
    <button className="pk-btn" {...props}
      style={{ width: "100%", marginTop: 12, padding: "10px", background: "none",
        color: "#6a7480", fontSize: 12, letterSpacing: ".1em",
        border: "1px solid #1e2530", borderRadius: 6, ...props.style }}>
      {children}
    </button>
  );
}

function CodeInput({ value, onChange, placeholder = "Your access code", withGenerate = false, onEnter }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input className="pk-inp" placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onEnter?.()} />
      {withGenerate && (
        <button className="pk-btn" onClick={() => onChange(generatePasscode())}
          style={{ background: "transparent", color: "#c9a84c", border: "1px solid #c9a84c44",
            borderRadius: 6, padding: "0 14px", fontSize: 11, fontWeight: 700,
            letterSpacing: ".08em", whiteSpace: "nowrap" }}>
          GENERATE
        </button>
      )}
    </div>
  );
}

export default function PoolPage() {
  const { joinCode } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState(null);
  const [session, setSession] = useState(() => getPickemSession(joinCode));

  // flow: join | members | code | setup | reset-email | reset-token | reset-choose | reset-newcode
  const [flow, setFlow] = useState("join");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  const [joinName, setJoinName] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetMatches, setResetMatches] = useState([]);
  const [resetNewCode, setResetNewCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchPool(joinCode).then(data => {
      if (!cancelled) { setPool(data); setLoading(false); }
    }).catch(() => {
      if (!cancelled) { setPool(null); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [joinCode]);

  const go = (nextFlow) => { setError(null); setFlow(nextFlow); };
  const signIn = (member) => {
    savePickemSession(joinCode, member.id, member.role);
    setSession({ poolId: joinCode, memberId: member.id, role: member.role });
  };
  // True when access-code backups can actually reach a commissioner inbox —
  // gates the "your commissioner receives a backup copy" promise in the copy.
  const hasBackup = !!pool?.commissionerEmail;

  const handleJoin = async () => {
    if (busy) return;
    if (!joinName.trim()) { setError("Enter your name to join."); return; }
    const check = validatePasscode(joinCodeInput);
    if (!check.ok) { setError(`Access code: ${check.reason}`); return; }
    setBusy(true);
    setError(null);
    try {
      await joinPool(joinCode, {
        name: joinName.trim(),
        email: joinEmail.trim() || null,
        passcode: check.code,
      });
      setSession(getPickemSession(joinCode));
    } catch (err) {
      setError(err.message || "Could not join — try again.");
    } finally { setBusy(false); }
  };

  const handleVerifyCode = async () => {
    if (busy) return;
    if (!codeInput.trim()) { setError("Enter your access code."); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await verifyMemberPasscode(selectedMember.id, codeInput);
      if (result === "ok") signIn(selectedMember);
      else if (result === "legacy") go("setup");
      else setError(hasBackup
        ? "That code doesn't match. Ask your commissioner for your backup if you're stuck."
        : "That code doesn't match.");
    } catch (err) {
      setError(err.message || "Could not check the code — try again.");
    } finally { setBusy(false); }
  };

  const handleSetup = async () => {
    if (busy) return;
    const check = validatePasscode(setupCode);
    if (!check.ok) { setError(`Access code: ${check.reason}`); return; }
    setBusy(true);
    setError(null);
    try {
      // Race-safe: no-ops if this member set a code from another device since
      // this page loaded (the member list snapshot can be stale).
      const claimed = await claimLegacyPasscode(joinCode, selectedMember.id, check.code);
      if (!claimed) {
        setCodeInput("");
        setError("Looks like you already set a code on another device — enter it here.");
        setFlow("code");
        return;
      }
      if (setupEmail.trim()) await updateMemberEmail(selectedMember.id, setupEmail.trim());
      signIn(selectedMember);
    } catch (err) {
      setError(err.message || "Could not save your code — try again.");
    } finally { setBusy(false); }
  };

  const handleResetRequest = async () => {
    if (busy) return;
    const email = resetEmail.trim();
    if (!email || !email.includes("@")) { setError("Enter the email on your account."); return; }
    setBusy(true);
    setError(null);
    try {
      await requestPasscodeReset(email);
      go("reset-token");
    } catch (err) {
      setError(err.message || "Could not send the code — try again.");
    } finally { setBusy(false); }
  };

  const handleResetConfirm = async () => {
    if (busy) return;
    if (!resetToken.trim()) { setError("Enter the 6-digit code from the email."); return; }
    setBusy(true);
    setError(null);
    try {
      await confirmPasscodeReset(resetEmail.trim(), resetToken.trim());
      const matches = await membersByEmail(joinCode, resetEmail.trim());
      if (matches.length === 0) {
        setError("Email verified, but no member in this pool uses it. Ask your commissioner for your backup code.");
        return;
      }
      setResetMatches(matches);
      setResetNewCode("");
      if (matches.length === 1) { setSelectedMember(matches[0]); go("reset-newcode"); }
      else go("reset-choose");
    } catch (err) {
      setError(err.message || "That code didn't verify — check the email and try again.");
    } finally { setBusy(false); }
  };

  const handleResetNewCode = async () => {
    if (busy) return;
    const check = validatePasscode(resetNewCode);
    if (!check.ok) { setError(`Access code: ${check.reason}`); return; }
    setBusy(true);
    setError(null);
    try {
      await setMemberPasscode(joinCode, selectedMember.id, check.code, "reset");
      signIn(selectedMember);
    } catch (err) {
      setError(err.message || "Could not save your new code — try again.");
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <div style={page}>
        <style>{css}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ width: 40, height: 40, border: "3px solid #1e2530", borderTop: "3px solid #c9a84c",
            borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          <div style={{ fontSize: 14, letterSpacing: ".15em", color: "#6a5a30" }}>LOADING POOL...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div style={page}>
        <style>{css}</style>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#b04040", marginBottom: 10 }}>Pool not found</div>
          <div style={{ fontSize: 14, color: "#7a8a9a", fontFamily: "'Barlow Condensed',sans-serif",
            lineHeight: 1.7, marginBottom: 20 }}>
            No pick&apos;em pool exists at code <b style={{ color: "#c9a84c" }}>{joinCode}</b>.
            Double-check the link you were sent.
          </div>
          <button className="pk-btn" onClick={() => navigate("/")}
            style={{ background: "#c9a84c", color: "#070a0e", borderRadius: 6,
              padding: "11px 26px", fontSize: 13, fontWeight: 700, letterSpacing: ".08em" }}>
            BACK TO HOME
          </button>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <PickemApp
        poolId={joinCode}
        session={session}
        poolName={pool.poolName}
        season={pool.season}
        settings={pool.settings}
        initialMembers={pool.members}
        commissionerEmail={pool.commissionerEmail}
      />
    );
  }

  return (
    <div style={page}>
      <style>{css}</style>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ fontSize: 11, letterSpacing: ".25em", color: "#6a5a30", marginBottom: 8 }}>
            {pool.season} PICK&apos;EM POOL
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#c9a84c" }}>{pool.poolName}</h1>
          <div style={{ fontSize: 14, color: "#7a8a9a", fontFamily: "'Barlow Condensed',sans-serif", marginTop: 8 }}>
            {pool.members.length} {pool.members.length === 1 ? "member" : "members"} in the pool
          </div>
        </div>

        <div style={{ background: "#0b0f14", border: "1px solid #1a1f26", borderRadius: 12, padding: "26px 24px" }}>
          {/* ── New member ── */}
          {flow === "join" && (
            <>
              <span style={label}>YOUR NAME</span>
              <input className="pk-inp" placeholder="e.g. Katie" value={joinName} maxLength={60}
                onChange={e => setJoinName(e.target.value)} style={{ marginBottom: 14 }} />
              <span style={label}>EMAIL <span style={{ color: "#3a4250" }}>(RECOMMENDED — LETS YOU RESET YOUR CODE)</span></span>
              <input className="pk-inp" placeholder="you@email.com" type="email" value={joinEmail}
                onChange={e => setJoinEmail(e.target.value)} style={{ marginBottom: 14 }} />
              <span style={label}>CREATE AN ACCESS CODE</span>
              <CodeInput value={joinCodeInput} onChange={setJoinCodeInput}
                placeholder="At least 4 characters" withGenerate onEnter={handleJoin} />
              <div style={{ ...helper, margin: "6px 0 16px" }}>
                Your code gets you back in from any device. Don&apos;t reuse a real password.
                {hasBackup
                  ? " Your commissioner receives a backup copy for recovery."
                  : " Add your email above — it's the only way to recover a forgotten code in this pool."}
              </div>
              <ErrorNote>{error}</ErrorNote>
              <GoldButton disabled={busy} onClick={handleJoin}>
                {busy ? "JOINING..." : "JOIN THE POOL →"}
              </GoldButton>
              {pool.members.length > 0 && (
                <GhostButton onClick={() => go("members")}>
                  ALREADY IN THIS POOL? SIGN BACK IN
                </GhostButton>
              )}
            </>
          )}

          {/* ── Returning: pick your name ── */}
          {flow === "members" && (
            <>
              <span style={{ ...label, marginBottom: 10 }}>SELECT YOUR NAME</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
                {pool.members.map(m => (
                  <button key={m.id} className="pk-btn pk-member-row"
                    onClick={() => {
                      setSelectedMember(m);
                      setCodeInput(""); setSetupCode(""); setSetupEmail("");
                      go(m.hasPasscode ? "code" : "setup");
                    }}
                    style={{ background: "#070a0e", border: "1px solid #1e2530", borderRadius: 6,
                      padding: "11px 14px", textAlign: "left", color: "#d0c8b4", fontSize: 14,
                      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600 }}>
                    {m.name}
                    {m.role === "commissioner" && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: "#6a5a30", letterSpacing: ".14em" }}>
                        COMMISSIONER
                      </span>
                    )}
                    {!m.hasPasscode && (
                      <span style={{ float: "right", fontSize: 10, color: "#4a5260", letterSpacing: ".1em" }}>
                        SET UP CODE
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <GhostButton onClick={() => go("join")}>← BACK — I&apos;M NEW HERE</GhostButton>
            </>
          )}

          {/* ── Returning: enter code ── */}
          {flow === "code" && selectedMember && (
            <>
              <span style={label}>WELCOME BACK, {selectedMember.name.toUpperCase()}</span>
              <div style={{ marginBottom: 6 }}>
                <CodeInput value={codeInput} onChange={setCodeInput} onEnter={handleVerifyCode} />
              </div>
              <ErrorNote>{error}</ErrorNote>
              <GoldButton disabled={busy} onClick={handleVerifyCode}>
                {busy ? "CHECKING..." : "SIGN IN →"}
              </GoldButton>
              {selectedMember.email ? (
                <GhostButton onClick={() => { setResetEmail(""); setResetToken(""); go("reset-email"); }}>
                  FORGOT YOUR CODE? RESET BY EMAIL
                </GhostButton>
              ) : (
                <div style={{ ...helper, marginTop: 12, textAlign: "center" }}>
                  No recovery email on this account{hasBackup
                    ? " — your commissioner holds a backup of your code."
                    : ". If it's lost, ask your commissioner to help you start a fresh entry."}
                </div>
              )}
              <GhostButton onClick={() => go("members")} style={{ marginTop: 8 }}>← NOT YOU?</GhostButton>
            </>
          )}

          {/* ── Legacy member claiming their account ── */}
          {flow === "setup" && selectedMember && (
            <>
              <span style={label}>SET UP YOUR ACCESS CODE, {selectedMember.name.toUpperCase()}</span>
              <div style={{ ...helper, marginBottom: 12 }}>
                Accounts are new — create the code you&apos;ll use to sign in from now on.
              </div>
              <CodeInput value={setupCode} onChange={setSetupCode}
                placeholder="At least 4 characters" withGenerate onEnter={handleSetup} />
              <div style={{ margin: "14px 0 6px" }}>
                <span style={label}>EMAIL <span style={{ color: "#3a4250" }}>(RECOMMENDED — LETS YOU RESET YOUR CODE)</span></span>
                <input className="pk-inp" placeholder="you@email.com" type="email" value={setupEmail}
                  onChange={e => setSetupEmail(e.target.value)} />
              </div>
              <div style={{ ...helper, marginBottom: 14 }}>
                Don&apos;t reuse a real password{hasBackup ? " — your commissioner receives a backup copy" : ""}.
              </div>
              <ErrorNote>{error}</ErrorNote>
              <GoldButton disabled={busy} onClick={handleSetup}>
                {busy ? "SAVING..." : "SAVE & SIGN IN →"}
              </GoldButton>
              <GhostButton onClick={() => go("members")}>← NOT YOU?</GhostButton>
            </>
          )}

          {/* ── Reset: request email OTP ── */}
          {flow === "reset-email" && (
            <>
              <span style={label}>RESET YOUR ACCESS CODE</span>
              <div style={{ ...helper, marginBottom: 12 }}>
                Enter the email on your account and we&apos;ll send a 6-digit verification code.
              </div>
              <input className="pk-inp" placeholder="you@email.com" type="email" value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleResetRequest()} style={{ marginBottom: 14 }} />
              <ErrorNote>{error}</ErrorNote>
              <GoldButton disabled={busy} onClick={handleResetRequest}>
                {busy ? "SENDING..." : "EMAIL ME A CODE →"}
              </GoldButton>
              <GhostButton onClick={() => go("code")}>← BACK</GhostButton>
            </>
          )}

          {/* ── Reset: verify OTP ── */}
          {flow === "reset-token" && (
            <>
              <span style={label}>CHECK YOUR EMAIL</span>
              <div style={{ ...helper, marginBottom: 12 }}>
                We sent a 6-digit code to <b style={{ color: "#c9a84c" }}>{resetEmail}</b>. It expires
                in about an hour.
              </div>
              <input className="pk-inp" placeholder="123456" inputMode="numeric" value={resetToken}
                onChange={e => setResetToken(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleResetConfirm()} style={{ marginBottom: 14 }} />
              <ErrorNote>{error}</ErrorNote>
              <GoldButton disabled={busy} onClick={handleResetConfirm}>
                {busy ? "VERIFYING..." : "VERIFY →"}
              </GoldButton>
              <GhostButton onClick={() => go("reset-email")}>← DIFFERENT EMAIL</GhostButton>
            </>
          )}

          {/* ── Reset: several members share the email ── */}
          {flow === "reset-choose" && (
            <>
              <span style={{ ...label, marginBottom: 10 }}>WHICH ACCOUNT IS YOURS?</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
                {resetMatches.map(m => (
                  <button key={m.id} className="pk-btn pk-member-row"
                    onClick={() => { setSelectedMember(m); go("reset-newcode"); }}
                    style={{ background: "#070a0e", border: "1px solid #1e2530", borderRadius: 6,
                      padding: "11px 14px", textAlign: "left", color: "#d0c8b4", fontSize: 14,
                      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600 }}>
                    {m.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Reset: choose the new code ── */}
          {flow === "reset-newcode" && selectedMember && (
            <>
              <span style={label}>NEW ACCESS CODE FOR {selectedMember.name.toUpperCase()}</span>
              <div style={{ marginBottom: 6 }}>
                <CodeInput value={resetNewCode} onChange={setResetNewCode}
                  placeholder="At least 4 characters" withGenerate onEnter={handleResetNewCode} />
              </div>
              {hasBackup && (
                <div style={{ ...helper, marginBottom: 14 }}>
                  Your commissioner receives the refreshed backup copy.
                </div>
              )}
              <ErrorNote>{error}</ErrorNote>
              <GoldButton disabled={busy} onClick={handleResetNewCode}>
                {busy ? "SAVING..." : "SAVE & SIGN IN →"}
              </GoldButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// src/AuthCallback.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import { saveSession } from "./session";

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: "#0D1520",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
    gap: "16px",
    padding: "40px 24px",
    textAlign: "center",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #2A3A50",
    borderTop: "3px solid #C9A84C",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  title: { color: "#E8EDF2", fontSize: "18px", fontWeight: "700", margin: 0 },
  sub: { color: "#7A8A9A", fontSize: "14px", margin: 0, lineHeight: "1.6" },
  errorBox: {
    background: "#1A0D0D",
    border: "1px solid #4A1B1B",
    borderRadius: "8px",
    padding: "16px 20px",
    color: "#C0392B",
    fontSize: "14px",
    maxWidth: "400px",
    lineHeight: "1.6",
  },
};

const styleTag = document.createElement("style");
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleTag);

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const run = async () => {
      try {
        // 1. Read joinCode from query param
        const params = new URLSearchParams(window.location.search);
        const joinCode = params.get("league");
        if (!joinCode) throw new Error("No league code found in the link.");

        // 2. Get the verified session from Supabase Auth
        // Supabase automatically processes the token in the URL hash
        const { data: { session: authSession }, error: authError } =
          await supabase.auth.getSession();
        if (authError || !authSession)
          throw new Error("Could not verify your identity. The link may have expired.");

        const verifiedEmail = authSession.user.email;

        // 3. Fetch the league and check email matches
        const { data: league, error: leagueError } = await supabase
          .from("leagues")
          .select("commissioner_email")
          .eq("id", joinCode)
          .single();

        if (leagueError || !league)
          throw new Error("League not found.");

        if (!league.commissioner_email)
          throw new Error("No recovery email is set for this league.");

        if (league.commissioner_email.toLowerCase() !== verifiedEmail.toLowerCase())
          throw new Error("This email does not match the commissioner email on file.");

        // 4. Restore commissioner session and redirect
        saveSession(joinCode, [], "commissioner");
        navigate(`/join/${joinCode}`, { replace: true });

      } catch (err) {
        setError(err.message);
      }
    };

    run();
  }, []);

  if (error) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.title}>Recovery failed</div>
        <div style={styles.errorBox}>{error}</div>
        <div style={styles.sub}>
          Close this tab and try requesting a new recovery link.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.spinner} />
      <div style={styles.title}>Verifying your identity...</div>
      <div style={styles.sub}>You will be redirected shortly.</div>
    </div>
  );
}
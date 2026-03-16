// ─── COMMISSIONER ONLY ───────────────────────────────────────────────────────
// Wraps any element. Non-commissioners see a locked/disabled overlay instead.
export default function CommissionerOnly({ isCommissioner, label = "Commissioner only", children }) {
  if (isCommissioner) return children;
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <div style={{ opacity: 0.25, pointerEvents: "none", userSelect: "none" }}>
        {children}
      </div>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(7,10,14,0.55)",
        borderRadius: 6,
        cursor: "not-allowed",
      }}
        title={label}
      >
        <span style={{
          fontSize: 9, letterSpacing: ".14em", color: "#4a5a6a",
          fontFamily: "'Oswald',sans-serif", fontWeight: 600,
          background: "#0d1117", border: "1px solid #1e2530",
          borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap",
        }}>
          🔒 {label.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

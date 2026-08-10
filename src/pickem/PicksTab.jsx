// src/pickem/PicksTab.jsx — weekly pick entry
import { useState, useMemo } from "react";
import { isEventLocked } from "./pickemScoring";
import { PICK_MODES } from "./pickemConstants";

function fmtLock(lockAt) {
  if (!lockAt) return null;
  const d = new Date(lockAt);
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "Picks locked";
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs >= 48) return `Locks ${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
  if (hrs >= 1) return `Locks in ${hrs}h ${mins}m`;
  return `Locks in ${mins}m`;
}

// One side of a matchup — away/home button pair share this
function SideButton({ label, sub, selected, correct, disabled, onClick, align }) {
  // correct: true (green) | false (red) | null (no result yet)
  const border = selected
    ? (correct === true ? "1px solid #14532d" : correct === false ? "1px solid #7f1d1d" : "1px solid #c9a84c")
    : "1px solid #1e2530";
  const bg = selected
    ? (correct === true ? "#0a1e14" : correct === false ? "#1e0a0a" : "#c9a84c14")
    : "#070a0e";
  const color = selected
    ? (correct === true ? "#86efac" : correct === false ? "#fca5a5" : "#c9a84c")
    : "#9aa4ae";
  return (
    <button className="pk-side" disabled={disabled} onClick={onClick}
      style={{ flex: 1, minWidth: 0, border, background: bg, color,
        padding: "9px 12px", textAlign: align, fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: selected ? color : "#5a6470", fontWeight: 400,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
    </button>
  );
}

export default function PicksTab({ events, myPicks, pickMatch, pickDual }) {
  // Default to the first event still open for picks; else the most recent one
  const defaultEventId = useMemo(() => {
    const open = events.filter(e => !isEventLocked(e));
    if (open.length > 0) return open[0].id;
    return events.length > 0 ? events[events.length - 1].id : null;
  }, [events]);
  const [selectedId, setSelectedId] = useState(null);
  // Fall back to the default when the selected week no longer exists
  // (commissioner deleted it while this device was on it).
  const event = events.find(e => e.id === selectedId)
    ?? events.find(e => e.id === defaultEventId);

  if (events.length === 0) {
    return (
      <div className="pk-card" style={{ padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 30, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#e0d8b4", marginBottom: 8 }}>No weeks posted yet</div>
        <div style={{ fontSize: 14, color: "#6a7480", fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.7 }}>
          Your commissioner hasn&apos;t posted the first slate of duals.<br />Check back once Week 1 is up!
        </div>
      </div>
    );
  }

  const locked = event ? isEventLocked(event) : false;

  // Count my picks vs pickable slots for the progress bar
  let totalSlots = 0, pickedSlots = 0;
  if (event) {
    event.duals.forEach(d => {
      if (event.pick_mode === "matches") {
        (d.matches || []).forEach(mt => { totalSlots++; if (myPicks.byMatch[mt.id]) pickedSlots++; });
      } else {
        totalSlots++;
        if (myPicks.byDual[d.id]) pickedSlots++;
      }
    });
  }

  return (
    <div>
      {/* ── Week selector ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {events.map(e => {
          const active = event && e.id === event.id;
          const eLocked = isEventLocked(e);
          return (
            <button key={e.id} className="pk-btn" onClick={() => setSelectedId(e.id)}
              style={{ background: active ? "#c9a84c" : "#0b0f14",
                color: active ? "#070a0e" : eLocked ? "#5a6470" : "#c9a84c",
                border: active ? "none" : "1px solid #1e2530",
                borderRadius: 20, padding: "7px 16px", fontSize: 12, fontWeight: 700,
                letterSpacing: ".08em", whiteSpace: "nowrap" }}>
              WEEK {e.week_number}{eLocked ? " 🔒" : ""}
            </button>
          );
        })}
      </div>

      {event && (
        <>
          {/* ── Event header ── */}
          <div className="pk-card" style={{ padding: "16px 20px", marginBottom: 16,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#e0d8b4" }}>{event.title}</div>
              <div style={{ fontSize: 12, color: "#6a7480", fontFamily: "'Barlow Condensed',sans-serif", marginTop: 3 }}>
                {PICK_MODES[event.pick_mode]?.label || event.pick_mode} · {event.duals.length}{" "}
                {event.duals.length === 1 ? "dual" : "duals"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em",
                color: locked ? "#b04040" : "#34d399" }}>
                {event.status === "final" ? "✓ FINAL" : locked ? "🔒 PICKS LOCKED" : (fmtLock(event.lock_at) || "OPEN FOR PICKS")}
              </div>
              {totalSlots > 0 && (
                <div style={{ fontSize: 12, color: "#6a7480", fontFamily: "'Barlow Condensed',sans-serif", marginTop: 3 }}>
                  {pickedSlots}/{totalSlots} picks made
                </div>
              )}
            </div>
          </div>

          {event.duals.length === 0 && (
            <div className="pk-card" style={{ padding: "32px 24px", textAlign: "center", color: "#6a7480",
              fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14 }}>
              No duals added to this week yet.
            </div>
          )}

          {/* ── Dual cards ── */}
          {event.duals.map(dual => (
            <div key={dual.id} className="pk-card" style={{ marginBottom: 16 }}>
              <div style={{ padding: "12px 20px", background: "#0a1018", borderBottom: "1px solid #1a1f26",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e0d8b4" }}>
                  {dual.away_team} <span style={{ color: "#6a5a30", fontWeight: 400 }}>at</span> {dual.home_team}
                </div>
                {dual.winner && dual.home_score != null && dual.away_score != null && (
                  <div style={{ fontSize: 13, color: "#c9a84c", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>
                    FINAL {dual.away_score}–{dual.home_score}
                  </div>
                )}
              </div>

              {event.pick_mode === "matches" ? (
                <div style={{ padding: "10px 14px" }}>
                  {!locked && (
                    <div style={{ fontSize: 11, color: "#4a5260", fontFamily: "'Barlow Condensed',sans-serif",
                      padding: "0 2px 6px", lineHeight: 1.5 }}>
                      Lineups are projected — you&apos;re picking the <b style={{ color: "#6a7480" }}>team side</b> at
                      each weight, and your pick stands even if a different wrestler steps in.
                    </div>
                  )}
                  {(dual.matches || []).map(mt => {
                    const mine = myPicks.byMatch[mt.id];
                    const decided = !!mt.winner;
                    return (
                      <div key={mt.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                        <SideButton
                          label={mt.away_wrestler || dual.away_team}
                          sub={mt.away_wrestler ? dual.away_team : null}
                          selected={mine === "away"}
                          correct={decided && mine === "away" ? mt.winner === "away" : null}
                          disabled={locked}
                          onClick={() => pickMatch(event, mt.id, "away")}
                          align="right" />
                        <div style={{ width: 46, textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#c9a84c" }}>{mt.weight}</div>
                          {decided && (
                            <div style={{ fontSize: 9, color: "#6a5a30", letterSpacing: ".08em" }}>
                              {mt.winner === "away" ? "◀" : "▶"} {mt.win_type || ""}
                            </div>
                          )}
                        </div>
                        <SideButton
                          label={mt.home_wrestler || dual.home_team}
                          sub={mt.home_wrestler ? dual.home_team : null}
                          selected={mine === "home"}
                          correct={decided && mine === "home" ? mt.winner === "home" : null}
                          disabled={locked}
                          onClick={() => pickMatch(event, mt.id, "home")}
                          align="left" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  <SideButton
                    label={dual.away_team}
                    sub="Away"
                    selected={myPicks.byDual[dual.id] === "away"}
                    correct={dual.winner && myPicks.byDual[dual.id] === "away" ? dual.winner === "away" : null}
                    disabled={locked}
                    onClick={() => pickDual(event, dual.id, "away")}
                    align="center" />
                  <div style={{ fontSize: 11, color: "#6a5a30", letterSpacing: ".1em", flexShrink: 0 }}>VS</div>
                  <SideButton
                    label={dual.home_team}
                    sub="Home"
                    selected={myPicks.byDual[dual.id] === "home"}
                    correct={dual.winner && myPicks.byDual[dual.id] === "home" ? dual.winner === "home" : null}
                    disabled={locked}
                    onClick={() => pickDual(event, dual.id, "home")}
                    align="center" />
                </div>
              )}
            </div>
          ))}

          {!locked && totalSlots > 0 && pickedSlots < totalSlots && (
            <div style={{ textAlign: "center", fontSize: 13, color: "#6a5a30",
              fontFamily: "'Barlow Condensed',sans-serif" }}>
              Picks save instantly — you can change any pick until the week locks.
            </div>
          )}
        </>
      )}
    </div>
  );
}

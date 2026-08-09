// src/pickem/ResultsTab.jsx — week-by-week results with your pick outcomes
import { useMemo } from "react";
import { scoreEventForMember, isEventLocked } from "./pickemScoring";
import { WIN_TYPES } from "./pickemConstants";

const winTypeLabel = (code) => WIN_TYPES.find(w => w.code === code)?.label || code || "";

function PickMark({ mine, winner }) {
  if (!winner) return null;
  if (!mine) return <span style={{ color: "#3a4250", fontSize: 11 }}>no pick</span>;
  const correct = mine === winner;
  return (
    <span style={{ color: correct ? "#34d399" : "#f87171", fontSize: 12, fontWeight: 700 }}>
      {correct ? "✓" : "✗"}
    </span>
  );
}

export default function ResultsTab({ events, myPicks, scoring, members = [], picks = [] }) {
  // Newest first; only show weeks that are at least locked (results in progress)
  const visible = [...events].reverse().filter(e => isEventLocked(e));

  // Per-member pick indexes, for computing each finalized week's winner
  const picksByMember = useMemo(() => {
    const map = {};
    picks.forEach(p => {
      if (!map[p.member_id]) map[p.member_id] = { byMatch: {}, byDual: {} };
      if (p.match_id) map[p.member_id].byMatch[p.match_id] = p.pick;
      if (p.dual_id) map[p.member_id].byDual[p.dual_id] = p.pick;
    });
    return map;
  }, [picks]);

  const weekWinners = (event) => {
    if (event.status !== "final" || members.length === 0) return null;
    const scored = members.map(m => ({
      name: m.name,
      points: scoreEventForMember(event, picksByMember[m.id] || {}, scoring).points,
    }));
    const top = Math.max(...scored.map(s => s.points));
    if (top <= 0) return null;
    return { points: top, names: scored.filter(s => s.points === top).map(s => s.name) };
  };

  if (visible.length === 0) {
    return (
      <div className="pk-card" style={{ padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 30, marginBottom: 12 }}>🏁</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#e0d8b4", marginBottom: 8 }}>No results yet</div>
        <div style={{ fontSize: 14, color: "#6a7480", fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.7 }}>
          Results appear here after a week locks and the commissioner enters what happened on the mat.
        </div>
      </div>
    );
  }

  return (
    <div>
      {visible.map(event => {
        const myScore = scoreEventForMember(event, myPicks, scoring);
        const winners = weekWinners(event);
        return (
          <div key={event.id} style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
              marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
              <div>
                <span style={{ fontSize: 11, letterSpacing: ".18em", color: "#6a5a30", marginRight: 10 }}>
                  WEEK {event.week_number}
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#e0d8b4" }}>{event.title}</span>
                <span style={{ marginLeft: 10, fontSize: 11, letterSpacing: ".1em",
                  color: event.status === "final" ? "#34d399" : "#d97706" }}>
                  {event.status === "final" ? "FINAL" : "IN PROGRESS"}
                </span>
              </div>
              {event.status === "final" && (
                <div style={{ fontSize: 14, color: "#c9a84c", fontWeight: 700 }}>
                  You: {myScore.points} pts
                  <span style={{ fontSize: 12, color: "#6a7480", fontWeight: 400,
                    fontFamily: "'Barlow Condensed',sans-serif", marginLeft: 6 }}>
                    ({myScore.correct}/{myScore.total})
                  </span>
                </div>
              )}
            </div>

            {winners && (
              <div style={{ background: "#0a1018", border: "1px solid #c9a84c33", borderRadius: 8,
                padding: "8px 14px", marginBottom: 10, fontSize: 13,
                fontFamily: "'Barlow Condensed',sans-serif", color: "#c9a84c", fontWeight: 700 }}>
                🏆 Week won by {winners.names.join(" & ")} · {winners.points} pts
              </div>
            )}

            {event.duals.map(dual => (
              <div key={dual.id} className="pk-card" style={{ marginBottom: 12 }}>
                <div style={{ padding: "10px 18px", background: "#0a1018", borderBottom: "1px solid #1a1f26",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e0d8b4" }}>
                    {dual.away_team} <span style={{ color: "#6a5a30", fontWeight: 400 }}>at</span> {dual.home_team}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {dual.home_score != null && dual.away_score != null && (
                      <span style={{ fontSize: 13, color: "#c9a84c", fontWeight: 700,
                        fontFamily: "'Barlow Condensed',sans-serif" }}>
                        {dual.away_score}–{dual.home_score}
                      </span>
                    )}
                    {event.pick_mode === "duals" && (
                      <PickMark mine={myPicks.byDual[dual.id]} winner={dual.winner} />
                    )}
                  </div>
                </div>

                {event.pick_mode === "matches" && (
                  <div style={{ padding: "6px 18px 10px" }}>
                    {(dual.matches || []).map(mt => {
                      const mine = myPicks.byMatch[mt.id];
                      const winnerName = mt.winner === "away"
                        ? (mt.away_wrestler || dual.away_team)
                        : mt.winner === "home" ? (mt.home_wrestler || dual.home_team) : null;
                      return (
                        <div key={mt.id} style={{ display: "flex", alignItems: "center", gap: 10,
                          padding: "6px 0", borderBottom: "1px solid #10151c",
                          fontFamily: "'Barlow Condensed',sans-serif" }}>
                          <div style={{ width: 34, fontSize: 12, fontWeight: 700, color: "#c9a84c", flexShrink: 0 }}>
                            {mt.weight}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#9aa4ae",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {mt.winner ? (
                              <>
                                <span style={{ color: "#d0c8b4", fontWeight: 600 }}>{winnerName}</span>
                                <span style={{ color: "#5a6470" }}> — {winTypeLabel(mt.win_type)}</span>
                              </>
                            ) : (
                              <span style={{ color: "#3a4250" }}>awaiting result</span>
                            )}
                          </div>
                          <PickMark mine={mine} winner={mt.winner} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

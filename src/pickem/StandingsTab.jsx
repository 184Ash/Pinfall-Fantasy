// src/pickem/StandingsTab.jsx — season leaderboard
import { useMemo } from "react";
import { computeStandings } from "./pickemScoring";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function StandingsTab({ members, events, picks, scoring, myMemberId }) {
  const standings = useMemo(
    () => computeStandings(members, events, picks, scoring),
    [members, events, picks, scoring]
  );
  const finalWeeks = events.filter(e => e.status === "final").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 14, flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 11, letterSpacing: ".2em", color: "#6a5a30" }}>SEASON STANDINGS</div>
        <div style={{ fontSize: 12, color: "#6a7480", fontFamily: "'Barlow Condensed',sans-serif" }}>
          {finalWeeks} {finalWeeks === 1 ? "week" : "weeks"} scored
        </div>
      </div>

      <div className="pk-card">
        {standings.length === 0 && (
          <div style={{ padding: "32px 24px", textAlign: "center", color: "#6a7480",
            fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14 }}>
            Nobody has joined the pool yet.
          </div>
        )}
        {standings.map((row, i) => {
          const isMe = row.member.id === myMemberId;
          return (
            <div key={row.member.id} style={{ display: "flex", alignItems: "center", gap: 14,
              padding: "13px 20px", borderBottom: i < standings.length - 1 ? "1px solid #131820" : "none",
              background: isMe ? "#c9a84c0a" : "transparent" }}>
              <div style={{ width: 34, textAlign: "center", flexShrink: 0, fontSize: i < 3 ? 18 : 14,
                fontWeight: 700, color: "#6a5a30" }}>
                {i < 3 && finalWeeks > 0 ? MEDALS[i] : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif",
                  color: isMe ? "#c9a84c" : "#d0c8b4", overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap" }}>
                  {row.member.name}
                  {isMe && <span style={{ fontSize: 10, color: "#6a5a30", marginLeft: 8, letterSpacing: ".12em",
                    fontFamily: "'Oswald',sans-serif" }}>YOU</span>}
                  {row.member.role === "commissioner" && (
                    <span style={{ fontSize: 10, color: "#3a4250", marginLeft: 8, letterSpacing: ".12em",
                      fontFamily: "'Oswald',sans-serif" }}>COMM</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#5a6470", fontFamily: "'Barlow Condensed',sans-serif" }}>
                  {row.correct}/{row.total} correct
                  {row.perfectCards > 0 && ` · ${row.perfectCards} perfect ${row.perfectCards === 1 ? "card" : "cards"} 💯`}
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#c9a84c", flexShrink: 0 }}>
                {row.points}
                <span style={{ fontSize: 11, color: "#6a5a30", marginLeft: 3 }}>PTS</span>
              </div>
            </div>
          );
        })}
      </div>

      {finalWeeks === 0 && standings.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#6a5a30",
          fontFamily: "'Barlow Condensed',sans-serif" }}>
          Standings populate once the commissioner finalizes the first week&apos;s results.
        </div>
      )}
    </div>
  );
}

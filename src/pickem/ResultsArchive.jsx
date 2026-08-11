// ─── RESULTS ARCHIVE ──────────────────────────────────────────────────────────
// Every 2026-27 D1 in-conference dual in one place, filterable by conference,
// team and week — so nobody has to dig through FloWrestling or eight different
// athletics sites.
//
// It merges two sources:
//   1. the schedule dataset (src/pickem/data/…json) — all 282 expected duals,
//      which makes this a useful schedule browser BEFORE any results exist, and
//   2. pickem_dual_results — the shared, pool-agnostic results table that fills
//      in as commissioners finalize weeks (and later, as the scraper runs).
//
// Renders standalone at /results and as the Archive tab inside a pool.
import { useState, useEffect, useMemo } from "react";
import { loadSchedule, teamName, dualDateLabel, weekRangeLabel } from "./schedule";
import { loadDualResults } from "./pickemService";
import { CONFERENCES, CONFERENCE_BY_ID } from "./conferences";
import { WIN_TYPES, PICKEM_SEASON } from "./pickemConstants";

const winTypeLabel = (code) => WIN_TYPES.find(w => w.code === code)?.label || code || "";

const standaloneCss = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#070a0e;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:#0d1117;}
::-webkit-scrollbar-thumb{background:#c9a84c66;border-radius:3px;}
.pk-btn{cursor:pointer;border:none;transition:all .13s;font-family:'Oswald',sans-serif;}
.pk-btn:hover:not(:disabled){filter:brightness(1.18);}
.pk-card{background:#0b0f14;border:1px solid #1a1f26;border-radius:10px;overflow:hidden;}
.pk-inp{background:#070a0e;border:1px solid #1e2530;border-radius:6px;color:#d0c8b4;
  font-family:'Barlow Condensed',sans-serif;font-size:14px;padding:8px 11px;width:100%;}
.pk-inp:focus{outline:none;border-color:#c9a84c;box-shadow:0 0 0 2px #c9a84c22;}
select.pk-inp{cursor:pointer;}
.arch-row:hover{background:#c9a84c08;}
`;

const label = { display: "block", fontSize: 10, letterSpacing: ".16em", color: "#6a5a30", marginBottom: 5 };

function ResultBadge({ dual, result }) {
  if (result?.winner) {
    const hasScore = result.home_score != null && result.away_score != null;
    return (
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#c9a84c",
          fontFamily: "'Barlow Condensed',sans-serif" }}>
          {hasScore ? `${result.away_score}–${result.home_score}` : (result.winner === "home" ? "HOME W" : "AWAY W")}
        </div>
        <div style={{ fontSize: 9, letterSpacing: ".12em", color: "#34d399" }}>
          FINAL{result.report_count > 1 ? ` · ${result.report_count}×` : ""}
          {result.disputed ? " · ⚠" : ""}
        </div>
      </div>
    );
  }
  const date = dualDateLabel(dual);
  return (
    <div style={{ textAlign: "right", flexShrink: 0 }}>
      <div style={{ fontSize: 12, color: "#5a6470", fontFamily: "'Barlow Condensed',sans-serif" }}>
        {date || "date TBD"}
      </div>
      <div style={{ fontSize: 9, letterSpacing: ".12em",
        color: dual.status === "confirmed" ? "#6a7480" : "#3a4250" }}>
        {dual.status === "confirmed" ? "SCHEDULED" : "PROJECTED"}
      </div>
    </div>
  );
}

function DualRow({ dual, schedule, result }) {
  const [open, setOpen] = useState(false);
  const conf = CONFERENCE_BY_ID[dual.conference];
  const bouts = result?.bouts_json || [];
  const away = teamName(schedule, dual.away);
  const home = teamName(schedule, dual.home);
  const winnerSide = result?.winner;

  return (
    <div style={{ borderBottom: "1px solid #131820" }}>
      <button type="button" className="pk-btn arch-row" onClick={() => bouts.length && setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
          background: "none", padding: "11px 16px", cursor: bouts.length ? "pointer" : "default" }}>
        <span style={{ width: 46, flexShrink: 0, fontSize: 11, fontWeight: 700,
          color: "#6a5a30", letterSpacing: ".04em" }}>
          {conf?.short || dual.conference}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <b style={{ color: winnerSide === "away" ? "#e0d8b4" : "#9aa4ae",
            fontWeight: winnerSide === "away" ? 700 : 600 }}>{away}</b>
          <span style={{ color: "#4a5260", fontWeight: 400 }}> at </span>
          <b style={{ color: winnerSide === "home" ? "#e0d8b4" : "#9aa4ae",
            fontWeight: winnerSide === "home" ? 700 : 600 }}>{home}</b>
        </span>
        <ResultBadge dual={dual} result={result} />
        {bouts.length > 0 && (
          <span style={{ width: 14, flexShrink: 0, fontSize: 10, color: "#6a5a30" }}>
            {open ? "▲" : "▼"}
          </span>
        )}
      </button>

      {open && bouts.length > 0 && (
        <div style={{ padding: "4px 16px 12px 74px", background: "#080b10" }}>
          {bouts.map(b => {
            const winnerName = b.winner === "away"
              ? (b.away_wrestler || away) : (b.home_wrestler || home);
            return (
              <div key={b.weight} style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "4px 0", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13 }}>
                <span style={{ width: 34, flexShrink: 0, fontWeight: 700, color: "#c9a84c" }}>{b.weight}</span>
                <span style={{ flex: 1, minWidth: 0, color: "#d0c8b4", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {winnerName}
                  <span style={{ color: "#4a5260" }}> ({b.winner === "away" ? "away" : "home"})</span>
                </span>
                <span style={{ flexShrink: 0, fontSize: 11, color: "#6a7480" }}>
                  {winTypeLabel(b.win_type)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ResultsArchive({ standalone = false }) {
  const [schedule, setSchedule] = useState(null);
  const [results, setResults] = useState({});
  const [loadError, setLoadError] = useState(false);
  const [conference, setConference] = useState("all");
  const [team, setTeam] = useState("all");
  const [week, setWeek] = useState("all");
  const [finalOnly, setFinalOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadSchedule(),
      loadDualResults().catch(() => []), // archive still works if the table is empty/missing
    ]).then(([sched, rows]) => {
      if (cancelled) return;
      setSchedule(sched);
      setResults(Object.fromEntries(rows.map(r => [r.source_dual_id, r])));
    }).catch(() => {
      if (!cancelled) setLoadError(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Teams available in the current conference filter
  const teamOptions = useMemo(() => {
    if (!schedule) return [];
    return schedule.teams
      .filter(t => conference === "all" || t.conference === conference)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [schedule, conference]);

  // Switching conference clears a team that no longer belongs to it.
  const changeConference = (next) => {
    setConference(next);
    if (team !== "all" && schedule) {
      const stillValid = next === "all" || schedule.teams.some(t => t.id === team && t.conference === next);
      if (!stillValid) setTeam("all");
    }
  };

  const filtered = useMemo(() => {
    if (!schedule) return [];
    return schedule.duals.filter(d => {
      if (conference !== "all" && d.conference !== conference) return false;
      if (team !== "all" && d.home !== team && d.away !== team) return false;
      if (week !== "all" && d.week !== week) return false;
      if (finalOnly && !results[d.id]?.winner) return false;
      return true;
    });
  }, [schedule, conference, team, week, finalOnly, results]);

  // Group by week for scannability; undated duals collect at the end
  const grouped = useMemo(() => {
    if (!schedule) return [];
    const byWeek = new Map();
    filtered.forEach(d => {
      const key = d.week || "unscheduled";
      if (!byWeek.has(key)) byWeek.set(key, []);
      byWeek.get(key).push(d);
    });
    const order = schedule.weekAxis.map(w => w.tag);
    return [...byWeek.entries()]
      .sort((a, b) => {
        if (a[0] === "unscheduled") return 1;
        if (b[0] === "unscheduled") return -1;
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      })
      .map(([tag, duals]) => ({
        tag,
        axis: schedule.weekAxis.find(w => w.tag === tag),
        duals: duals.sort((a, b) =>
          (a.date || "9999").localeCompare(b.date || "9999") || a.id.localeCompare(b.id)),
      }));
  }, [filtered, schedule]);

  const finalCount = filtered.filter(d => results[d.id]?.winner).length;

  const body = () => {
    if (loadError) {
      return (
        <div className="pk-card" style={{ padding: "40px 24px", textAlign: "center", color: "#b04040",
          fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14 }}>
          Couldn&apos;t load the schedule archive. Refresh to try again.
        </div>
      );
    }
    if (!schedule) {
      return (
        <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12,
          letterSpacing: ".14em", color: "#6a5a30" }}>
          LOADING ARCHIVE…
        </div>
      );
    }
    return (
      <>
        {/* ── Filters ── */}
        <div className="pk-card" style={{ padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ minWidth: 170, flex: 1 }}>
              <span style={label}>CONFERENCE</span>
              <select className="pk-inp" value={conference} onChange={e => changeConference(e.target.value)}>
                <option value="all">All conferences</option>
                {CONFERENCES.map(c => (
                  <option key={c.id} value={c.id}>{c.short} — {c.name}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 170, flex: 1 }}>
              <span style={label}>TEAM</span>
              <select className="pk-inp" value={team} onChange={e => setTeam(e.target.value)}>
                <option value="all">All teams{conference !== "all" ? " in conference" : ""}</option>
                {teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 160, flex: 1 }}>
              <span style={label}>WEEK</span>
              <select className="pk-inp" value={week} onChange={e => setWeek(e.target.value)}>
                <option value="all">Whole season</option>
                {schedule.weekAxis.map(w => (
                  <option key={w.tag} value={w.tag}>{weekRangeLabel(w)}</option>
                ))}
              </select>
            </div>
            <button className="pk-btn" onClick={() => setFinalOnly(f => !f)}
              style={{ background: finalOnly ? "#c9a84c14" : "transparent",
                border: finalOnly ? "1px solid #c9a84c" : "1px solid #1e2530",
                color: finalOnly ? "#c9a84c" : "#7a8a9a", borderRadius: 6,
                padding: "9px 14px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em",
                whiteSpace: "nowrap" }}>
              {finalOnly ? "✓ " : ""}RESULTS ONLY
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#5a6470",
            fontFamily: "'Barlow Condensed',sans-serif" }}>
            {filtered.length} dual{filtered.length === 1 ? "" : "s"} · {finalCount} with results
            {(conference !== "all" || team !== "all" || week !== "all" || finalOnly) && (
              <button className="pk-btn" onClick={() => {
                setConference("all"); setTeam("all"); setWeek("all"); setFinalOnly(false);
              }}
                style={{ background: "none", color: "#6a5a30", fontSize: 11,
                  letterSpacing: ".1em", marginLeft: 10, textDecoration: "underline" }}>
                CLEAR FILTERS
              </button>
            )}
          </div>
        </div>

        {/* ── Grouped dual list ── */}
        {grouped.length === 0 && (
          <div className="pk-card" style={{ padding: "32px 24px", textAlign: "center",
            color: "#6a7480", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14 }}>
            No duals match these filters.
          </div>
        )}
        {grouped.map(group => (
          <div key={group.tag} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: ".18em", color: "#6a5a30", marginBottom: 6 }}>
              {group.axis ? weekRangeLabel(group.axis).toUpperCase() : "DATES NOT YET PUBLISHED"}
              <span style={{ color: "#3a4250" }}> · {group.duals.length}</span>
            </div>
            <div className="pk-card">
              {group.duals.map(d => (
                <DualRow key={d.id} dual={d} schedule={schedule} result={results[d.id]} />
              ))}
            </div>
          </div>
        ))}

        {finalCount === 0 && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#4a5260",
            fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.7, marginTop: 8 }}>
            Results fill in as the season runs — the {PICKEM_SEASON} campaign opens Nov 9, 2026.<br />
            Dates shown as &ldquo;projected&rdquo; come from the preseason schedule map and firm up in the fall.
          </div>
        )}
      </>
    );
  };

  if (!standalone) return <div>{body()}</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", color: "#d0c8b4",
      fontFamily: "'Oswald',sans-serif" }}>
      <style>{standaloneCss}</style>
      <div style={{ borderBottom: "1px solid #1a1f26", background: "#0b0f14" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px" }}>
          <div style={{ fontSize: 10, letterSpacing: ".22em", color: "#6a5a30" }}>
            {PICKEM_SEASON} NCAA DIVISION I WRESTLING
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#c9a84c", letterSpacing: ".03em" }}>
            Dual Meet Results
          </h1>
          <div style={{ fontSize: 13, color: "#6a7480", fontFamily: "'Barlow Condensed',sans-serif",
            marginTop: 4 }}>
            Every in-conference dual, all eight conferences — one place, no digging.
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "18px 16px 60px" }}>
        {body()}
      </div>
    </div>
  );
}

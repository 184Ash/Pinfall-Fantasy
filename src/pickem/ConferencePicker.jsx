// ─── CONFERENCE PICKER ────────────────────────────────────────────────────────
// Defines the pool's scope: which conferences are in play, and optionally which
// teams within each conference are followed (the chevron breaks a conference
// out into team chips). Pricing follows the pick mode (Full Card = 10× Duals
// Only), so the mode control should always sit ABOVE this picker — see
// docs/dual-schedule-scale.md.
//
// Team-scope rule: a dual stays in the slate when it features at least one
// followed team. Team-filtered load numbers are ~estimates — they scale each
// conference's weekly histogram by its kept-dual fraction (schedule.js).
import { useState, useEffect, useMemo } from "react";
import {
  CONFERENCES, CONFERENCE_PRESETS, summarizeSelection, conferenceBlurb,
} from "./conferences";
import {
  loadSchedule, teamsForConference, keptDualStats, summarizeScopedSelection,
} from "./schedule";

// Icon + color per load band — the verdict must read without color alone.
const BAND_STYLE = {
  light:     { color: "#34d399", icon: "✓" },
  standard:  { color: "#c9a84c", icon: "●" },
  heavy:     { color: "#d97706", icon: "▲" },
  veryHeavy: { color: "#f87171", icon: "⚠" },
  extreme:   { color: "#ef4444", icon: "⛔" },
};

const sameSet = (a, b) => a.length === b.length && a.every(id => b.includes(id));

// ── Team breakout panel for one expanded conference ──────────────────────────
function TeamPanel({ conf, schedule, followed, onFollowedChange }) {
  const teams = useMemo(() => teamsForConference(schedule, conf.id), [schedule, conf.id]);
  const allIds = teams.map(t => t.id);
  const active = followed ?? allIds; // no filter = all followed

  const setList = (list) =>
    onFollowedChange(list.length === allIds.length ? null : list); // full list = drop the filter

  const toggleTeam = (id) =>
    setList(active.includes(id) ? active.filter(x => x !== id) : [...active, id]);

  return (
    <div style={{ border: "1px solid #1e2530", borderTop: "none", borderRadius: "0 0 8px 8px",
      background: "#0a0e13", padding: "12px 14px", marginTop: -6, marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10, gap: 10 }}>
        <span style={{ fontSize: 10, letterSpacing: ".16em", color: "#6a5a30",
          fontFamily: "'Oswald',sans-serif" }}>
          FOLLOWED TEAMS — {active.length} OF {allIds.length}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="pk-btn" onClick={() => setList(allIds)}
            style={{ background: "none", border: "1px solid #1e2530", borderRadius: 4,
              color: "#7a8a9a", fontSize: 10, padding: "3px 10px", letterSpacing: ".1em" }}>
            ALL
          </button>
          <button type="button" className="pk-btn" onClick={() => setList([])}
            style={{ background: "none", border: "1px solid #1e2530", borderRadius: 4,
              color: "#7a8a9a", fontSize: 10, padding: "3px 10px", letterSpacing: ".1em" }}>
            NONE
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: 6, marginBottom: 10 }}>
        {teams.map(t => {
          const on = active.includes(t.id);
          return (
            <button key={t.id} type="button" className="pk-btn" onClick={() => toggleTeam(t.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                background: on ? "#c9a84c10" : "transparent",
                border: on ? "1px solid #c9a84c55" : "1px solid #1e2530",
                borderRadius: 6, padding: "6px 10px" }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                border: on ? "none" : "1px solid #2a3040",
                background: on ? "#c9a84c" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#070a0e", fontSize: 10, fontWeight: 700 }}>
                {on ? "✓" : ""}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: on ? "#d0c8b4" : "#6a7480",
                fontFamily: "'Barlow Condensed',sans-serif", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "#4a5260", fontFamily: "'Barlow Condensed',sans-serif",
        lineHeight: 1.5 }}>
        A dual stays in the slate when it features at least one followed team — unfollow the
        teams you don&apos;t care about and head-to-heads between them drop out.
      </div>
    </div>
  );
}

export default function ConferencePicker({ selected, onChange, pickMode, teamScope = {}, onTeamScopeChange }) {
  const teamsEnabled = typeof onTeamScopeChange === "function";
  const [expandedId, setExpandedId] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const hasFilters = teamsEnabled && Object.keys(teamScope).length > 0;

  // The dataset is only needed for team breakouts — load it lazily on first
  // expand, or immediately when a saved team filter is already active.
  useEffect(() => {
    if (!teamsEnabled || schedule) return;
    if (!expandedId && !hasFilters) return;
    let cancelled = false;
    loadSchedule().then(data => { if (!cancelled) setSchedule(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [teamsEnabled, schedule, expandedId, hasFilters]);

  const summary = useMemo(() => {
    if (hasFilters && schedule) return summarizeScopedSelection(schedule, selected, teamScope, pickMode);
    return { ...summarizeSelection(selected, pickMode), filtered: false };
  }, [selected, pickMode, teamScope, schedule, hasFilters]);
  const band = BAND_STYLE[summary.band.key] || BAND_STYLE.standard;
  const approx = summary.filtered ? "~" : "";
  // Guardrail from the scale analysis: Full Card beyond 2 conferences peaks
  // at 280+ picks in one week — warn loudly before someone builds that pool.
  const fullCardOverload = pickMode === "matches" && selected.length > 2 && summary.picksPeak > 150;

  const stats = useMemo(
    () => (schedule && hasFilters ? keptDualStats(schedule, selected, teamScope) : null),
    [schedule, hasFilters, selected, teamScope]);

  // Conference-set changes prune team filters for dropped conferences.
  const changeSelection = (ids) => {
    onChange(ids);
    if (!teamsEnabled) return;
    const pruned = Object.fromEntries(
      Object.entries(teamScope).filter(([confId]) => ids.includes(confId)));
    if (Object.keys(pruned).length !== Object.keys(teamScope).length) onTeamScopeChange(pruned);
  };

  const toggle = (id) =>
    changeSelection(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const setFollowed = (confId, list) => {
    const next = { ...teamScope };
    if (list === null) delete next[confId]; else next[confId] = list;
    onTeamScopeChange(next);
  };

  return (
    <div>
      {/* ── Presets ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {CONFERENCE_PRESETS.map(p => {
          const active = sameSet(selected, p.ids) && !hasFilters;
          return (
            <button key={p.id} type="button" className="pk-btn" title={p.note}
              onClick={() => { changeSelection([...p.ids]); if (teamsEnabled && hasFilters) onTeamScopeChange({}); }}
              style={{ background: active ? "#c9a84c" : "transparent",
                color: active ? "#070a0e" : "#9aa4ae",
                border: active ? "1px solid #c9a84c" : "1px solid #1e2530",
                borderRadius: 20, padding: "5px 14px", fontSize: 11, fontWeight: 700,
                letterSpacing: ".08em" }}>
              {p.label.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* ── Conference rows ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {CONFERENCES.map(c => {
          const on = selected.includes(c.id);
          const followed = teamScope[c.id];
          const expanded = expandedId === c.id;
          const kept = stats?.[c.id];
          return (
            <div key={c.id}>
              <div style={{ display: "flex", alignItems: "stretch", gap: 0,
                background: on ? "#c9a84c10" : "#070a0e",
                border: on ? "1px solid #c9a84c66" : "1px solid #1e2530",
                borderRadius: expanded ? "8px 8px 0 0" : 8, overflow: "hidden" }}>
                <button type="button" className="pk-btn" onClick={() => toggle(c.id)}
                  style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12,
                    textAlign: "left", background: "none", border: "none", padding: "10px 14px" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: on ? "none" : "1px solid #2a3040",
                    background: on ? "#c9a84c" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#070a0e", fontSize: 12, fontWeight: 700 }}>
                    {on ? "✓" : ""}
                  </div>
                  <div style={{ width: 52, flexShrink: 0, fontSize: 14, fontWeight: 700,
                    color: on ? "#c9a84c" : "#7a8a9a", letterSpacing: ".04em" }}>
                    {c.short}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: on ? "#e0d8b4" : "#9aa4ae",
                      fontFamily: "'Barlow Condensed',sans-serif",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                      {c.broadcastTier === "linear" && (
                        <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: ".12em",
                          color: "#070a0e", background: on ? "#c9a84c" : "#4a5260",
                          borderRadius: 2, padding: "1px 5px", verticalAlign: "middle",
                          fontFamily: "'Oswald',sans-serif" }}>
                          TV
                        </span>
                      )}
                      {followed && (
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                          color: "#c9a84c", border: "1px solid #c9a84c44", borderRadius: 2,
                          padding: "1px 6px", verticalAlign: "middle",
                          fontFamily: "'Oswald',sans-serif" }}>
                          {followed.length}/{c.teamCount} TEAMS{kept ? ` · ${kept.kept} DUALS` : ""}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#5a6470", fontFamily: "'Barlow Condensed',sans-serif",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {conferenceBlurb(c.id, pickMode)} — {c.tagline}
                    </div>
                  </div>
                </button>
                {teamsEnabled && (
                  <button type="button" className="pk-btn" aria-label={`Choose ${c.short} teams`}
                    onClick={() => setExpandedId(expanded ? null : c.id)}
                    style={{ flexShrink: 0, width: 44, background: "none", border: "none",
                      borderLeft: on ? "1px solid #c9a84c33" : "1px solid #1a1f26",
                      color: expanded || followed ? "#c9a84c" : "#5a6470", fontSize: 12 }}>
                    {expanded ? "▲" : "▼"}
                  </button>
                )}
              </div>
              {expanded && (
                schedule ? (
                  <TeamPanel conf={c} schedule={schedule} followed={followed}
                    onFollowedChange={(list) => setFollowed(c.id, list)} />
                ) : (
                  <div style={{ border: "1px solid #1e2530", borderTop: "none",
                    borderRadius: "0 0 8px 8px", background: "#0a0e13", padding: "12px 14px",
                    marginTop: -6, marginBottom: 6, fontSize: 11, letterSpacing: ".14em",
                    color: "#6a5a30" }}>
                    LOADING TEAMS…
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* ── Running total + load verdict ── */}
      <div style={{ background: "#070a0e", border: "1px solid #1e2530",
        borderLeft: `3px solid ${band.color}`, borderRadius: 8, padding: "12px 16px" }}>
        {summary.duals === 0 ? (
          <div style={{ fontSize: 13, color: "#6a7480", fontFamily: "'Barlow Condensed',sans-serif" }}>
            {selected.length === 0
              ? "Pick at least one conference to build a slate."
              : "No duals left in scope — follow at least one team."}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", color: band.color,
                fontFamily: "'Oswald',sans-serif" }}>
                {band.icon} {summary.band.label.toUpperCase()}
              </span>
              <span style={{ fontSize: 13, color: "#9aa4ae", fontFamily: "'Barlow Condensed',sans-serif" }}>
                Typical week: <b style={{ color: "#e0d8b4" }}>{approx}{summary.picksTypical} picks</b>
                &nbsp;·&nbsp; Busiest week: <b style={{ color: "#e0d8b4" }}>{approx}{summary.picksPeak}</b>
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#5a6470", fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.6 }}>
              {summary.conferences} conference{summary.conferences > 1 ? "s" : ""} · {summary.teams} teams
              · {approx}{summary.duals} duals · {approx}{summary.picksSeason.toLocaleString()}{" "}
              {pickMode === "matches" ? "match picks" : "dual picks"} across {summary.weeks} weeks.{" "}
              {summary.band.blurb}
              {summary.filtered && " Team-filtered numbers are estimates until real schedules publish."}
            </div>
          </>
        )}
      </div>

      {fullCardOverload && (
        <div style={{ marginTop: 10, background: "#1e0a0a", border: "1px solid #7f1d1d",
          borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#fca5a5",
          fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.6 }}>
          ⚠ Full Card across {selected.length} conferences peaks at{" "}
          <b>{approx}{summary.picksPeak} picks in a single week</b>. Almost nobody finishes a card
          that size — switch to Duals Only, trim conferences, or unfollow teams.
        </div>
      )}

      {/* Data confidence: the schedule dataset is largely projected until the
          fall releases land — never imply these numbers are locked. */}
      <div style={{ marginTop: 10, fontSize: 11, color: "#4a5260",
        fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.6 }}>
        Sizing is based on the projected 2026-27 schedule (built Aug 2026 — most
        conference dates publish in the fall; Pac-12 is the least certain). Weekly
        slates always show which duals are confirmed vs. projected.
      </div>
    </div>
  );
}

// src/pickem/ConferencePicker.jsx — define the pool's scope by conference.
// Pricing follows the pick mode (Full Card = 10× Duals Only), so the mode
// control should always sit ABOVE this picker — see docs/dual-schedule-scale.md.
import { useMemo } from "react";
import {
  CONFERENCES, CONFERENCE_PRESETS, summarizeSelection, conferenceBlurb,
} from "./conferences";

// Icon + color per load band — the verdict must read without color alone.
const BAND_STYLE = {
  light:     { color: "#34d399", icon: "✓" },
  standard:  { color: "#c9a84c", icon: "●" },
  heavy:     { color: "#d97706", icon: "▲" },
  veryHeavy: { color: "#f87171", icon: "⚠" },
  extreme:   { color: "#ef4444", icon: "⛔" },
};

const sameSet = (a, b) => a.length === b.length && a.every(id => b.includes(id));

export default function ConferencePicker({ selected, onChange, pickMode }) {
  const summary = useMemo(() => summarizeSelection(selected, pickMode), [selected, pickMode]);
  const band = BAND_STYLE[summary.band.key] || BAND_STYLE.standard;
  // Guardrail from the scale analysis: Full Card beyond 2 conferences peaks
  // at 280+ picks in one week — warn loudly before someone builds that pool.
  const fullCardOverload = pickMode === "matches" && selected.length > 2;

  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <div>
      {/* ── Presets ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {CONFERENCE_PRESETS.map(p => {
          const active = sameSet(selected, p.ids);
          return (
            <button key={p.id} type="button" className="pk-btn" title={p.note}
              onClick={() => onChange([...p.ids])}
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

      {/* ── Conference toggle rows ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {CONFERENCES.map(c => {
          const on = selected.includes(c.id);
          return (
            <button key={c.id} type="button" className="pk-btn" onClick={() => toggle(c.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                background: on ? "#c9a84c10" : "#070a0e",
                border: on ? "1px solid #c9a84c66" : "1px solid #1e2530",
                borderRadius: 8, padding: "10px 14px" }}>
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
                </div>
                <div style={{ fontSize: 12, color: "#5a6470", fontFamily: "'Barlow Condensed',sans-serif",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {conferenceBlurb(c.id, pickMode)} — {c.tagline}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Running total + load verdict ── */}
      <div style={{ background: "#070a0e", border: "1px solid #1e2530",
        borderLeft: `3px solid ${band.color}`, borderRadius: 8, padding: "12px 16px" }}>
        {summary.duals === 0 ? (
          <div style={{ fontSize: 13, color: "#6a7480", fontFamily: "'Barlow Condensed',sans-serif" }}>
            Pick at least one conference to build a slate.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", color: band.color,
                fontFamily: "'Oswald',sans-serif" }}>
                {band.icon} {summary.band.label.toUpperCase()}
              </span>
              <span style={{ fontSize: 13, color: "#9aa4ae", fontFamily: "'Barlow Condensed',sans-serif" }}>
                Typical week: <b style={{ color: "#e0d8b4" }}>{summary.picksTypical} picks</b>
                &nbsp;·&nbsp; Busiest week: <b style={{ color: "#e0d8b4" }}>{summary.picksPeak}</b>
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#5a6470", fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.6 }}>
              {summary.conferences} conference{summary.conferences > 1 ? "s" : ""} · {summary.teams} teams
              · {summary.duals} duals · {summary.picksSeason.toLocaleString()}{" "}
              {pickMode === "matches" ? "match picks" : "dual picks"} across {summary.weeks} weeks.{" "}
              {summary.band.blurb}
            </div>
          </>
        )}
      </div>

      {fullCardOverload && (
        <div style={{ marginTop: 10, background: "#1e0a0a", border: "1px solid #7f1d1d",
          borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#fca5a5",
          fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.6 }}>
          ⚠ Full Card across {selected.length} conferences peaks at{" "}
          <b>{summary.picksPeak} picks in a single week</b>. Almost nobody finishes a card
          that size — switch to Duals Only, or trim the list.
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

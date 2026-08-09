// ─── SLATE BUILDER ────────────────────────────────────────────────────────────
// Commissioner tool: build a week's slate straight from the 2026-27 schedule
// dataset, filtered to the pool's conference scope. Surfaces the dataset's
// confidence honestly — confirmed duals get a green badge, everything else is
// labeled projected, and undated duals (all of the Big Ten until the September
// schedule release) sit in their own "not yet scheduled" bucket.
import { useState, useEffect, useMemo } from "react";
import {
  loadSchedule, dualsForWeek, unscheduledDuals, weekCounts,
  teamName, dualDateLabel, weekRangeLabel, defaultLockAt,
} from "./schedule";
import { CONFERENCE_BY_ID } from "./conferences";
import { createWeekFromSchedule } from "./pickemService";
import { PICK_MODES } from "./pickemConstants";

const label = { display: "block", fontSize: 10, letterSpacing: ".16em", color: "#6a5a30", marginBottom: 5 };

function DualRow({ dual, schedule, checked, onToggle }) {
  const conf = CONFERENCE_BY_ID[dual.conference];
  const date = dualDateLabel(dual);
  const confirmed = dual.status === "confirmed";
  return (
    <button type="button" className="pk-btn" onClick={onToggle}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        background: checked ? "#c9a84c0d" : "transparent",
        border: "none", borderBottom: "1px solid #10151c", padding: "8px 6px" }}>
      <div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0,
        border: checked ? "none" : "1px solid #2a3040",
        background: checked ? "#c9a84c" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#070a0e", fontSize: 11, fontWeight: 700 }}>
        {checked ? "✓" : ""}
      </div>
      <div style={{ width: 46, flexShrink: 0, fontSize: 11, fontWeight: 700,
        color: checked ? "#c9a84c" : "#5a6470", letterSpacing: ".04em" }}>
        {conf?.short || dual.conference}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600,
        color: checked ? "#d0c8b4" : "#8a949e", fontFamily: "'Barlow Condensed',sans-serif",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {teamName(schedule, dual.away)} <span style={{ color: "#5a6470", fontWeight: 400 }}>at</span>{" "}
        {teamName(schedule, dual.home)}
      </div>
      <div style={{ flexShrink: 0, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif",
        color: "#5a6470" }}>
        {date || "date TBD"}
      </div>
      <div style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: ".1em",
        fontFamily: "'Oswald',sans-serif", borderRadius: 2, padding: "2px 6px",
        color: confirmed ? "#070a0e" : "#8a949e",
        background: confirmed ? "#34d399" : "#1e2530" }}>
        {confirmed ? "CONFIRMED" : "PROJECTED"}
      </div>
    </button>
  );
}

export default function SlateBuilder({ poolId, scopeConferences, defaultPickMode, nextWeek, onCreated, showToast }) {
  const [schedule, setSchedule] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [weekTag, setWeekTag] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [title, setTitle] = useState("");
  const [pickMode, setPickMode] = useState(defaultPickMode || "matches");
  const [lockAt, setLockAt] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSchedule()
      .then(data => { if (!cancelled) setSchedule(data); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(
    () => (schedule ? weekCounts(schedule, scopeConferences) : {}),
    [schedule, scopeConferences]);

  // Default to the first week that has in-scope duals
  useEffect(() => {
    if (!schedule || weekTag) return;
    const first = schedule.weekAxis.find(w => counts[w.tag] > 0);
    if (first) setWeekTag(first.tag);
  }, [schedule, counts, weekTag]);

  const axisEntry = schedule?.weekAxis.find(w => w.tag === weekTag);
  const weekDuals = useMemo(
    () => (schedule && weekTag ? dualsForWeek(schedule, weekTag, scopeConferences) : []),
    [schedule, weekTag, scopeConferences]);
  const floating = useMemo(
    () => (schedule ? unscheduledDuals(schedule, scopeConferences) : []),
    [schedule, scopeConferences]);

  // Changing week: select all of that week's duals, keep any unscheduled picks
  useEffect(() => {
    if (!schedule || !weekTag) return;
    setSelectedIds(prev => {
      const keep = [...prev].filter(id => floating.some(d => d.id === id));
      return new Set([...weekDuals.map(d => d.id), ...keep]);
    });
    if (axisEntry) {
      setTitle(t => t && !t.startsWith("Week of") ? t : `Week of ${weekRangeLabel(axisEntry).split(" – ")[0]}`);
      setLockAt(defaultLockAt(axisEntry));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekTag, schedule]);

  const toggle = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const allById = useMemo(() => {
    const m = {};
    [...weekDuals, ...floating].forEach(d => { m[d.id] = d; });
    return m;
  }, [weekDuals, floating]);

  const selectedCount = [...selectedIds].filter(id => allById[id]).length;
  const picksThisWeek = selectedCount * (pickMode === "matches" ? 10 : 1);
  const overloaded = pickMode === "matches" && picksThisWeek > 150;

  const handleCreate = async () => {
    const duals = [...selectedIds].map(id => allById[id]).filter(Boolean);
    if (duals.length === 0) { showToast("Select at least one dual", "err"); return; }
    if (!title.trim()) { showToast("Give the week a title", "err"); return; }
    setCreating(true);
    try {
      await createWeekFromSchedule(poolId, {
        weekNumber: nextWeek,
        title: title.trim(),
        pickMode,
        lockAt: lockAt ? new Date(lockAt).toISOString() : null,
        duals: duals.map(d => ({
          sourceDualId: d.id,
          conference: d.conference,
          homeTeam: teamName(schedule, d.home),
          awayTeam: teamName(schedule, d.away),
        })),
      });
      onCreated();
      showToast(`Week created with ${duals.length} duals`, "ok");
    } catch {
      showToast("Failed to build the week", "err");
    } finally { setCreating(false); }
  };

  if (loadError) {
    return <div style={{ padding: "20px 0", fontSize: 13, color: "#b04040",
      fontFamily: "'Barlow Condensed',sans-serif" }}>
      Could not load the schedule dataset — use manual entry instead.
    </div>;
  }
  if (!schedule) {
    return <div style={{ padding: "20px 0", fontSize: 12, letterSpacing: ".14em", color: "#6a5a30" }}>
      LOADING SCHEDULE…
    </div>;
  }
  if (!scopeConferences || scopeConferences.length === 0) {
    return <div style={{ padding: "20px 0", fontSize: 13, color: "#6a7480",
      fontFamily: "'Barlow Condensed',sans-serif" }}>
      Set the pool scope (conferences) above before building a slate from the schedule.
    </div>;
  }

  return (
    <div>
      {/* ── Week selector ── */}
      <span style={label}>SEASON WEEK</span>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
        {schedule.weekAxis.map(w => {
          const n = counts[w.tag] || 0;
          const active = w.tag === weekTag;
          return (
            <button key={w.tag} type="button" className="pk-btn" disabled={n === 0}
              onClick={() => setWeekTag(w.tag)}
              style={{ background: active ? "#c9a84c" : "#070a0e",
                color: active ? "#070a0e" : n === 0 ? "#2a3040" : "#9aa4ae",
                border: active ? "none" : "1px solid #1e2530",
                borderRadius: 6, padding: "6px 10px", fontSize: 11, fontWeight: 700,
                whiteSpace: "nowrap", letterSpacing: ".04em",
                opacity: n === 0 ? 0.55 : 1 }}>
              {weekRangeLabel(w)}
              <span style={{ marginLeft: 6, fontWeight: 400,
                color: active ? "#070a0e" : "#5a6470" }}>({n})</span>
            </button>
          );
        })}
      </div>

      {/* ── This week's duals ── */}
      <div style={{ border: "1px solid #1a1f26", borderRadius: 8, marginBottom: 10, overflow: "hidden" }}>
        <div style={{ padding: "8px 12px", background: "#0a1018", fontSize: 10,
          letterSpacing: ".16em", color: "#6a5a30" }}>
          {axisEntry ? `SCHEDULED ${weekRangeLabel(axisEntry).toUpperCase()}` : "SCHEDULED"} — {weekDuals.length} DUALS
        </div>
        <div style={{ maxHeight: 300, overflowY: "auto", padding: "0 8px" }}>
          {weekDuals.map(d => (
            <DualRow key={d.id} dual={d} schedule={schedule}
              checked={selectedIds.has(d.id)} onToggle={() => toggle(d.id)} />
          ))}
          {weekDuals.length === 0 && (
            <div style={{ padding: "16px 8px", fontSize: 13, color: "#5a6470",
              fontFamily: "'Barlow Condensed',sans-serif" }}>
              No in-scope duals placed on this week yet.
            </div>
          )}
        </div>
      </div>

      {/* ── Unscheduled bucket (Big Ten until Sept release) ── */}
      {floating.length > 0 && (
        <div style={{ border: "1px solid #1a1f26", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
          <button type="button" className="pk-btn" onClick={() => setShowUnscheduled(x => !x)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 12px", background: "#0a1018", border: "none",
              fontSize: 10, letterSpacing: ".16em", color: "#6a5a30", textAlign: "left" }}>
            <span>NOT YET SCHEDULED — {floating.length} DUALS (DATES DUE THIS FALL)</span>
            <span>{showUnscheduled ? "▲" : "▼"}</span>
          </button>
          {showUnscheduled && (
            <div style={{ maxHeight: 260, overflowY: "auto", padding: "0 8px" }}>
              <div style={{ padding: "8px 6px 4px", fontSize: 12, color: "#5a6470",
                fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1.5 }}>
                The dataset couldn&apos;t place these on a week yet (Big Ten dates publish in
                September). Check any you know belong in this slate.
              </div>
              {floating.map(d => (
                <DualRow key={d.id} dual={d} schedule={schedule}
                  checked={selectedIds.has(d.id)} onToggle={() => toggle(d.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Week details ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span style={label}>TITLE</span>
          <input className="pk-inp" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div style={{ minWidth: 170 }}>
          <span style={label}>PICK MODE</span>
          <select className="pk-inp" value={pickMode} onChange={e => setPickMode(e.target.value)}>
            {Object.entries(PICK_MODES).map(([m, info]) => (
              <option key={m} value={m}>{info.label}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 190 }}>
          <span style={label}>PICKS LOCK AT</span>
          <input className="pk-inp" type="datetime-local" value={lockAt}
            onChange={e => setLockAt(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: overloaded ? "#fca5a5" : "#6a7480",
          fontFamily: "'Barlow Condensed',sans-serif" }}>
          {selectedCount} duals selected · <b style={{ color: overloaded ? "#fca5a5" : "#d0c8b4" }}>
          {picksThisWeek} picks</b> per member this week
          {overloaded && " — that's Extreme territory; consider Duals Only"}
        </div>
        <button className="pk-btn" disabled={creating} onClick={handleCreate}
          style={{ background: "#c9a84c", color: "#070a0e", borderRadius: 6, padding: "10px 22px",
            fontSize: 13, fontWeight: 700, letterSpacing: ".08em", opacity: creating ? 0.6 : 1 }}>
          {creating ? "BUILDING..." : `BUILD WEEK ${nextWeek} →`}
        </button>
      </div>
    </div>
  );
}

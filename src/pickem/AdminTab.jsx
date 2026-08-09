// src/pickem/AdminTab.jsx — commissioner tools: weeks, duals, matches, results
import { useState } from "react";
import {
  createEvent, updateEvent, deleteEvent,
  addDual, deleteDual, updateDual, updateMatch,
  savePoolSettings,
} from "./pickemService";
import { PICK_MODES, WIN_TYPES, DEFAULT_SCORING } from "./pickemConstants";
import { isEventLocked } from "./pickemScoring";
import ConferencePicker from "./ConferencePicker";
import SlateBuilder from "./SlateBuilder";

const label = { display: "block", fontSize: 10, letterSpacing: ".16em", color: "#6a5a30", marginBottom: 5 };

function WinnerToggle({ value, onPick, awayLabel, homeLabel, small }) {
  const btn = (side, text) => (
    <button className="pk-btn" onClick={() => onPick(value === side ? null : side)}
      style={{ flex: 1, minWidth: 0, padding: small ? "5px 8px" : "8px 10px",
        background: value === side ? "#0a1e14" : "#070a0e",
        border: value === side ? "1px solid #14532d" : "1px solid #1e2530",
        color: value === side ? "#86efac" : "#7a8a9a", borderRadius: 5,
        fontSize: small ? 12 : 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {text}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 6, flex: 1, minWidth: 0 }}>
      {btn("away", awayLabel)}
      {btn("home", homeLabel)}
    </div>
  );
}

// ── Per-dual editor: wrestler names + results ────────────────────────────────
function DualEditor({ event, dual, onChanged, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [names, setNames] = useState({}); // matchId → {away, home} local edits
  const [scores, setScores] = useState({ away: dual.away_score ?? "", home: dual.home_score ?? "" });

  const saveWrestlerNames = async (mt) => {
    const edit = names[mt.id];
    if (!edit) return;
    try {
      await updateMatch(mt.id, {
        away_wrestler: (edit.away ?? mt.away_wrestler ?? "").trim() || null,
        home_wrestler: (edit.home ?? mt.home_wrestler ?? "").trim() || null,
      });
      onChanged();
    } catch { showToast("Failed to save wrestler names", "err"); }
  };

  const setMatchWinner = async (mt, winner) => {
    try {
      await updateMatch(mt.id, { winner });
      onChanged();
    } catch { showToast("Failed to save result", "err"); }
  };

  const setMatchWinType = async (mt, winType) => {
    try {
      await updateMatch(mt.id, { win_type: winType || null });
      onChanged();
    } catch { showToast("Failed to save win type", "err"); }
  };

  const saveDualResult = async (fields) => {
    try {
      await updateDual(dual.id, fields);
      onChanged();
    } catch { showToast("Failed to save dual result", "err"); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${dual.away_team} at ${dual.home_team}? All picks on it are lost.`)) return;
    try {
      await deleteDual(dual.id);
      onChanged();
      showToast("Dual deleted", "info");
    } catch { showToast("Failed to delete dual", "err"); }
  };

  return (
    <div style={{ border: "1px solid #1a1f26", borderRadius: 8, marginBottom: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", background: "#0a1018", cursor: "pointer" }}
        onClick={() => setExpanded(x => !x)}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#d0c8b4" }}>
          {dual.away_team} <span style={{ color: "#6a5a30", fontWeight: 400 }}>at</span> {dual.home_team}
          {dual.winner && <span style={{ marginLeft: 10, fontSize: 11, color: "#34d399" }}>✓ result in</span>}
        </div>
        <div style={{ fontSize: 12, color: "#6a5a30" }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {expanded && (
        <div style={{ padding: "14px 14px 16px" }}>
          {/* Dual-level result (always editable; drives 'duals' mode scoring + display) */}
          <div style={{ marginBottom: 14 }}>
            <span style={label}>DUAL RESULT</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <WinnerToggle value={dual.winner} awayLabel={`${dual.away_team} won`} homeLabel={`${dual.home_team} won`}
                onPick={(w) => saveDualResult({ winner: w })} />
              <input className="pk-inp" placeholder="Away" type="number" value={scores.away}
                style={{ width: 70 }}
                onChange={e => setScores(s => ({ ...s, away: e.target.value }))}
                onBlur={() => saveDualResult({ away_score: scores.away === "" ? null : Number(scores.away) })} />
              <span style={{ color: "#6a5a30", fontSize: 12 }}>–</span>
              <input className="pk-inp" placeholder="Home" type="number" value={scores.home}
                style={{ width: 70 }}
                onChange={e => setScores(s => ({ ...s, home: e.target.value }))}
                onBlur={() => saveDualResult({ home_score: scores.home === "" ? null : Number(scores.home) })} />
            </div>
          </div>

          {/* Match grid ('matches' mode only) */}
          {event.pick_mode === "matches" && (dual.matches || []).map(mt => {
            const edit = names[mt.id] || {};
            return (
              <div key={mt.id} style={{ borderTop: "1px solid #10151c", padding: "10px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 34, fontSize: 13, fontWeight: 700, color: "#c9a84c", flexShrink: 0 }}>
                    {mt.weight}
                  </div>
                  <input className="pk-inp" placeholder={`${dual.away_team} wrestler`}
                    value={edit.away ?? mt.away_wrestler ?? ""}
                    onChange={e => setNames(n => ({ ...n, [mt.id]: { ...n[mt.id], away: e.target.value } }))}
                    onBlur={() => saveWrestlerNames(mt)} />
                  <input className="pk-inp" placeholder={`${dual.home_team} wrestler`}
                    value={edit.home ?? mt.home_wrestler ?? ""}
                    onChange={e => setNames(n => ({ ...n, [mt.id]: { ...n[mt.id], home: e.target.value } }))}
                    onBlur={() => saveWrestlerNames(mt)} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 42 }}>
                  <WinnerToggle small value={mt.winner}
                    awayLabel={mt.away_wrestler || dual.away_team}
                    homeLabel={mt.home_wrestler || dual.home_team}
                    onPick={(w) => setMatchWinner(mt, w)} />
                  <select className="pk-inp" style={{ width: 130, flexShrink: 0 }}
                    value={mt.win_type || ""}
                    onChange={e => setMatchWinType(mt, e.target.value)}>
                    <option value="">Win type…</option>
                    {WIN_TYPES.map(w => <option key={w.code} value={w.code}>{w.code} — {w.label}</option>)}
                  </select>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 12, textAlign: "right" }}>
            <button className="pk-btn" onClick={handleDelete}
              style={{ background: "transparent", color: "#b04040", border: "1px solid #5a1c1c",
                borderRadius: 5, padding: "5px 12px", fontSize: 11, letterSpacing: ".08em" }}>
              DELETE DUAL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Per-event admin card ─────────────────────────────────────────────────────
function EventAdminCard({ event, onChanged, showToast }) {
  const [awayTeam, setAwayTeam] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [adding, setAdding] = useState(false);
  const locked = isEventLocked(event);

  const handleAddDual = async () => {
    if (!awayTeam.trim() || !homeTeam.trim()) { showToast("Enter both team names", "err"); return; }
    setAdding(true);
    try {
      await addDual(event.id, {
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        dualOrder: event.duals.length + 1,
        scaffoldMatches: event.pick_mode === "matches",
      });
      setAwayTeam(""); setHomeTeam("");
      onChanged();
      showToast(`${awayTeam.trim()} at ${homeTeam.trim()} added`, "ok");
    } catch {
      showToast("Failed to add dual", "err");
    } finally { setAdding(false); }
  };

  const setStatus = async (status) => {
    try {
      await updateEvent(event.id, { status });
      onChanged();
      showToast(status === "final" ? "Week finalized — standings updated" : `Week ${status}`, "ok");
    } catch { showToast("Failed to update week", "err"); }
  };

  const handleDeleteEvent = async () => {
    if (!window.confirm(`Delete Week ${event.week_number} (${event.title}) and all its duals + picks?`)) return;
    try {
      await deleteEvent(event.id);
      onChanged();
      showToast("Week deleted", "info");
    } catch { showToast("Failed to delete week", "err"); }
  };

  return (
    <div className="pk-card" style={{ marginBottom: 16 }}>
      <div style={{ padding: "12px 18px", background: "#0a1018", borderBottom: "1px solid #1a1f26",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <span style={{ fontSize: 11, letterSpacing: ".16em", color: "#6a5a30", marginRight: 10 }}>
            WEEK {event.week_number}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#e0d8b4" }}>{event.title}</span>
          <span style={{ marginLeft: 10, fontSize: 11, color: "#6a7480",
            fontFamily: "'Barlow Condensed',sans-serif" }}>
            {PICK_MODES[event.pick_mode]?.label}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, letterSpacing: ".1em", fontWeight: 700,
            color: event.status === "final" ? "#34d399" : locked ? "#d97706" : "#7a8a9a" }}>
            {event.status === "final" ? "FINAL" : locked ? "LOCKED" : "OPEN"}
          </span>
          {event.status === "upcoming" && !locked && (
            <button className="pk-btn" onClick={() => setStatus("locked")}
              style={{ background: "transparent", color: "#c9a84c", border: "1px solid #c9a84c44",
                borderRadius: 5, padding: "4px 12px", fontSize: 11, letterSpacing: ".08em" }}>
              LOCK NOW
            </button>
          )}
          {event.status === "locked" && (
            <button className="pk-btn" onClick={() => setStatus("upcoming")}
              style={{ background: "transparent", color: "#7a8a9a", border: "1px solid #2a3040",
                borderRadius: 5, padding: "4px 12px", fontSize: 11, letterSpacing: ".08em" }}>
              REOPEN
            </button>
          )}
          {event.status !== "final" && (
            <button className="pk-btn" onClick={() => setStatus("final")}
              style={{ background: "#c9a84c", color: "#070a0e", borderRadius: 5,
                padding: "4px 12px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em" }}>
              FINALIZE
            </button>
          )}
          {event.status === "final" && (
            <button className="pk-btn" onClick={() => setStatus("locked")}
              style={{ background: "transparent", color: "#7a8a9a", border: "1px solid #2a3040",
                borderRadius: 5, padding: "4px 12px", fontSize: 11, letterSpacing: ".08em" }}>
              UN-FINALIZE
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 18px" }}>
        {event.duals.map(dual => (
          <DualEditor key={dual.id} event={event} dual={dual} onChanged={onChanged} showToast={showToast} />
        ))}

        {/* Add dual */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 6 }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <span style={label}>AWAY TEAM</span>
            <input className="pk-inp" placeholder="e.g. Iowa" value={awayTeam}
              onChange={e => setAwayTeam(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <span style={label}>HOME TEAM</span>
            <input className="pk-inp" placeholder="e.g. Penn State" value={homeTeam}
              onChange={e => setHomeTeam(e.target.value)} />
          </div>
          <button className="pk-btn" disabled={adding} onClick={handleAddDual}
            style={{ background: "#c9a84c", color: "#070a0e", borderRadius: 6, padding: "9px 18px",
              fontSize: 12, fontWeight: 700, letterSpacing: ".08em", opacity: adding ? 0.6 : 1 }}>
            + ADD DUAL
          </button>
        </div>
        {event.pick_mode === "matches" && (
          <div style={{ fontSize: 12, color: "#5a6470", fontFamily: "'Barlow Condensed',sans-serif", marginTop: 8 }}>
            Adding a dual auto-creates all 10 weight-class matches — expand it to fill in wrestler names (optional) and enter results.
          </div>
        )}

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #131820", textAlign: "right" }}>
          <button className="pk-btn" onClick={handleDeleteEvent}
            style={{ background: "transparent", color: "#b04040", border: "1px solid #5a1c1c",
              borderRadius: 5, padding: "5px 12px", fontSize: 11, letterSpacing: ".08em" }}>
            DELETE WEEK
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scoring editor ───────────────────────────────────────────────────────────
function ScoringCard({ poolId, settings, onChanged, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const current = { ...DEFAULT_SCORING, ...(settings?.scoring || {}) };
  const [values, setValues] = useState(current);
  const [saving, setSaving] = useState(false);
  const dirty = Object.keys(DEFAULT_SCORING).some(k => Number(values[k]) !== current[k]);

  const fields = [
    { key: "matchWin", label: "CORRECT MATCH PICK", hint: "Full Card mode, per bout" },
    { key: "perfectCard", label: "PERFECT 10-MATCH CARD", hint: "bonus per dual" },
    { key: "dualWin", label: "CORRECT DUAL WINNER", hint: "Duals Only mode" },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const scoring = Object.fromEntries(
        Object.keys(DEFAULT_SCORING).map(k => [k, Math.max(0, Number(values[k]) || 0)]));
      await savePoolSettings(poolId, { scoring });
      onChanged();
      showToast("Scoring updated — standings recalculate instantly", "ok");
    } catch {
      showToast("Failed to save scoring", "err");
    } finally { setSaving(false); }
  };

  return (
    <div className="pk-card" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 18px", background: "#0a1018", cursor: "pointer",
        borderBottom: expanded ? "1px solid #1a1f26" : "none" }}
        onClick={() => setExpanded(x => !x)}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e0d8b4", letterSpacing: ".06em" }}>
            SCORING
          </span>
          <span style={{ marginLeft: 10, fontSize: 12, color: "#6a7480",
            fontFamily: "'Barlow Condensed',sans-serif" }}>
            match {current.matchWin} · perfect card +{current.perfectCard} · dual {current.dualWin}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#6a5a30" }}>{expanded ? "▲" : "▼"}</div>
      </div>
      {expanded && (
        <div style={{ padding: "16px 18px 18px" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            {fields.map(f => (
              <div key={f.key} style={{ minWidth: 150, flex: 1 }}>
                <span style={label}>{f.label}</span>
                <input className="pk-inp" type="number" min="0" value={values[f.key]}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} />
                <div style={{ fontSize: 11, color: "#4a5260", marginTop: 4,
                  fontFamily: "'Barlow Condensed',sans-serif" }}>{f.hint}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "#5a6470", fontFamily: "'Barlow Condensed',sans-serif" }}>
              Applies to all weeks, including already-finalized ones — standings are
              recomputed from raw picks every time.
            </div>
            <button className="pk-btn" disabled={saving || !dirty} onClick={handleSave}
              style={{ background: dirty ? "#c9a84c" : "#1e2530", color: dirty ? "#070a0e" : "#5a6470",
                borderRadius: 6, padding: "9px 20px", fontSize: 12, fontWeight: 700,
                letterSpacing: ".08em", opacity: saving ? 0.6 : 1 }}>
              {saving ? "SAVING..." : "SAVE SCORING"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pool scope: conference selection, team follow lists, default pick mode ───
// Normalized form so dirty-checking ignores key/array ordering.
const normScope = (scope) => JSON.stringify(
  Object.keys(scope || {}).sort().map(k => [k, [...scope[k]].sort()]));

function PoolScopeCard({ poolId, settings, onChanged, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [conferences, setConferences] = useState(settings?.conferences || []);
  const [teamScope, setTeamScope] = useState(settings?.teamScope || {});
  const [mode, setMode] = useState(settings?.defaultPickMode || "matches");
  const [saving, setSaving] = useState(false);
  // Dirty-tracking baseline is local — the settings prop is fetched once on
  // page load and doesn't refresh after a save.
  const [baseline, setBaseline] = useState({
    conferences: settings?.conferences || [],
    teamScope: settings?.teamScope || {},
    mode: settings?.defaultPickMode || "matches",
  });
  const dirty = mode !== baseline.mode
    || JSON.stringify([...conferences].sort()) !== JSON.stringify([...baseline.conferences].sort())
    || normScope(teamScope) !== normScope(baseline.teamScope);

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePoolSettings(poolId, { conferences, teamScope, defaultPickMode: mode });
      setBaseline({ conferences, teamScope, mode });
      onChanged();
      showToast("Pool scope saved", "ok");
    } catch {
      showToast("Failed to save pool scope", "err");
    } finally { setSaving(false); }
  };

  return (
    <div className="pk-card" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 18px", background: "#0a1018", cursor: "pointer",
        borderBottom: expanded ? "1px solid #1a1f26" : "none" }}
        onClick={() => setExpanded(x => !x)}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e0d8b4", letterSpacing: ".06em" }}>
            POOL SCOPE
          </span>
          <span style={{ marginLeft: 10, fontSize: 12, color: "#6a7480",
            fontFamily: "'Barlow Condensed',sans-serif" }}>
            {conferences.length || "no"} conference{conferences.length !== 1 ? "s" : ""} selected
            {Object.keys(teamScope).length > 0 ? ` · team filters on ${Object.keys(teamScope).length}` : ""}
            · {PICK_MODES[mode]?.label} default{dirty ? " · unsaved" : ""}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#6a5a30" }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {expanded && (
        <div style={{ padding: "16px 18px 18px" }}>
          <span style={label}>DEFAULT PICK MODE <span style={{ color: "#3a4250" }}>(RE-PRICES EVERYTHING BELOW)</span></span>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {Object.entries(PICK_MODES).map(([m, info]) => (
              <button key={m} className="pk-btn" onClick={() => setMode(m)}
                style={{ flex: 1, background: mode === m ? "#c9a84c14" : "#070a0e",
                  border: mode === m ? "1px solid #c9a84c" : "1px solid #1e2530",
                  color: mode === m ? "#c9a84c" : "#7a8a9a",
                  borderRadius: 6, padding: "8px 10px", fontSize: 12, fontWeight: 700, letterSpacing: ".06em" }}>
                {info.label.toUpperCase()}
              </button>
            ))}
          </div>

          <ConferencePicker selected={conferences} onChange={setConferences} pickMode={mode}
            teamScope={teamScope} onTeamScopeChange={setTeamScope} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 14, gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "#5a6470", fontFamily: "'Barlow Condensed',sans-serif" }}>
              Scope sizes the pool and will drive auto-built weekly slates once schedules publish.
            </div>
            <button className="pk-btn" disabled={saving || !dirty} onClick={handleSave}
              style={{ background: dirty ? "#c9a84c" : "#1e2530", color: dirty ? "#070a0e" : "#5a6470",
                borderRadius: 6, padding: "9px 20px", fontSize: 12, fontWeight: 700,
                letterSpacing: ".08em", opacity: saving ? 0.6 : 1 }}>
              {saving ? "SAVING..." : "SAVE SCOPE"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main admin tab ───────────────────────────────────────────────────────────
export default function AdminTab({ poolId, events, settings, onChanged, showToast }) {
  const nextWeek = events.length > 0 ? Math.max(...events.map(e => e.week_number)) + 1 : 1;
  // Raw input string so clearing the field doesn't coerce to 0/NaN — parsed
  // (with a nextWeek fallback) at submit. null = auto.
  const [weekNumber, setWeekNumber] = useState(null);
  const [title, setTitle] = useState("");
  const [pickMode, setPickMode] = useState(settings?.defaultPickMode || "matches");
  const [lockAt, setLockAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(events.length === 0);
  const [source, setSource] = useState("schedule"); // schedule | manual

  const handleCreate = async () => {
    if (!title.trim()) { showToast("Give the week a title", "err"); return; }
    setCreating(true);
    try {
      const parsedWeek = parseInt(weekNumber, 10);
      await createEvent(poolId, {
        weekNumber: Number.isFinite(parsedWeek) && parsedWeek > 0 ? parsedWeek : nextWeek,
        title: title.trim(),
        pickMode,
        lockAt: lockAt ? new Date(lockAt).toISOString() : null,
      });
      setTitle(""); setLockAt(""); setWeekNumber(null); setShowCreate(false);
      onChanged();
      showToast("Week created — now add its duals", "ok");
    } catch {
      showToast("Failed to create week", "err");
    } finally { setCreating(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: ".2em", color: "#6a5a30" }}>COMMISSIONER TOOLS</div>
        <button className="pk-btn" onClick={() => setShowCreate(s => !s)}
          style={{ background: showCreate ? "transparent" : "#c9a84c",
            color: showCreate ? "#7a8a9a" : "#070a0e",
            border: showCreate ? "1px solid #2a3040" : "none",
            borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 700, letterSpacing: ".08em" }}>
          {showCreate ? "CANCEL" : "+ NEW WEEK"}
        </button>
      </div>

      <PoolScopeCard poolId={poolId} settings={settings} onChanged={onChanged} showToast={showToast} />
      <ScoringCard poolId={poolId} settings={settings} onChanged={onChanged} showToast={showToast} />

      {showCreate && (
        <div className="pk-card" style={{ padding: "18px 18px 20px", marginBottom: 20 }}>
          {/* ── Source toggle: build from the schedule dataset, or by hand ── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["schedule", "FROM SCHEDULE"], ["manual", "MANUAL"]].map(([s, text]) => (
              <button key={s} className="pk-btn" onClick={() => setSource(s)}
                style={{ background: source === s ? "#c9a84c14" : "transparent",
                  border: source === s ? "1px solid #c9a84c" : "1px solid #1e2530",
                  color: source === s ? "#c9a84c" : "#7a8a9a",
                  borderRadius: 6, padding: "7px 16px", fontSize: 11, fontWeight: 700,
                  letterSpacing: ".08em" }}>
                {text}
              </button>
            ))}
          </div>

          {source === "schedule" && (
            <SlateBuilder poolId={poolId}
              scopeConferences={settings?.conferences || []}
              teamScope={settings?.teamScope || {}}
              defaultPickMode={settings?.defaultPickMode}
              nextWeek={nextWeek}
              onCreated={() => { setShowCreate(false); onChanged(); }}
              showToast={showToast} />
          )}

          {source === "manual" && (<>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ width: 90 }}>
              <span style={label}>WEEK #</span>
              <input className="pk-inp" type="number" min="1" value={weekNumber ?? nextWeek}
                onChange={e => setWeekNumber(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={label}>TITLE</span>
              <input className="pk-inp" placeholder="e.g. Iowa at Penn State + Big Ten slate"
                value={title} onChange={e => setTitle(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ minWidth: 180, flex: 1 }}>
              <span style={label}>PICK MODE</span>
              <select className="pk-inp" value={pickMode} onChange={e => setPickMode(e.target.value)}>
                {Object.entries(PICK_MODES).map(([mode, info]) => (
                  <option key={mode} value={mode}>{info.label} — {info.desc}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 200, flex: 1 }}>
              <span style={label}>PICKS LOCK AT <span style={{ color: "#3a4250" }}>(OPTIONAL)</span></span>
              <input className="pk-inp" type="datetime-local" value={lockAt}
                onChange={e => setLockAt(e.target.value)} />
            </div>
            <button className="pk-btn" disabled={creating} onClick={handleCreate}
              style={{ background: "#c9a84c", color: "#070a0e", borderRadius: 6, padding: "10px 22px",
                fontSize: 13, fontWeight: 700, letterSpacing: ".08em", opacity: creating ? 0.6 : 1 }}>
              CREATE WEEK
            </button>
          </div>
          </>)}
        </div>
      )}

      {events.length === 0 && !showCreate && (
        <div className="pk-card" style={{ padding: "32px 24px", textAlign: "center", color: "#6a7480",
          fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14 }}>
          Create your first week to get the pool rolling.
        </div>
      )}

      {[...events].reverse().map(event => (
        <EventAdminCard key={event.id} event={event}
          onChanged={onChanged} showToast={showToast} />
      ))}
    </div>
  );
}

// src/pickem/PickemApp.jsx — main pick'em interface (shell + tabs)
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "../supabase";
import { loadPoolState, saveMatchPick, saveDualPick } from "./pickemService";
import { DEFAULT_SCORING } from "./pickemConstants";
import { isEventLocked } from "./pickemScoring";
import PicksTab from "./PicksTab";
import StandingsTab from "./StandingsTab";
import ResultsTab from "./ResultsTab";
import AdminTab from "./AdminTab";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#070a0e;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:#0d1117;}
::-webkit-scrollbar-thumb{background:#c9a84c66;border-radius:3px;}
::-webkit-scrollbar-thumb:hover{background:#c9a84c;}
.pk-btn{cursor:pointer;border:none;transition:all .13s;font-family:'Oswald',sans-serif;}
.pk-btn:hover:not(:disabled){filter:brightness(1.18);}
.pk-btn:disabled{cursor:default;}
.pk-tab{cursor:pointer;border:none;background:none;transition:all .15s;white-space:nowrap;
  font-family:'Oswald',sans-serif;padding:14px 18px;font-size:13px;letter-spacing:.12em;}
.pk-tab:hover{opacity:.85;}
.pk-card{background:#0b0f14;border:1px solid #1a1f26;border-radius:10px;overflow:hidden;}
.pk-inp{background:#070a0e;border:1px solid #1e2530;border-radius:6px;color:#d0c8b4;
  font-family:'Barlow Condensed',sans-serif;font-size:14px;padding:8px 11px;width:100%;}
.pk-inp:focus{outline:none;border-color:#c9a84c;box-shadow:0 0 0 2px #c9a84c22;}
.pk-side{cursor:pointer;transition:all .12s;border-radius:6px;font-family:'Barlow Condensed',sans-serif;}
.pk-side:hover:not(:disabled){border-color:#c9a84c88 !important;}
.pk-side:disabled{cursor:default;opacity:.85;}
select.pk-inp{cursor:pointer;}
.slide-down{animation:pkSlideDown .2s ease-out;}
@keyframes pkSlideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
`;

export default function PickemApp({ poolId, session, poolName, season, settings, initialMembers }) {
  const isCommissioner = session?.role === "commissioner";

  const [members, setMembers] = useState(initialMembers || []);
  const [events, setEvents] = useState([]);
  const [picks, setPicks] = useState([]);
  const [stateLoading, setStateLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("picks");
  const [toast, setToast] = useState(null);

  const scoring = useMemo(() => ({ ...DEFAULT_SCORING, ...(settings?.scoring || {}) }), [settings]);

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  }, []);

  // ── Load + debounced realtime reload ──────────────────────────────
  const reloadTimer = useRef(null);
  const reload = useCallback(async () => {
    try {
      const state = await loadPoolState(poolId);
      setMembers(state.members);
      setEvents(state.events);
      setPicks(state.picks);
    } catch (err) {
      console.error("Failed to load pool state:", err);
    }
  }, [poolId]);

  useEffect(() => {
    let cancelled = false;
    loadPoolState(poolId).then(state => {
      if (cancelled) return;
      setMembers(state.members);
      setEvents(state.events);
      setPicks(state.picks);
    }).catch(err => {
      console.error("Failed to load pool state:", err);
    }).finally(() => {
      if (!cancelled) setStateLoading(false);
    });
    return () => { cancelled = true; };
  }, [poolId]);

  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(reload, 400);
    };
    // duals/matches carry no pool_id column, so those subscriptions are
    // table-wide — the debounced reload is pool-scoped and cheap either way.
    const ch = supabase.channel(`pickem-${poolId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pickem_picks", filter: `pool_id=eq.${poolId}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "pickem_events", filter: `pool_id=eq.${poolId}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "pickem_members", filter: `pool_id=eq.${poolId}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "pickem_duals" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "pickem_matches" }, scheduleReload)
      .subscribe();
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      ch.unsubscribe();
    };
  }, [poolId, reload]);

  // ── My picks, indexed for the tabs ────────────────────────────────
  const myPicks = useMemo(() => {
    const byMatch = {}, byDual = {};
    picks.forEach(p => {
      if (p.member_id !== session.memberId) return;
      if (p.match_id) byMatch[p.match_id] = p.pick;
      if (p.dual_id) byDual[p.dual_id] = p.pick;
    });
    return { byMatch, byDual };
  }, [picks, session.memberId]);

  // ── Optimistic pick handlers ──────────────────────────────────────
  const pickMatch = useCallback(async (event, matchId, side) => {
    if (isEventLocked(event)) { showToast("Picks are locked for this week", "err"); return; }
    const prev = picks;
    setPicks(ps => {
      const rest = ps.filter(p => !(p.member_id === session.memberId && p.match_id === matchId));
      return [...rest, { id: `optimistic-${matchId}`, member_id: session.memberId, match_id: matchId, dual_id: null, pick: side }];
    });
    try {
      await saveMatchPick(poolId, session.memberId, matchId, side);
    } catch {
      setPicks(prev);
      showToast("Failed to save pick — try again", "err");
    }
  }, [poolId, session.memberId, picks, showToast]);

  const pickDual = useCallback(async (event, dualId, side) => {
    if (isEventLocked(event)) { showToast("Picks are locked for this week", "err"); return; }
    const prev = picks;
    setPicks(ps => {
      const rest = ps.filter(p => !(p.member_id === session.memberId && p.dual_id === dualId));
      return [...rest, { id: `optimistic-${dualId}`, member_id: session.memberId, match_id: null, dual_id: dualId, pick: side }];
    });
    try {
      await saveDualPick(poolId, session.memberId, dualId, side);
    } catch {
      setPicks(prev);
      showToast("Failed to save pick — try again", "err");
    }
  }, [poolId, session.memberId, picks, showToast]);

  const me = members.find(m => m.id === session.memberId);

  if (stateLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#070a0e", display: "flex", alignItems: "center",
        justifyContent: "center", flexDirection: "column", gap: 20, fontFamily: "'Oswald',sans-serif" }}>
        <style>{css}</style>
        <div style={{ width: 40, height: 40, border: "3px solid #1e2530", borderTop: "3px solid #c9a84c",
          borderRadius: "50%", animation: "spin .8s linear infinite" }} />
        <div style={{ fontSize: 14, letterSpacing: ".15em", color: "#6a5a30" }}>LOADING POOL...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const tabs = [
    { id: "picks", label: "MAKE PICKS" },
    { id: "standings", label: "STANDINGS" },
    { id: "results", label: "RESULTS" },
    ...(isCommissioner ? [{ id: "admin", label: "MANAGE ⚙" }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#070a0e", color: "#d0c8b4", fontFamily: "'Oswald',sans-serif" }}>
      <style>{css}</style>

      {toast && (
        <div className="slide-down" style={{ position: "fixed", top: 14, right: 14, zIndex: 9999,
          background: toast.type === "err" ? "#1e0a0a" : toast.type === "info" ? "#0a1220" : "#0a1e14",
          border: `1px solid ${toast.type === "err" ? "#7f1d1d" : toast.type === "info" ? "#1e3a5f" : "#14532d"}`,
          color: toast.type === "err" ? "#fca5a5" : toast.type === "info" ? "#93c5fd" : "#86efac",
          padding: "9px 16px", borderRadius: 6, fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif",
          fontWeight: 600, boxShadow: "0 8px 32px #00000099", maxWidth: 320 }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid #1a1f26", background: "#0b0f14" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: ".22em", color: "#6a5a30" }}>
                {season} DUAL MEET PICK&apos;EM
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "#c9a84c", letterSpacing: ".03em" }}>
                {poolName}
              </h1>
            </div>
            <div style={{ fontSize: 13, color: "#7a8a9a", fontFamily: "'Barlow Condensed',sans-serif" }}>
              Picking as <span style={{ color: "#e0d8b4", fontWeight: 700 }}>{me?.name || "…"}</span>
              {isCommissioner && (
                <span style={{ marginLeft: 8, fontSize: 10, color: "#6a5a30", letterSpacing: ".14em",
                  fontFamily: "'Oswald',sans-serif" }}>COMMISSIONER</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 8, overflowX: "auto" }}>
            {tabs.map(t => (
              <button key={t.id} className="pk-tab" onClick={() => setActiveTab(t.id)}
                style={{ color: activeTab === t.id ? "#c9a84c" : "#5a6470",
                  borderBottom: activeTab === t.id ? "2px solid #c9a84c" : "2px solid transparent",
                  fontWeight: activeTab === t.id ? 600 : 400 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>
        {activeTab === "picks" && (
          <PicksTab events={events} myPicks={myPicks} pickMatch={pickMatch} pickDual={pickDual} />
        )}
        {activeTab === "standings" && (
          <StandingsTab members={members} events={events} picks={picks} scoring={scoring}
            myMemberId={session.memberId} />
        )}
        {activeTab === "results" && (
          <ResultsTab events={events} myPicks={myPicks} scoring={scoring} />
        )}
        {activeTab === "admin" && isCommissioner && (
          <AdminTab poolId={poolId} events={events} settings={settings}
            onChanged={reload} showToast={showToast} />
        )}
      </div>
    </div>
  );
}

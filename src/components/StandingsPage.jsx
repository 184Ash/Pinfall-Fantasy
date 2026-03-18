import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSyncTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

/** Returns minutes remaining in cooldown (0 if cooldown has expired). */
function minutesUntilNextSync(lastSyncedAt) {
  if (!lastSyncedAt) return 0;
  const elapsed = Date.now() - new Date(lastSyncedAt).getTime();
  const remaining = 15 * 60 * 1000 - elapsed;
  return remaining > 0 ? Math.ceil(remaining / 60000) : 0;
}

// ─── STANDINGS PAGE ───────────────────────────────────────────────────────────
export default function StandingsPage({ teamScores, getColor, getRoster, isCommissioner, leagueId }) {
  const [expanded,      setExpanded]      = useState(null);
  const [syncing,       setSyncing]       = useState(false);
  const [syncResult,    setSyncResult]    = useState(null); // {pointsWritten, lastSyncedAt, unmatched} | {error}
  const [lastSyncedAt,  setLastSyncedAt]  = useState(null);
  const [cooldownMins,  setCooldownMins]  = useState(0);
  const cooldownRef = useRef(null);

  const leader = teamScores[0]?.total || 0;

  // ── Fetch sync_meta on mount to show "Scores current as of…" ─────────────
  useEffect(() => {
    supabase
      .from('sync_meta')
      .select('last_synced_at')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data?.last_synced_at) {
          setLastSyncedAt(data.last_synced_at);
          setCooldownMins(minutesUntilNextSync(data.last_synced_at));
        }
      });
  }, []);

  // ── Cooldown countdown timer ──────────────────────────────────────────────
  useEffect(() => {
    if (cooldownMins <= 0) { clearInterval(cooldownRef.current); return; }
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownMins(m => {
        if (m <= 1) { clearInterval(cooldownRef.current); return 0; }
        return m - 1;
      });
    }, 60_000);
    return () => clearInterval(cooldownRef.current);
  }, [cooldownMins]);

  // ── Sync handler ──────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res  = await fetch('/api/sync-scores', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ leagueId }),
      });
      const data = await res.json();

      if (res.status === 429) {
        // Cooldown still active — show message and update countdown from server timestamp
        setSyncResult({ error: data.error });
        if (data.lastSyncedAt) {
          setLastSyncedAt(data.lastSyncedAt);
          setCooldownMins(minutesUntilNextSync(data.lastSyncedAt));
        }
      } else if (res.ok) {
        setSyncResult({ pointsWritten: data.pointsWritten, unmatched: data.unmatched });
        if (data.lastSyncedAt) {
          setLastSyncedAt(data.lastSyncedAt);
          setCooldownMins(15); // fresh 15-minute window
        }
      } else {
        setSyncResult({ error: data.error || 'Sync failed' });
      }
    } catch (e) {
      setSyncResult({ error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '.1em', color: '#c9a84c' }}>LIVE STANDINGS</h2>
          {lastSyncedAt
            ? <p style={{ color: '#4a4020', fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", marginTop: 2 }}>
                Scores current as of {formatSyncTime(lastSyncedAt)}
              </p>
            : <p style={{ color: '#4a4020', fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", marginTop: 2 }}>
                Updates automatically after each sync
              </p>
          }
        </div>

        {isCommissioner && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button
              className="btn"
              onClick={handleSync}
              disabled={syncing || cooldownMins > 0}
              style={{
                padding: '8px 16px',
                background: (syncing || cooldownMins > 0) ? '#1a1f26' : '#c9a84c',
                color:      (syncing || cooldownMins > 0) ? '#4a4020' : '#070a0e',
                borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.08em',
                border: '1px solid #c9a84c44',
                opacity: (syncing || cooldownMins > 0) ? 0.6 : 1,
              }}
            >
              {syncing ? '⏳ SYNCING...' : '🔄 SYNC SCORES'}
            </button>

            {/* Cooldown countdown (shown even without a fresh sync attempt) */}
            {cooldownMins > 0 && !syncing && (
              <div style={{ fontSize: 11, color: '#fbbf24', fontFamily: "'Barlow Condensed',sans-serif" }}>
                Next sync available in {cooldownMins} min{cooldownMins !== 1 ? 's' : ''}
              </div>
            )}

            {/* Sync result feedback */}
            {syncResult && (
              syncResult.error
                ? <div style={{ fontSize: 11, color: '#f87171', fontFamily: "'Barlow Condensed',sans-serif" }}>
                    {syncResult.error}
                  </div>
                : <div style={{ fontSize: 11, color: '#34d399', fontFamily: "'Barlow Condensed',sans-serif" }}>
                    ✓ {syncResult.pointsWritten} wrestlers updated
                    {syncResult.unmatched?.length > 0 && (
                      <span style={{ color: '#fbbf24' }}> · {syncResult.unmatched.length} unmatched</span>
                    )}
                  </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {teamScores.map((ts, i) => {
          const c = getColor(ts.team);
          const pct = leader > 0 ? (ts.total / leader) * 100 : 0;
          const isExp = expanded === ts.team;
          return (
            <div key={ts.team} className="card" style={{ borderLeft: `4px solid ${c.bg}` }}>
              <div
                onClick={() => setExpanded(isExp ? null : ts.team)}
                style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div className="rank-badge" style={{
                  background: i === 0 ? 'radial-gradient(circle at 35% 35%,#e6c84e,#7a5810)'
                            : i === 1 ? 'radial-gradient(circle at 35% 35%,#aaa,#555)'
                            : i === 2 ? 'radial-gradient(circle at 35% 35%,#cd7f32,#7a4510)'
                            : '#1a1f26',
                  color: i < 3 ? '#070a0e' : '#5a5030',
                  boxShadow: i === 0 ? '0 0 12px #c9a84c66' : 'none',
                }}>
                  {i + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: c.bg, boxShadow: `0 0 6px ${c.bg}`, flexShrink: 0 }} />
                    <span style={{ fontSize: 17, fontWeight: 600, color: c.text, letterSpacing: '.05em' }}>{ts.team}</span>
                    <span style={{ fontSize: 11, color: '#3a3820', fontFamily: "'Barlow Condensed',sans-serif" }}>{getRoster(ts.team).length} wrestlers</span>
                  </div>
                  <div style={{ marginTop: 6, height: 4, background: '#1a1f26', borderRadius: 2, overflow: 'hidden' }}>
                    <div className="avail-bar" style={{ height: '100%', width: `${pct}%`, background: c.bg, borderRadius: 2, boxShadow: `0 0 6px ${c.bg}66` }} />
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: i === 0 ? '#c9a84c' : c.text, lineHeight: 1 }}>{ts.total.toFixed(1)}</div>
                  <div style={{ fontSize: 9, color: '#3a3820', letterSpacing: '.12em' }}>POINTS</div>
                </div>
                <div style={{ fontSize: 14, color: '#3a3820' }}>{isExp ? '▲' : '▼'}</div>
              </div>

              {isExp && (
                <div style={{ borderTop: '1px solid #1a1f26', padding: '10px 16px' }}>
                  {ts.breakdown.length === 0
                    ? <div style={{ fontSize: 12, color: '#3a3820', fontFamily: "'Barlow Condensed',sans-serif" }}>
                        No points yet{isCommissioner ? ' — click Sync Scores after each round' : ''}
                      </div>
                    : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {ts.breakdown.sort((a, b) => b.pts - a.pts).map(wr => (
                          <div key={`${wr.weight}-${wr.seed}`} style={{
                            padding: '5px 10px', background: `${c.bg}18`,
                            border: `1px solid ${c.bg}33`, borderRadius: 6,
                            display: 'flex', gap: 7, alignItems: 'center',
                          }}>
                            <span style={{ fontSize: 10, color: '#c9a84c', fontFamily: "'Barlow Condensed',sans-serif" }}>{wr.weight}#</span>
                            <span style={{ fontSize: 12, color: c.text, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600 }}>#{wr.seed} {wr.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>{wr.pts}pt</span>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DATA PAGE ────────────────────────────────────────────────────────────────

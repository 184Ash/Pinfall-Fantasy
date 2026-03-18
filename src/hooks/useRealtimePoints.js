// src/hooks/useRealtimePoints.js
//
// Subscribes to changes on the global_scores table (no league filter —
// all leagues share one global score row per wrestler UUID).
//
// On each change, checks whether the updated wrestler_id belongs to this
// league's roster (client-side filter), then calls onPointsChanged({ key, pts })
// where key = "weight-seed" string (e.g. "157-3").
//
import { useEffect } from "react";
import { supabase } from "../supabase";

export function useRealtimePoints(leagueId, wrestlers, onPointsChanged) {
  useEffect(() => {
    if (!leagueId || !wrestlers) return;

    const channel = supabase
      .channel(`global-scores-${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "global_scores",
          // No filter — global_scores has no league_id column.
          // We filter client-side by checking if the wrestler belongs to this league.
        },
        (payload) => {
          const { wrestler_id, pts } = payload.new;

          // Only process if this wrestler is on our league's roster
          let foundWrestler = null;
          for (const weight of Object.keys(wrestlers)) {
            const match = (wrestlers[weight] || []).find(
              (w) => w.id === wrestler_id
            );
            if (match) {
              foundWrestler = { ...match, weight: Number(weight) };
              break;
            }
          }
          if (!foundWrestler) return;

          const key = `${foundWrestler.weight}-${foundWrestler.seed}`;
          onPointsChanged({ key, pts: Number(pts) });
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [leagueId, wrestlers, onPointsChanged]);
}

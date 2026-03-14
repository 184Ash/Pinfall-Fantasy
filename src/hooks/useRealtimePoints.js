// src/hooks/useRealtimePoints.js
//
// Subscribes to all changes (*) on the points table for a given league.
// On each change, calls onPointsChanged({ key, pts }) where:
//   key = "weight-seed" string (e.g. "157-3")
//   pts = number
//
import { useEffect } from "react";
import { supabase } from "../supabase";

export function useRealtimePoints(leagueId, wrestlers, onPointsChanged) {
  useEffect(() => {
    if (!leagueId || !wrestlers) return;

    const channel = supabase
      .channel(`points-${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "points",
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          const { wrestler_id, pts } = payload.new;

          // Look up wrestler by UUID to build weight-seed key
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

// src/hooks/useRealtimePoints.js
//
// Subscribes to global_scores changes. Each row is keyed by (weight, seed)
// so the key maps directly to the pointsMap format used throughout the app.
//
import { useEffect } from "react";
import { supabase } from "../supabase";

export function useRealtimePoints(leagueId, wrestlers, onPointsChanged) {
  useEffect(() => {
    if (!leagueId) return;

    const channel = supabase
      .channel(`global-scores-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "global_scores" },
        (payload) => {
          const { weight, seed, pts } = payload.new;
          onPointsChanged({ key: `${weight}-${seed}`, pts: Number(pts) });
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [leagueId, onPointsChanged]);
}

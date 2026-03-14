// src/hooks/useRealtimePicks.js
//
// Subscribes to INSERT events on the picks table for a given league.
// On each new pick, calls onPickAdded({ key, teamName }) where:
//   key      = "weight-seed" string (e.g. "157-3")
//   teamName = the team name string (matches App picks state shape)
//
// The caller is responsible for suppressing its own picks
// (check if key already exists in picks state before applying).
//
import { useEffect } from "react";
import { supabase } from "../supabase";

export function useRealtimePicks(leagueId, wrestlers, teamsProp, onPickAdded) {
  useEffect(() => {
    if (!leagueId || !wrestlers || !teamsProp) return;

    const channel = supabase
      .channel(`picks-${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "picks",
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          const { wrestler_id, team_id } = payload.new;

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
          if (!foundWrestler) return; // unknown wrestler — skip

          // Look up team name by UUID
          const team = teamsProp.find((t) => t.id === team_id);
          if (!team) return; // unknown team — skip

          const key = `${foundWrestler.weight}-${foundWrestler.seed}`;
          onPickAdded({ key, teamName: team.name });
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [leagueId, wrestlers, teamsProp, onPickAdded]);
}

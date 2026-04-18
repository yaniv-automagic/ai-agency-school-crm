import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Subscribe to Supabase Realtime changes on CRM tables.
 * Auto-invalidates React Query caches when data changes.
 */
export function useRealtimeSubscription() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("crm-realtime");

    const tables = [
      { table: "crm_contacts", queryKey: "contacts" },
      { table: "crm_deals", queryKey: "deals" },
      { table: "crm_tasks", queryKey: "tasks" },
      { table: "crm_activities", queryKey: "activities" },
      { table: "crm_pipelines", queryKey: "pipelines" },
    ];

    for (const { table, queryKey } of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

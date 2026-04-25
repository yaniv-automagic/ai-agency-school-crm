import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Subscribe to Supabase Realtime changes on CRM tables.
 *
 * Invalidations are batched per query key with a short trailing debounce so a
 * burst of writes (bulk import, multi-row update) collapses into a single
 * refetch instead of hammering the API and re-rendering large tables on every
 * row change. Only the *active* (mounted) queries are refetched — stale cached
 * queries for filter combos the user is no longer viewing are just marked
 * invalid and refetched lazily on next mount.
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
      { table: "crm_meetings", queryKey: "meetings" },
      { table: "crm_contracts", queryKey: "contracts" },
      { table: "crm_program_enrollments", queryKey: "enrollments" },
      { table: "crm_notes", queryKey: "notes" },
      { table: "crm_products", queryKey: "products" },
    ];

    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const scheduleInvalidate = (queryKey: string) => {
      const existing = pending.get(queryKey);
      if (existing) clearTimeout(existing);
      pending.set(queryKey, setTimeout(() => {
        pending.delete(queryKey);
        // refetchType:"active" — only currently-mounted queries refetch immediately.
        // Cached-but-unused queries are just marked stale and refetched on next mount.
        queryClient.invalidateQueries({ queryKey: [queryKey], refetchType: "active" });
      }, 400));
    };

    for (const { table, queryKey } of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => scheduleInvalidate(queryKey),
      );
    }

    channel.subscribe();

    return () => {
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

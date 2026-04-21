import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Activity, ActivityType } from "@/types/crm";
import { toast } from "sonner";

const ACTIVITIES_KEY = ["activities"];

export function useActivities(filters?: {
  contact_id?: string;
  deal_id?: string;
  type?: ActivityType;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...ACTIVITIES_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .from("crm_activities")
        .select("*, performer:crm_team_members!performed_by(*)")
        .order("performed_at", { ascending: false });

      if (filters?.contact_id) query = query.eq("contact_id", filters.contact_id);
      if (filters?.deal_id) query = query.eq("deal_id", filters.deal_id);
      if (filters?.type) query = query.eq("type", filters.type);
      if (filters?.limit) query = query.limit(filters.limit);

      const { data, error } = await query;
      if (error) throw error;
      return data as Activity[];
    },
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activity: Partial<Activity>) => {
      const { data, error } = await supabase
        .from("crm_activities")
        .insert({
          ...activity,
          performed_at: activity.performed_at || new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as Activity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITIES_KEY });
    },
    onError: (error: Error) => {
      toast.error(`שגיאה: ${error.message}`);
    },
  });
}

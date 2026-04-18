import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import type { Deal, DealStatus, Pipeline, PipelineStage } from "@/types/crm";
import { toast } from "sonner";

const DEALS_KEY = ["deals"];
const PIPELINES_KEY = ["pipelines"];

export function useDeals(filters?: {
  pipeline_id?: string;
  stage_id?: string;
  status?: DealStatus;
  contact_id?: string;
}) {
  return useQuery({
    queryKey: [...DEALS_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .from("crm_deals")
        .select("*, contact:crm_contacts(*), stage:crm_pipeline_stages(*), assigned_member:crm_team_members!assigned_to(*)")
        .order("created_at", { ascending: false });

      if (filters?.pipeline_id) query = query.eq("pipeline_id", filters.pipeline_id);
      if (filters?.stage_id) query = query.eq("stage_id", filters.stage_id);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.contact_id) query = query.eq("contact_id", filters.contact_id);

      const { data, error } = await query;
      if (error) throw error;
      return data as Deal[];
    },
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: [...DEALS_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("crm_deals")
        .select("*, contact:crm_contacts(*), stage:crm_pipeline_stages(*), product:crm_products(*), assigned_member:crm_team_members!assigned_to(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Deal;
    },
    enabled: !!id,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deal: Partial<Deal>) => {
      const { data, error } = await supabase
        .from("crm_deals")
        .insert(deal)
        .select()
        .single();
      if (error) throw error;
      return data as Deal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEALS_KEY });
      toast.success("עסקה נוצרה בהצלחה");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה ביצירת עסקה: ${error.message}`);
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Deal> & { id: string }) => {
      const { data, error } = await supabase
        .from("crm_deals")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Deal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEALS_KEY });
      toast.success("עסקה עודכנה");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בעדכון: ${error.message}`);
    },
  });
}

export function usePipelines() {
  return useQuery({
    queryKey: PIPELINES_KEY,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from("crm_pipelines")
        .select("*, stages:crm_pipeline_stages(*)");
      if (error) throw error;
      // Sort stages by order_index
      return (data as Pipeline[]).map(p => ({
        ...p,
        stages: p.stages?.sort((a, b) => a.order_index - b.order_index),
      }));
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Meeting, MeetingType, MeetingStatus } from "@/types/crm";
import { toast } from "sonner";

const KEY = ["meetings"];

export function useMeetings(filters?: {
  contact_id?: string;
  deal_id?: string;
  meeting_type?: MeetingType;
  status?: MeetingStatus;
  from_date?: string;
  to_date?: string;
}) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: async () => {
      let q = supabase
        .from("crm_meetings")
        .select("*, contact:crm_contacts(id, first_name, last_name, email, phone)")
        .order("scheduled_at", { ascending: false });

      if (filters?.contact_id) q = q.eq("contact_id", filters.contact_id);
      if (filters?.deal_id) q = q.eq("deal_id", filters.deal_id);
      if (filters?.meeting_type) q = q.eq("meeting_type", filters.meeting_type);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.from_date) q = q.gte("scheduled_at", filters.from_date);
      if (filters?.to_date) q = q.lte("scheduled_at", filters.to_date);

      const { data, error } = await q;
      if (error) throw error;
      return data as Meeting[];
    },
  });
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("crm_meetings")
        .select("*, contact:crm_contacts(*), deal:crm_deals(id, title, value)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Meeting;
    },
    enabled: !!id,
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meeting: Partial<Meeting>) => {
      const { data, error } = await supabase.from("crm_meetings").insert(meeting).select().single();
      if (error) throw error;
      return data as Meeting;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("פגישה נוצרה"); },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Meeting> & { id: string }) => {
      const { data, error } = await supabase
        .from("crm_meetings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Meeting;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("פגישה עודכנה"); },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}

export function useMeetingStats() {
  return useQuery({
    queryKey: [...KEY, "stats"],
    queryFn: async () => {
      const { data: all } = await supabase.from("crm_meetings").select("status, outcome, meeting_type");
      if (!all) return { total: 0, scheduled: 0, completed: 0, noShow: 0, showRate: 0, closeRate: 0 };

      const total = all.length;
      const scheduled = all.filter(m => m.status === "scheduled" || m.status === "confirmed").length;
      const completed = all.filter(m => m.status === "completed").length;
      const noShow = all.filter(m => m.status === "no_show").length;
      const showRate = total > 0 ? (completed / (completed + noShow)) * 100 : 0;
      const sales = all.filter(m => m.meeting_type === "sales_consultation" && m.status === "completed");
      const won = sales.filter(m => m.outcome === "won").length;
      const closeRate = sales.length > 0 ? (won / sales.length) * 100 : 0;

      return { total, scheduled, completed, noShow, showRate: Math.round(showRate), closeRate: Math.round(closeRate) };
    },
  });
}

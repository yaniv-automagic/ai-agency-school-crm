import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Meeting, MeetingType, MeetingStatus } from "@/types/crm";
import { toast } from "sonner";

const KEY = ["meetings"];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  };
}

async function syncCalendarEvent(tenantId: string, meetingId: string, method: "POST" | "PUT") {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/integrations/google-calendar/events`, {
      method,
      headers,
      body: JSON.stringify({ tenantId, meetingId }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn("[Calendar Sync]", data.error || res.statusText);
    } else {
      console.log("[Calendar Sync] OK", method, meetingId);
    }
  } catch (err) {
    console.warn("[Calendar Sync] Failed:", err);
  }
}

export function useMeetings(filters?: {
  contact_id?: string;
  deal_id?: string;
  meeting_type?: MeetingType;
  status?: MeetingStatus;
  assigned_to?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: async () => {
      let q = supabase
        .from("crm_meetings")
        .select("*, contact:crm_contacts(id, first_name, last_name, email, phone, status), assigned_member:crm_team_members!assigned_to(id, display_name, avatar_url)")
        .order("scheduled_at", { ascending: false });

      if (filters?.contact_id) q = q.eq("contact_id", filters.contact_id);
      if (filters?.deal_id) q = q.eq("deal_id", filters.deal_id);
      if (filters?.meeting_type) q = q.eq("meeting_type", filters.meeting_type);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.assigned_to) q = q.eq("assigned_to", filters.assigned_to);
      if (filters?.from_date) q = q.gte("scheduled_at", filters.from_date);
      if (filters?.to_date) q = q.lte("scheduled_at", filters.to_date);
      if (filters?.search) q = q.or(`title.ilike.%${filters.search}%`);

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

interface CreateMeetingInput extends Partial<Meeting> {
  _tenantId?: string;
  _performedBy?: string;
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMeetingInput) => {
      const { _tenantId, _performedBy, ...meetingData } = input;

      // Set tenant_id
      if (_tenantId) {
        meetingData.tenant_id = _tenantId;
      }

      // Auto-assign: if no assigned_to, get from contact
      if (!meetingData.assigned_to && meetingData.contact_id) {
        const { data: contact } = await supabase
          .from("crm_contacts")
          .select("assigned_to")
          .eq("id", meetingData.contact_id)
          .single();
        if (contact?.assigned_to) {
          meetingData.assigned_to = contact.assigned_to;
        }
      }

      const { data, error } = await supabase
        .from("crm_meetings")
        .insert(meetingData)
        .select()
        .single();
      if (error) throw error;

      // Log timeline activity (best-effort)
      try {
        const scheduledDate = new Date(data.scheduled_at).toLocaleString("he-IL");
        await supabase.from("crm_activities").insert({
          tenant_id: _tenantId || null,
          contact_id: data.contact_id,
          type: "meeting",
          subject: data.title,
          body: `פגישה נקבעה ל-${scheduledDate}`,
          performed_by: _performedBy || null,
        });
      } catch {
        console.warn("[Meeting] Failed to log activity");
      }

      // Create Google Calendar event (best-effort, non-blocking)
      if (_tenantId) {
        syncCalendarEvent(_tenantId, data.id, "POST");
      }

      return data as Meeting;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["activities"] });
      toast.success("פגישה נוצרה");
    },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}

interface UpdateMeetingInput extends Partial<Meeting> {
  id: string;
  _tenantId?: string;
}

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, _tenantId, ...updates }: UpdateMeetingInput) => {
      const { data, error } = await supabase
        .from("crm_meetings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // Sync to Google Calendar (best-effort)
      if (_tenantId && data.google_event_id) {
        syncCalendarEvent(_tenantId, id, "PUT");
      }

      return data as Meeting;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("פגישה עודכנה"); },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}

export function useDeleteMeetings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("crm_meetings").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}

export function useMeetingStats(meetingType?: MeetingType) {
  return useQuery({
    queryKey: [...KEY, "stats", meetingType],
    queryFn: async () => {
      let q = supabase.from("crm_meetings").select("status, outcome, meeting_type");
      if (meetingType) q = q.eq("meeting_type", meetingType);
      const { data: all } = await q;
      if (!all) return { scheduled: 0, cancelled: 0, completed: 0, showRate: 0 };

      const scheduled = all.filter(m => m.status === "scheduled" || m.status === "confirmed").length;
      const cancelled = all.filter(m => m.status === "cancelled").length;
      const completed = all.filter(m => m.status === "completed").length;
      const noShow = all.filter(m => m.status === "no_show").length;
      const decidedTotal = completed + noShow;
      const showRate = decidedTotal > 0 ? Math.round((completed / decidedTotal) * 100) : 0;

      return { scheduled, cancelled, completed, showRate };
    },
  });
}

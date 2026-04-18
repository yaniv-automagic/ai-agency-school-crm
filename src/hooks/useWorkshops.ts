import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Workshop, WorkshopSession, WorkshopParticipant } from "@/types/crm";
import { toast } from "sonner";

const KEY = ["workshops"];

export function useWorkshops() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_workshops")
        .select("*, product:crm_products(id, name), sessions:crm_workshop_sessions(id), participants:crm_workshop_participants(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Workshop[];
    },
  });
}

export function useWorkshop(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("crm_workshops")
        .select("*, product:crm_products(id, name), sessions:crm_workshop_sessions(*), participants:crm_workshop_participants(*, contact:crm_contacts(id, first_name, last_name, email, phone, avatar_url))")
        .eq("id", id)
        .single();
      if (error) throw error;
      // Sort sessions
      if (data?.sessions) {
        data.sessions.sort((a: any, b: any) => a.session_number - b.session_number);
      }
      return data as Workshop;
    },
    enabled: !!id,
  });
}

export function useCreateWorkshop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workshop: Partial<Workshop>) => {
      const { data, error } = await supabase.from("crm_workshops").insert(workshop).select().single();
      if (error) throw error;
      return data as Workshop;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("סדנה נוצרה"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateWorkshop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Workshop> & { id: string }) => {
      const { error } = await supabase.from("crm_workshops").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteWorkshop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_workshops").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("סדנה נמחקה"); },
  });
}

// Sessions
export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (session: Partial<WorkshopSession>) => {
      const { data, error } = await supabase.from("crm_workshop_sessions").insert(session).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("מפגש נוצר"); },
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, any>) => {
      const { error } = await supabase.from("crm_workshop_sessions").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_workshop_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("מפגש נמחק"); },
  });
}

// Participants
export function useAddParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { workshop_id: string; contact_id: string; enrollment_id?: string }) => {
      const { error } = await supabase.from("crm_workshop_participants").insert(data);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("תלמיד נוסף"); },
    onError: (e: Error) => {
      if (e.message.includes("duplicate")) toast.error("התלמיד כבר רשום לסדנה");
      else toast.error(e.message);
    },
  });
}

export function useRemoveParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_workshop_participants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("תלמיד הוסר"); },
  });
}

// Attendance
export function useSessionAttendance(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["attendance", sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from("crm_session_attendance")
        .select("*, participant:crm_workshop_participants(*, contact:crm_contacts(id, first_name, last_name, avatar_url))")
        .eq("session_id", sessionId);
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });
}

export function useToggleAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, participantId, attended }: { sessionId: string; participantId: string; attended: boolean }) => {
      const { data: existing } = await supabase
        .from("crm_session_attendance")
        .select("id")
        .eq("session_id", sessionId)
        .eq("participant_id", participantId)
        .single();

      if (existing) {
        await supabase.from("crm_session_attendance").update({ attended }).eq("id", existing.id);
      } else {
        await supabase.from("crm_session_attendance").insert({ session_id: sessionId, participant_id: participantId, attended });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ProgramEnrollment, ProgramSession, EnrollmentStatus } from "@/types/crm";
import { toast } from "sonner";

const KEY = ["enrollments"];

export function useEnrollments(filters?: {
  contact_id?: string;
  product_id?: string;
  status?: EnrollmentStatus;
}) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: async () => {
      let q = supabase
        .from("crm_program_enrollments")
        .select("*, contact:crm_contacts(id, first_name, last_name, email), product:crm_products(id, name, category), sessions:crm_program_sessions(*)")
        .order("created_at", { ascending: false });

      if (filters?.contact_id) q = q.eq("contact_id", filters.contact_id);
      if (filters?.product_id) q = q.eq("product_id", filters.product_id);
      if (filters?.status) q = q.eq("status", filters.status);

      const { data, error } = await q;
      if (error) throw error;
      return data as ProgramEnrollment[];
    },
  });
}

export function useEnrollment(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("crm_program_enrollments")
        .select("*, contact:crm_contacts(*), product:crm_products(*), sessions:crm_program_sessions(*, meeting:crm_meetings(*))")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ProgramEnrollment;
    },
    enabled: !!id,
  });
}

export function useCreateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enrollment: Partial<ProgramEnrollment> & { sessions_to_create?: { type: string; count: number }[] }) => {
      const { sessions_to_create, ...enrollmentData } = enrollment as any;
      const { data, error } = await supabase.from("crm_program_enrollments").insert(enrollmentData).select().single();
      if (error) throw error;

      // Auto-create sessions if specified
      if (sessions_to_create && data) {
        let sessionNum = 1;
        for (const { type, count } of sessions_to_create) {
          for (let i = 0; i < count; i++) {
            await supabase.from("crm_program_sessions").insert({
              enrollment_id: data.id,
              session_number: sessionNum++,
              session_type: type,
              status: "planned",
            });
          }
        }
      }

      return data as ProgramEnrollment;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("הרשמה לתכנית נוצרה"); },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}

export function useUpdateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProgramEnrollment> & { id: string }) => {
      const { error } = await supabase.from("crm_program_enrollments").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); },
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProgramSession> & { id: string }) => {
      const { error } = await supabase.from("crm_program_sessions").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); },
  });
}

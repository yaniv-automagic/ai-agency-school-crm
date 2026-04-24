import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Contact, ContactStatus, ContactSource } from "@/types/crm";
import { toast } from "sonner";

const CONTACTS_KEY = ["contacts"];

export function useContacts(filters?: {
  status?: ContactStatus;
  stage_id?: string;
  source?: ContactSource;
  search?: string;
  assigned_to?: string;
}) {
  return useQuery({
    queryKey: [...CONTACTS_KEY, filters],
    queryFn: async () => {
      const buildQuery = () => {
        let query = supabase
          .from("crm_contacts")
          // List view: no joins — UI does client-side lookup from usePipelines/useTeamMembers caches.
          // Per-contact detail (notes, custom_fields, heavy columns) loads via useContact(id).
          .select(
            "id,first_name,last_name,email,phone,whatsapp_phone,avatar_url," +
              "company,job_title,address,city,id_number," +
              "status,source,tags,stage_id,assigned_to,account_id,entry_type,ad_platform," +
              "loss_reason,disqualification_reason,next_followup_at," +
              "marketing_consent,marketing_consent_at," +
              "webinar_registered,webinar_attended,sales_call_completed,community_groups," +
              "utm_source,utm_medium,utm_campaign,utm_content,utm_term," +
              "landing_page_url,first_touch_at,conversion_at,created_at,updated_at"
          )
          .order("created_at", { ascending: false });
        if (filters?.stage_id) query = query.eq("stage_id", filters.stage_id);
        else if (filters?.status) query = query.eq("status", filters.status);
        if (filters?.source) query = query.eq("source", filters.source);
        if (filters?.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
        if (filters?.search) {
          query = query.or(
            `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
          );
        }
        return query;
      };

      // Supabase PostgREST caps each response at 1000 rows.
      // Fetch pages in parallel (up to 10k rows) instead of sequentially.
      const PAGE_SIZE = 1000;
      const MAX_PAGES = 10;
      const pagePromises = Array.from({ length: MAX_PAGES }, (_, i) =>
        buildQuery().range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1)
      );
      const pageResults = await Promise.all(pagePromises);
      const all: Contact[] = [];
      for (const { data, error } of pageResults) {
        if (error) throw error;
        if (data && data.length) all.push(...(data as Contact[]));
      }
      return all;
    },
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: [...CONTACTS_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("crm_contacts")
        .select("*, stage:crm_pipeline_stages(*), assigned_member:crm_team_members!assigned_to(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Contact;
    },
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contact: Partial<Contact>) => {
      const { data, error } = await supabase
        .from("crm_contacts")
        .insert({ marketing_consent: true, marketing_consent_at: new Date().toISOString(), ...contact })
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
      toast.success("ליד נוצר בהצלחה");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה ביצירת ליד: ${error.message}`);
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: string }) => {
      const { data, error } = await supabase
        .from("crm_contacts")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*, stage:crm_pipeline_stages(*), assigned_member:crm_team_members!assigned_to(*)")
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: (data, { id }) => {
      // Update single contact cache immediately
      queryClient.setQueryData([...CONTACTS_KEY, id], data);
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בעדכון: ${error.message}`);
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crm_contacts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
      toast.success("ליד נמחק");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה במחיקה: ${error.message}`);
    },
  });
}

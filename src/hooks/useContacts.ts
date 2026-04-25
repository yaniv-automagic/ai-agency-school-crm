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
          const raw = filters.search.trim();
          // Phone search: normalize the query so "0507573326", "+972507573326",
          // "972507573326", "050-757-3326" all hit the same record.
          const phoneDigits = raw.replace(/\D/g, "");
          const phoneVariants: string[] = [];
          if (phoneDigits.length >= 7) {
            phoneVariants.push(phoneDigits);
            if (phoneDigits.startsWith("972")) phoneVariants.push("0" + phoneDigits.slice(3));
            else if (phoneDigits.startsWith("0")) phoneVariants.push("+972" + phoneDigits.slice(1), "972" + phoneDigits.slice(1));
          }

          // Multi-word name search: each token must hit at least one of
          // first_name/last_name/email. PostgREST: and=(or(...),or(...))
          const tokens = raw.split(/\s+/).filter(Boolean);
          const tokenClauses = tokens.map(t => {
            const e = t.replace(/[(),%]/g, ""); // strip filter syntax chars
            return `or(first_name.ilike.%${e}%,last_name.ilike.%${e}%,email.ilike.%${e}%)`;
          });

          const phoneOr = phoneVariants.length
            ? phoneVariants.map(p => `phone.ilike.%${p}%`).join(",")
            : `phone.ilike.%${raw}%`;

          if (tokens.length > 1) {
            // Match (all tokens AND-ed in name/email) OR phone match
            // PostgREST: or=(and(or(t1...),or(t2...)),phone.ilike.x,phone.ilike.y)
            query = query.or(`and(${tokenClauses.join(",")}),${phoneOr}`);
          } else {
            const t = (tokens[0] || raw).replace(/[(),%]/g, "");
            query = query.or(
              `first_name.ilike.%${t}%,last_name.ilike.%${t}%,email.ilike.%${t}%,${phoneOr}`
            );
          }
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

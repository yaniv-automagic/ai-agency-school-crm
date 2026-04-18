import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Contact, ContactStatus, ContactSource } from "@/types/crm";
import { toast } from "sonner";

const CONTACTS_KEY = ["contacts"];

export function useContacts(filters?: {
  status?: ContactStatus;
  source?: ContactSource;
  search?: string;
  assigned_to?: string;
}) {
  return useQuery({
    queryKey: [...CONTACTS_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .from("crm_contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.source) {
        query = query.eq("source", filters.source);
      }
      if (filters?.assigned_to) {
        query = query.eq("assigned_to", filters.assigned_to);
      }
      if (filters?.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Contact[];
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
        .select("*")
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
        .insert(contact)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
      toast.success("איש קשר נוצר בהצלחה");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה ביצירת איש קשר: ${error.message}`);
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
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
      toast.success("איש קשר עודכן בהצלחה");
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
      toast.success("איש קשר נמחק");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה במחיקה: ${error.message}`);
    },
  });
}

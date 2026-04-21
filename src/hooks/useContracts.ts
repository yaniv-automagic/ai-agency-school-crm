import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Contract, ContractTemplate, ContractStatus, ContractAuditLog } from "@/types/crm";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const KEY = ["contracts"];

export function useContracts(filters?: { contact_id?: string; deal_id?: string; status?: ContractStatus }) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: async () => {
      let q = supabase
        .from("crm_contracts")
        .select("*, contact:crm_contacts(id, first_name, last_name, email)")
        .order("created_at", { ascending: false });
      if (filters?.contact_id) q = q.eq("contact_id", filters.contact_id);
      if (filters?.deal_id) q = q.eq("deal_id", filters.deal_id);
      if (filters?.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data as Contract[];
    },
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("crm_contracts").select("*, contact:crm_contacts(*), deal:crm_deals(*)").eq("id", id).single();
      if (error) throw error;
      return data as Contract;
    },
    enabled: !!id,
  });
}

export function useContractByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["contract-sign", token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase.from("crm_contracts").select("*, contact:crm_contacts(first_name, last_name, email)").eq("sign_token", token).single();
      if (error) throw error;
      return data as Contract;
    },
    enabled: !!token,
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contract: Partial<Contract>) => {
      const sign_token = crypto.randomUUID();
      const { data, error } = await supabase.from("crm_contracts").insert({ ...contract, sign_token }).select().single();
      if (error) throw error;
      return data as Contract;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("חוזה נוצר"); },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contract> & { id: string }) => {
      const { error } = await supabase.from("crm_contracts").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); },
  });
}

export function useContractTemplates() {
  return useQuery({
    queryKey: ["contract-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_contract_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ContractTemplate[];
    },
  });
}

export function useCreateContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: Partial<ContractTemplate> & { blocks_json?: Record<string, unknown>[]; canvas_settings?: Record<string, unknown> }) => {
      const { data, error } = await supabase.from("crm_contract_templates").insert(template).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-templates"] }); toast.success("תבנית חוזה נוצרה"); },
  });
}

export function useUpdateContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ContractTemplate> & { blocks_json?: Record<string, unknown>[]; canvas_settings?: Record<string, unknown> }) => {
      const { error } = await supabase.from("crm_contract_templates").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-templates"] }); },
  });
}

export function useDeleteContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_contract_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-templates"] }); toast.success("תבנית נמחקה"); },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}

// ── Signing Compliance Hooks ──

export function useContractAuditLog(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contract-audit-log", contractId],
    queryFn: async () => {
      if (!contractId) return [];
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${BACKEND_URL}/api/contracts/${contractId}/audit-log`, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return (await res.json()) as ContractAuditLog[];
    },
    enabled: !!contractId,
  });
}

export function useSendContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...params }: { id: string; email_subject?: string; email_body?: string; expires_in_days?: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${BACKEND_URL}/api/contracts/${id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בשליחה");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["contract-audit-log"] });
      toast.success("החוזה נשלח לחתימה");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

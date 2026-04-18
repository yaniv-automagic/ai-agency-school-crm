import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Task, TaskStatus, TaskPriority } from "@/types/crm";
import { toast } from "sonner";

const TASKS_KEY = ["tasks"];

export function useTasks(filters?: {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string;
  contact_id?: string;
  deal_id?: string;
}) {
  return useQuery({
    queryKey: [...TASKS_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .from("crm_tasks")
        .select("*, contact:crm_contacts(id, first_name, last_name)")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.priority) query = query.eq("priority", filters.priority);
      if (filters?.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
      if (filters?.contact_id) query = query.eq("contact_id", filters.contact_id);
      if (filters?.deal_id) query = query.eq("deal_id", filters.deal_id);

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Partial<Task>) => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .insert(task)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      toast.success("משימה נוצרה");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה: ${error.message}`);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
    onError: (error: Error) => {
      toast.error(`שגיאה: ${error.message}`);
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crm_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      toast.success("משימה הושלמה");
    },
  });
}

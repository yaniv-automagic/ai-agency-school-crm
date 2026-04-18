import { useState } from "react";
import { ListTodo, Check, Circle, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface TaskItem {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  status: string;
  type: string;
  contact_name?: string;
  is_overdue: boolean;
}

function useTodayTasks() {
  return useQuery({
    queryKey: ["today-tasks"],
    queryFn: async () => {
      const now = new Date();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      // Tasks due today or overdue
      const { data: tasks } = await supabase
        .from("crm_tasks")
        .select("id, title, due_date, priority, status, type, contact_id, crm_contacts(first_name, last_name)")
        .lt("due_date", todayEnd)
        .in("status", ["pending", "in_progress"])
        .order("due_date", { ascending: true })
        .limit(20);

      const items: TaskItem[] = [];

      tasks?.forEach((t: any) => {
        const contact = t.crm_contacts;
        items.push({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          priority: t.priority,
          status: t.status,
          type: t.type,
          contact_name: contact ? `${contact.first_name} ${contact.last_name}` : undefined,
          is_overdue: new Date(t.due_date).getTime() < now.getTime(),
        });
      });

      // Sort: overdue first, then by priority
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      items.sort((a, b) => {
        if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      });

      return items;
    },
    refetchInterval: 60000,
  });
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "text-red-600 bg-red-50 dark:bg-red-950/30",
  high: "text-orange-600 bg-orange-50 dark:bg-orange-950/30",
  medium: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  low: "text-gray-500 bg-gray-50 dark:bg-gray-800/30",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "דחוף",
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
};

export default function TodayTasks() {
  const [open, setOpen] = useState(false);
  const { data: tasks } = useTodayTasks();
  const navigate = useNavigate();

  const pendingCount = tasks?.length || 0;
  const overdueCount = tasks?.filter(t => t.is_overdue).length || 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors relative"
        title="משימות להיום"
      >
        <ListTodo size={20} />
        {pendingCount > 0 && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center",
            overdueCount > 0 ? "bg-red-500" : "bg-amber-500"
          )}>
            {pendingCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden" dir="rtl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold">
                המשימות שלי
                {overdueCount > 0 && (
                  <span className="text-[11px] text-red-500 font-normal mr-2">({overdueCount} באיחור)</span>
                )}
              </h3>
              <button
                onClick={() => { navigate("/tasks"); setOpen(false); }}
                className="text-[11px] text-primary font-medium hover:underline"
              >
                כל המשימות
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {tasks && tasks.length > 0 ? (
                tasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => { navigate("/tasks"); setOpen(false); }}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-right hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0",
                      task.is_overdue && "bg-red-50/50 dark:bg-red-950/10"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      task.is_overdue ? "bg-red-100 text-red-500" : "bg-secondary text-muted-foreground"
                    )}>
                      {task.is_overdue ? <AlertTriangle size={14} /> : <Circle size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                      </div>
                      {task.contact_name && (
                        <p className="text-xs text-muted-foreground truncate">{task.contact_name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", PRIORITY_STYLES[task.priority])}>
                          {PRIORITY_LABELS[task.priority] || task.priority}
                        </span>
                        {task.is_overdue && (
                          <span className="text-[10px] text-red-500 font-medium">באיחור</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-10 text-center">
                  <Check size={24} className="mx-auto mb-2 text-green-400" />
                  <p className="text-sm text-muted-foreground">אין משימות פתוחות להיום</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

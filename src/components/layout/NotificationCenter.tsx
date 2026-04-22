import { useState, useEffect } from "react";
import { Bell, X, CheckCheck, Clock, UserPlus, Kanban, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn, timeAgo } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useUserPreference } from "@/hooks/useUserPreferences";

interface Notification {
  id: string;
  type: "new_lead" | "deal_won" | "deal_lost" | "task_overdue" | "task_due" | "system";
  title: string;
  body: string;
  link?: string;
  read: boolean;
  created_at: string;
}

// Generate notifications from CRM data
function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const notifications: Notification[] = [];
      const now = new Date();

      // New contacts in last 24h
      const yesterday = new Date(now.getTime() - 86400000).toISOString();
      const { data: newContacts } = await supabase
        .from("crm_contacts")
        .select("id, first_name, last_name, created_at")
        .gte("created_at", yesterday)
        .order("created_at", { ascending: false })
        .limit(5);

      newContacts?.forEach(c => {
        notifications.push({
          id: `lead-${c.id}`,
          type: "new_lead",
          title: "ליד חדש",
          body: `${c.first_name} ${c.last_name} נוסף למערכת`,
          link: `/contacts/${c.id}`,
          read: false,
          created_at: c.created_at,
        });
      });

      // Overdue tasks
      const { data: overdueTasks } = await supabase
        .from("crm_tasks")
        .select("id, title, due_date")
        .lt("due_date", now.toISOString())
        .in("status", ["pending", "in_progress"])
        .limit(5);

      overdueTasks?.forEach(t => {
        notifications.push({
          id: `task-${t.id}`,
          type: "task_overdue",
          title: "משימה באיחור",
          body: t.title,
          link: "/tasks",
          read: false,
          created_at: t.due_date,
        });
      });

      // Tasks due today
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const { data: todayTasks } = await supabase
        .from("crm_tasks")
        .select("id, title, due_date")
        .gte("due_date", now.toISOString())
        .lt("due_date", todayEnd)
        .in("status", ["pending", "in_progress"])
        .limit(3);

      todayTasks?.forEach(t => {
        notifications.push({
          id: `due-${t.id}`,
          type: "task_due",
          title: "משימה להיום",
          body: t.title,
          link: "/tasks",
          read: false,
          created_at: t.due_date,
        });
      });

      // Won deals in last 7 days
      const lastWeek = new Date(now.getTime() - 7 * 86400000).toISOString();
      const { data: wonDeals } = await supabase
        .from("crm_deals")
        .select("id, title, value, updated_at")
        .eq("status", "won")
        .gte("updated_at", lastWeek)
        .limit(3);

      wonDeals?.forEach(d => {
        notifications.push({
          id: `won-${d.id}`,
          type: "deal_won",
          title: "עסקה נסגרה!",
          body: `${d.title} — ₪${d.value?.toLocaleString()}`,
          link: `/pipeline/${d.id}`,
          read: false,
          created_at: d.updated_at,
        });
      });

      return notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

const ICON_MAP: Record<string, { icon: any; cls: string }> = {
  new_lead: { icon: UserPlus, cls: "bg-blue-100 text-blue-600" },
  deal_won: { icon: Kanban, cls: "bg-green-100 text-green-600" },
  deal_lost: { icon: Kanban, cls: "bg-red-100 text-red-600" },
  task_overdue: { icon: AlertTriangle, cls: "bg-red-100 text-red-500" },
  task_due: { icon: Clock, cls: "bg-amber-100 text-amber-600" },
  system: { icon: Bell, cls: "bg-gray-100 text-gray-500" },
};

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { data: notifications } = useNotifications();
  const [dbReadIds, persistReadIds] = useUserPreference<string[]>("notif-read", []);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => { setReadIds(new Set(dbReadIds)); }, [dbReadIds]);

  const unreadCount = notifications?.filter(n => !readIds.has(n.id)).length || 0;

  const markAllRead = () => {
    if (!notifications) return;
    const allIds = new Set([...readIds, ...notifications.map(n => n.id)]);
    setReadIds(allIds);
    persistReadIds([...allIds]);
  };

  const handleClick = (n: Notification) => {
    const newRead = new Set([...readIds, n.id]);
    setReadIds(newRead);
    persistReadIds([...newRead]);
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden" dir="rtl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold">התראות</h3>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-primary font-medium hover:underline">
                  סמן הכל כנקרא
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications && notifications.length > 0 ? (
                notifications.slice(0, 15).map(n => {
                  const isRead = readIds.has(n.id);
                  const { icon: Icon, cls } = ICON_MAP[n.type] || ICON_MAP.system;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-right hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0",
                        !isRead && "bg-primary/3"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", cls)}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn("text-sm", !isRead ? "font-semibold" : "font-medium text-muted-foreground")}>{n.title}</p>
                          {!isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo(n.created_at)}</p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-10 text-center">
                  <Bell size={24} className="mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">אין התראות</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { Clock, Video, Phone, Users, Calendar, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface ScheduleItem {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_type: string;
  status: string;
  contact_name?: string;
}

function useTodaySchedule() {
  return useQuery({
    queryKey: ["today-schedule"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      const { data: meetings } = await supabase
        .from("crm_meetings")
        .select("id, title, scheduled_at, duration_minutes, meeting_type, status, contact_id, crm_contacts(first_name, last_name)")
        .gte("scheduled_at", todayStart)
        .lt("scheduled_at", todayEnd)
        .not("status", "in", '("cancelled")')
        .order("scheduled_at", { ascending: true });

      const { data: tasks } = await supabase
        .from("crm_tasks")
        .select("id, title, due_date, type, status, contact_id, crm_contacts(first_name, last_name)")
        .gte("due_date", todayStart)
        .lt("due_date", todayEnd)
        .in("type", ["call", "meeting"])
        .in("status", ["pending", "in_progress"])
        .order("due_date", { ascending: true });

      const items: ScheduleItem[] = [];

      meetings?.forEach((m: any) => {
        const contact = m.crm_contacts;
        items.push({
          id: `meeting-${m.id}`,
          title: m.title,
          scheduled_at: m.scheduled_at,
          duration_minutes: m.duration_minutes || 60,
          meeting_type: m.meeting_type,
          status: m.status,
          contact_name: contact ? `${contact.first_name} ${contact.last_name}` : undefined,
        });
      });

      tasks?.forEach((t: any) => {
        const contact = t.crm_contacts;
        items.push({
          id: `task-${t.id}`,
          title: t.title,
          scheduled_at: t.due_date,
          duration_minutes: 30,
          meeting_type: t.type,
          status: t.status,
          contact_name: contact ? `${contact.first_name} ${contact.last_name}` : undefined,
        });
      });

      items.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      return items;
    },
    refetchInterval: 60000,
  });
}

const TYPE_ICONS: Record<string, any> = {
  sales_consultation: Video,
  mentoring_1on1: Users,
  mastermind_group: Users,
  other: Calendar,
  call: Phone,
  meeting: Video,
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function isNow(dateStr: string, durationMin: number) {
  const now = Date.now();
  const start = new Date(dateStr).getTime();
  const end = start + durationMin * 60000;
  return now >= start && now <= end;
}

function isPast(dateStr: string, durationMin: number) {
  const end = new Date(dateStr).getTime() + durationMin * 60000;
  return Date.now() > end;
}

export default function TodaySchedule() {
  const [open, setOpen] = useState(false);
  const { data: items } = useTodaySchedule();
  const navigate = useNavigate();

  const upcomingCount = items?.filter(i => !isPast(i.scheduled_at, i.duration_minutes)).length || 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors relative"
        title="לוז היום"
      >
        <Clock size={20} />
        {upcomingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {upcomingCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden" dir="rtl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold">הלוז שלי להיום</h3>
              <button
                onClick={() => { navigate("/calendar"); setOpen(false); }}
                className="text-[11px] text-primary font-medium hover:underline"
              >
                לוח שנה מלא
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {items && items.length > 0 ? (
                items.map(item => {
                  const Icon = TYPE_ICONS[item.meeting_type] || Calendar;
                  const now = isNow(item.scheduled_at, item.duration_minutes);
                  const past = isPast(item.scheduled_at, item.duration_minutes);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors",
                        now && "bg-blue-50 dark:bg-blue-950/30",
                        past && "opacity-50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        now ? "bg-blue-100 text-blue-600" : "bg-secondary text-muted-foreground"
                      )}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn("text-sm font-medium", past && "line-through")}>{item.title}</p>
                          {now && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded-full font-bold">עכשיו</span>}
                        </div>
                        {item.contact_name && (
                          <p className="text-xs text-muted-foreground truncate">{item.contact_name}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                          {formatTime(item.scheduled_at)} · {item.duration_minutes} דקות
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center">
                  <Clock size={24} className="mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">אין אירועים להיום</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

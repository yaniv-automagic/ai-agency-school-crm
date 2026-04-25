import { useState } from "react";
import { Plus, Video, Radio, Users, Calendar, ExternalLink, ChevronLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toast } from "sonner";

interface CrmEvent {
  id: string;
  event_type: "webinar" | "live_community" | "workshop";
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  recording_url: string | null;
  status: "upcoming" | "live" | "completed" | "cancelled";
  registered_count: number;
  attended_count: number;
  leads_generated: number;
  deals_count: number;
  revenue: number;
  cohort: string | null;
  notes: string | null;
  created_at: string;
}

const EVENT_TYPES = [
  { value: "webinar", label: "וובינר שיווקי", icon: Video, color: "bg-blue-100 text-blue-700" },
  { value: "live_community", label: "לייב קהילתי", icon: Radio, color: "bg-purple-100 text-purple-700" },
  { value: "workshop", label: "סדנה", icon: Users, color: "bg-green-100 text-green-700" },
] as const;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  upcoming: { label: "קרוב", color: "bg-blue-100 text-blue-700" },
  live: { label: "שידור חי", color: "bg-red-100 text-red-700" },
  completed: { label: "הסתיים", color: "bg-green-100 text-green-700" },
  cancelled: { label: "בוטל", color: "bg-gray-100 text-gray-500" },
};

export default function EventsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    event_type: "webinar" as CrmEvent["event_type"],
    title: "",
    scheduled_at: "",
    duration_minutes: 60,
    meeting_url: "",
    description: "",
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ["crm_events", filter],
    queryFn: async () => {
      let q = supabase
        .from("crm_events")
        .select("*")
        .order("scheduled_at", { ascending: false });
      if (filter !== "all") q = q.eq("event_type", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CrmEvent[];
    },
  });

  const createEvent = useMutation({
    mutationFn: async (eventData: typeof form) => {
      const scheduledAt = eventData.scheduled_at ? new Date(eventData.scheduled_at).toISOString() : new Date().toISOString();
      const { error } = await supabase.from("crm_events").insert({
        event_type: eventData.event_type,
        title: eventData.title,
        description: eventData.description || null,
        scheduled_at: scheduledAt,
        duration_minutes: eventData.duration_minutes,
        meeting_url: eventData.meeting_url || null,
        status: new Date(scheduledAt) > new Date() ? "upcoming" : "completed",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_events"] });
      toast.success("אירוע נוצר");
      setShowForm(false);
      setForm({ event_type: "webinar", title: "", scheduled_at: "", duration_minutes: 60, meeting_url: "", description: "" });
    },
    onError: (err: any) => toast.error(err?.message || "שגיאה ביצירת אירוע"),
  });

  const allEvents = events || [];
  const stats = {
    total: allEvents.length,
    completed: allEvents.filter(e => e.status === "completed").length,
    upcoming: allEvents.filter(e => e.status === "upcoming").length,
    totalRegistered: allEvents.reduce((s, e) => s + (e.registered_count || 0), 0),
    totalAttended: allEvents.reduce((s, e) => s + (e.attended_count || 0), 0),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">אירועים</h1>
          <p className="text-muted-foreground text-sm">וובינרים, לייבים וסדנאות</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90">
          <Plus size={16} /> אירוע חדש
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto">
        <button onClick={() => setFilter("all")}
          className={cn("px-3 py-1.5 text-sm rounded-lg whitespace-nowrap",
            filter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
          )}>
          הכל ({allEvents.length})
        </button>
        {EVENT_TYPES.map(t => (
          <button key={t.value} onClick={() => setFilter(t.value)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg whitespace-nowrap",
              filter === t.value ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
            )}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">סה״כ אירועים</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold">{stats.totalRegistered.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">סה״כ נרשמים</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold">{stats.totalAttended.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">סה״כ נוכחים</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">הושלמו</p>
        </div>
      </div>

      {/* Events list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : allEvents.length > 0 ? (
        <div className="space-y-3">
          {allEvents.map((event) => {
            const typeInfo = EVENT_TYPES.find(t => t.value === event.event_type);
            const statusInfo = STATUS_MAP[event.status];
            const Icon = typeInfo?.icon || Video;
            return (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") navigate(`/events/${event.id}`); }}
                className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className={cn("p-2.5 rounded-xl shrink-0", typeInfo?.color)}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold">{event.title}</h3>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full", statusInfo?.color)}>
                        {statusInfo?.label}
                      </span>
                      {event.cohort && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {event.cohort}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(event.scheduled_at).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span>· {event.duration_minutes} דק׳</span>
                      {event.registered_count > 0 && <span>· {event.registered_count} נרשמים</span>}
                      {event.attended_count > 0 && <span>· {event.attended_count} נוכחים</span>}
                      {event.deals_count > 0 && <span>· {event.deals_count} עסקאות</span>}
                      {event.revenue > 0 && <span>· ₪{event.revenue.toLocaleString()}</span>}
                    </div>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                    )}
                    {(event.meeting_url || event.recording_url) && (
                      <div className="flex items-center gap-3 mt-2">
                        {event.meeting_url && (
                          <a href={event.meeting_url} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-primary hover:underline flex items-center gap-1">
                            <ExternalLink size={12} /> קישור לאירוע
                          </a>
                        )}
                        {event.recording_url && (
                          <a href={event.recording_url} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-primary hover:underline flex items-center gap-1">
                            <ExternalLink size={12} /> הקלטה
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronLeft size={18} className="text-muted-foreground/40 group-hover:text-primary shrink-0 mt-1 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-40 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <div className="text-center">
            <Video size={36} className="mx-auto mb-2 opacity-20" />
            <p className="font-medium">אין אירועים</p>
            <p className="text-sm">צור וובינר או לייב חדש</p>
          </div>
        </div>
      )}

      {/* Create event form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()} dir="rtl">
            <h2 className="text-lg font-semibold">אירוע חדש</h2>

            <div>
              <label className="text-sm font-medium mb-2 block">סוג אירוע</label>
              <div className="flex gap-2">
                {EVENT_TYPES.map(t => (
                  <button key={t.value} onClick={() => setForm(f => ({ ...f, event_type: t.value }))}
                    className={cn("flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm border rounded-xl transition-colors",
                      form.event_type === t.value ? "border-primary bg-primary/5 text-primary font-medium" : "border-input hover:bg-secondary"
                    )}>
                    <t.icon size={16} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">כותרת *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring"
                placeholder={form.event_type === "webinar" ? "וובינר שבועי - איך לבנות AI Agent" : "לייב קהילתי - Q&A"} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">תאריך ושעה *</label>
                <DateTimePicker value={form.scheduled_at} onChange={v => setForm(f => ({ ...f, scheduled_at: v }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">משך (דקות)</label>
                <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: +e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background" min={15} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">קישור לזום/מיט</label>
              <input value={form.meeting_url} onChange={e => setForm(f => ({ ...f, meeting_url: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background" dir="ltr" placeholder="https://zoom.us/j/..." />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">תיאור</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => createEvent.mutate(form)} disabled={!form.title || !form.scheduled_at || createEvent.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {createEvent.isPending ? "יוצר..." : "צור אירוע"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

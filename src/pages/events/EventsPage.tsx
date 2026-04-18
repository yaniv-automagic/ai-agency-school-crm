import { useState } from "react";
import { Plus, Video, Radio, Users, Calendar, ExternalLink, BarChart3, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn, timeAgo } from "@/lib/utils";
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
  notes: string | null;
  created_at: string;
}

const EVENT_TYPES = [
  { value: "webinar", label: "וובינר שיווקי", icon: Video, color: "bg-blue-100 text-blue-700" },
  { value: "live_community", label: "לייב קהילתי", icon: Radio, color: "bg-purple-100 text-purple-700" },
  { value: "workshop", label: "סדנה", icon: Users, color: "bg-green-100 text-green-700" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  upcoming: { label: "קרוב", color: "bg-blue-100 text-blue-700" },
  live: { label: "שידור חי", color: "bg-red-100 text-red-700" },
  completed: { label: "הסתיים", color: "bg-green-100 text-green-700" },
  cancelled: { label: "בוטל", color: "bg-gray-100 text-gray-500" },
};

// Use crm_meetings table with special types, or a lightweight approach with activities
// For now we'll store events as a special meeting type in crm_meetings
// But to keep it clean, we'll use the existing tasks table with a custom approach

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    event_type: "webinar",
    title: "",
    scheduled_at: "",
    duration_minutes: 60,
    meeting_url: "",
    description: "",
  });

  // Store events as meetings with type "webinar" or use a generic query
  const { data: events, isLoading } = useQuery({
    queryKey: ["events", filter],
    queryFn: async () => {
      let q = supabase
        .from("crm_meetings")
        .select("*")
        .in("meeting_type", ["mastermind_group", "other"])
        .order("scheduled_at", { ascending: false });

      // We'll also query activities tagged as events
      // For a clean approach, let's use the meetings table with a custom query
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // For a proper events system, let's query from a view that combines data
  const { data: webinars } = useQuery({
    queryKey: ["webinars"],
    queryFn: async () => {
      // Query tasks of type "meeting" that represent webinars/lives
      const { data } = await supabase
        .from("crm_tasks")
        .select("*")
        .in("type", ["meeting"])
        .ilike("title", "%וובינר%,%לייב%,%webinar%,%live%")
        .order("due_date", { ascending: false });
      return data || [];
    },
  });

  const createEvent = useMutation({
    mutationFn: async (eventData: typeof form) => {
      // Create as a task for now (can be migrated to dedicated table later)
      const { error } = await supabase.from("crm_tasks").insert({
        title: eventData.title,
        type: "meeting",
        priority: "high",
        status: "pending",
        due_date: eventData.scheduled_at ? new Date(eventData.scheduled_at).toISOString() : null,
        description: `${eventData.event_type === "webinar" ? "וובינר" : "לייב"} | ${eventData.duration_minutes} דקות | ${eventData.meeting_url || ""}${eventData.description ? "\n" + eventData.description : ""}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["webinars"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("אירוע נוצר");
      setShowForm(false);
      setForm({ event_type: "webinar", title: "", scheduled_at: "", duration_minutes: 60, meeting_url: "", description: "" });
    },
  });

  const allEvents = [...(webinars || [])];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">אירועים</h1>
          <p className="text-muted-foreground text-sm">וובינרים שבועיים ולייבים קהילתיים</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90">
          <Plus size={16} /> אירוע חדש
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50"><Video size={20} className="text-blue-600" /></div>
          <div>
            <p className="text-2xl font-bold">{allEvents.length}</p>
            <p className="text-xs text-muted-foreground">סה״כ אירועים</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50"><Users size={20} className="text-green-600" /></div>
          <div>
            <p className="text-2xl font-bold">{allEvents.filter(e => e.status === "completed").length}</p>
            <p className="text-xs text-muted-foreground">הושלמו</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50"><Calendar size={20} className="text-amber-600" /></div>
          <div>
            <p className="text-2xl font-bold">{allEvents.filter(e => e.status === "pending").length}</p>
            <p className="text-xs text-muted-foreground">מתוכננים</p>
          </div>
        </div>
      </div>

      {/* Events list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : allEvents.length > 0 ? (
        <div className="space-y-3">
          {allEvents.map((event: any) => {
            const isWebinar = event.title?.includes("וובינר") || event.title?.includes("webinar");
            const isLive = event.title?.includes("לייב") || event.title?.includes("live");
            return (
              <div key={event.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-4">
                  <div className={cn("p-2.5 rounded-xl shrink-0", isWebinar ? "bg-blue-50" : isLive ? "bg-purple-50" : "bg-green-50")}>
                    {isWebinar ? <Video size={20} className="text-blue-600" /> : <Radio size={20} className="text-purple-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{event.title}</h3>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full",
                        event.status === "completed" ? "bg-green-100 text-green-700" :
                        event.status === "pending" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {event.status === "completed" ? "הושלם" : event.status === "pending" ? "מתוכנן" : event.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {event.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(event.due_date).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                    )}
                  </div>
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
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
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
              <button onClick={() => createEvent.mutate(form)} disabled={!form.title || !form.scheduled_at}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
                צור אירוע
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

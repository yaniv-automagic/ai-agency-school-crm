import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Calendar, ExternalLink, Users, BadgeCheck, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSortable } from "@/hooks/useSortable";
import { SortableHeader } from "@/components/ui/sortable-header";

interface EventRow {
  id: string;
  event_type: "webinar" | "live_community" | "workshop";
  title: string;
  description: string | null;
  scheduled_at: string;
  end_at: string | null;
  duration_minutes: number;
  meeting_url: string | null;
  recording_url: string | null;
  registration_url: string | null;
  status: "upcoming" | "live" | "completed" | "cancelled";
  registered_count: number;
  attended_count: number;
  leads_generated: number;
  deals_count: number;
  revenue: number;
  cohort: string | null;
  notes: string | null;
}

interface RegistrationRow {
  id: string;
  registered: boolean;
  attended: boolean;
  registered_at: string | null;
  attended_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    status: string;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  upcoming: "קרוב", live: "שידור חי", completed: "הסתיים", cancelled: "בוטל",
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_events").select("*").eq("id", id).single();
      if (error) throw error;
      return data as EventRow;
    },
    enabled: !!id,
  });

  const { data: registrations } = useQuery({
    queryKey: ["event_registrations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_event_registrations")
        .select("id,registered,attended,registered_at,attended_at,utm_source,utm_medium,utm_campaign," +
                "contact:crm_contacts(id,first_name,last_name,email,phone,status)")
        .eq("event_id", id)
        .order("attended", { ascending: false })
        .order("registered_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RegistrationRow[];
    },
    enabled: !!id,
  });

  if (eventLoading) {
    return <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>;
  }
  if (!event) {
    return <div className="p-8 text-center text-muted-foreground">האירוע לא נמצא</div>;
  }

  const date = new Date(event.scheduled_at);
  const attended = (registrations || []).filter(r => r.attended);
  const registeredOnly = (registrations || []).filter(r => r.registered && !r.attended);

  return (
    <div className="space-y-4">
      <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight size={14} /> חזרה לאירועים
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold">{event.title}</h1>
              <span className={cn("text-[11px] px-2 py-0.5 rounded-full",
                event.status === "completed" ? "bg-green-100 text-green-700" :
                event.status === "upcoming" ? "bg-blue-100 text-blue-700" :
                event.status === "live" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-600")}>
                {STATUS_LABEL[event.status]}
              </span>
              {event.cohort && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {event.cohort}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {date.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span>· {event.duration_minutes} דקות</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {event.meeting_url && (
              <a href={event.meeting_url} target="_blank" rel="noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink size={12} /> קישור לאירוע
              </a>
            )}
            {event.recording_url && (
              <a href={event.recording_url} target="_blank" rel="noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink size={12} /> הקלטה
              </a>
            )}
          </div>
        </div>
        {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Users size={14} /> נרשמים
          </div>
          <p className="text-2xl font-bold">{event.registered_count.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <BadgeCheck size={14} /> נכחו
          </div>
          <p className="text-2xl font-bold">{event.attended_count.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            עסקאות
          </div>
          <p className="text-2xl font-bold">{event.deals_count}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <DollarSign size={14} /> הכנסה
          </div>
          <p className="text-2xl font-bold">₪{event.revenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Attendees */}
      {attended.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-3">נכחו ({attended.length})</h2>
          <RegistrantTable registrations={attended} />
        </div>
      )}

      {/* Registered (didn't attend) */}
      {registeredOnly.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-3">נרשמו ולא נכחו ({registeredOnly.length})</h2>
          <RegistrantTable registrations={registeredOnly} />
        </div>
      )}

      {(!registrations || registrations.length === 0) && (
        <div className="text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <Users size={32} className="mx-auto mb-2 opacity-30" />
          <p>אין נרשמים</p>
        </div>
      )}
    </div>
  );
}

function RegistrantTable({ registrations }: { registrations: RegistrationRow[] }) {
  const { sorted, isSorted, toggleSort } = useSortable<RegistrationRow>(registrations);
  const get = (k: string) => {
    switch (k) {
      case "name":   return (r: RegistrationRow) => `${r.contact?.first_name || ""} ${r.contact?.last_name || ""}`.trim();
      case "email":  return (r: RegistrationRow) => r.contact?.email || "";
      case "phone":  return (r: RegistrationRow) => r.contact?.phone || "";
      case "status": return (r: RegistrationRow) => r.contact?.status || "";
      case "utm":    return (r: RegistrationRow) => `${r.utm_source || ""}/${r.utm_medium || ""}`;
      case "registered_at": return (r: RegistrationRow) => r.registered_at || "";
    }
    return undefined;
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-right py-2 font-medium"><SortableHeader sortKey="name" align="right" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>שם</SortableHeader></th>
            <th className="text-right py-2 font-medium"><SortableHeader sortKey="email" align="right" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>מייל</SortableHeader></th>
            <th className="text-right py-2 font-medium"><SortableHeader sortKey="phone" align="right" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>טלפון</SortableHeader></th>
            <th className="text-right py-2 font-medium"><SortableHeader sortKey="status" align="right" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>סטטוס</SortableHeader></th>
            <th className="text-right py-2 font-medium"><SortableHeader sortKey="utm" align="right" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>UTM</SortableHeader></th>
            <th className="text-right py-2 font-medium"><SortableHeader sortKey="registered_at" align="right" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>תאריך הרשמה</SortableHeader></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30">
              <td className="py-2">
                {r.contact ? (
                  <Link to={`/contacts/${r.contact.id}`} className="text-primary hover:underline">
                    {r.contact.first_name} {r.contact.last_name}
                  </Link>
                ) : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-2 text-muted-foreground" dir="ltr">{r.contact?.email || "—"}</td>
              <td className="py-2 text-muted-foreground" dir="ltr">{r.contact?.phone || "—"}</td>
              <td className="py-2 text-muted-foreground text-xs">{r.contact?.status || "—"}</td>
              <td className="py-2 text-muted-foreground text-xs" dir="ltr">
                {[r.utm_source, r.utm_medium].filter(Boolean).join(" / ") || "—"}
              </td>
              <td className="py-2 text-muted-foreground text-xs">
                {r.registered_at ? new Date(r.registered_at).toLocaleDateString("he-IL") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

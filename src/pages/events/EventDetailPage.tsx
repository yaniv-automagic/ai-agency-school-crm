import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Calendar, ExternalLink, Users, BadgeCheck, DollarSign, Clock, Activity, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSortable } from "@/hooks/useSortable";
import { SortableHeader } from "@/components/ui/sortable-header";
import { AttendanceTimelineChart } from "@/components/events/AttendanceTimelineChart";
import { ZoomRecordingWidget } from "@/components/events/ZoomRecordingWidget";

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
  recording_files: any[] | null;
  recording_password: string | null;
  host_email: string | null;
  external_source: string | null;
  external_metadata: Record<string, any> | null;
  last_synced_at: string | null;
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

interface SessionRow {
  id: string;
  registration_id: string | null;
  participant_email: string | null;
  participant_name: string | null;
  joined_at: string;
  left_at: string;
  duration_seconds: number;
}

const STATUS_LABEL: Record<string, string> = {
  upcoming: "קרוב", live: "שידור חי", completed: "הסתיים", cancelled: "בוטל",
};

const TYPE_LABEL: Record<string, string> = {
  webinar: "וובינר", live_community: "לייב קהילתי", workshop: "סדנה",
};

function formatSeconds(s: number): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${(m % 60).toString().padStart(2, "0")}h`;
  }
  return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
}

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

  const { data: sessions } = useQuery({
    queryKey: ["event_attendance_sessions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_event_attendance_sessions")
        .select("id,registration_id,participant_email,participant_name,joined_at,left_at,duration_seconds")
        .eq("event_id", id)
        .order("joined_at");
      if (error) throw error;
      return (data || []) as SessionRow[];
    },
    enabled: !!id,
  });

  // Aggregate sessions per registration: total duration + first join
  const sessionsByReg = useMemo(() => {
    const m = new Map<string, { totalDur: number; firstJoin: string }>();
    for (const s of sessions || []) {
      if (!s.registration_id) continue;
      const cur = m.get(s.registration_id);
      if (cur) {
        cur.totalDur += s.duration_seconds;
        if (s.joined_at < cur.firstJoin) cur.firstJoin = s.joined_at;
      } else {
        m.set(s.registration_id, { totalDur: s.duration_seconds, firstJoin: s.joined_at });
      }
    }
    return m;
  }, [sessions]);

  // Unmatched sessions: group by email since one person may have multiple sessions
  const unmatched = useMemo(() => {
    const m = new Map<string, { name: string | null; email: string; totalDur: number; firstJoin: string; count: number }>();
    for (const s of sessions || []) {
      if (s.registration_id) continue;
      const key = (s.participant_email || s.participant_name || s.id).toLowerCase();
      const cur = m.get(key);
      if (cur) {
        cur.totalDur += s.duration_seconds;
        cur.count++;
        if (s.joined_at < cur.firstJoin) cur.firstJoin = s.joined_at;
      } else {
        m.set(key, {
          name: s.participant_name,
          email: s.participant_email || "",
          totalDur: s.duration_seconds,
          firstJoin: s.joined_at,
          count: 1,
        });
      }
    }
    return Array.from(m.values()).sort((a, b) => b.totalDur - a.totalDur);
  }, [sessions]);

  // Stats
  const stats = useMemo(() => {
    const allSessions = sessions || [];
    const eventStartMs = event ? +new Date(event.scheduled_at) : 0;
    const eventEndMs = event ? (event.end_at ? +new Date(event.end_at) : eventStartMs + event.duration_minutes * 60_000) : 0;

    // Peak concurrent via sweep line
    let peak = 0;
    if (allSessions.length) {
      const evts: { t: number; d: number }[] = [];
      for (const s of allSessions) {
        evts.push({ t: +new Date(s.joined_at), d: 1 });
        evts.push({ t: +new Date(s.left_at), d: -1 });
      }
      evts.sort((a, b) => a.t - b.t || a.d - b.d);
      let c = 0;
      for (const e of evts) { c += e.d; if (c > peak) peak = c; }
    }

    const matchedCount = sessionsByReg.size;
    const unmatchedCount = unmatched.length;
    const totalAttended = matchedCount + unmatchedCount;
    const eventDurationMin = event ? Math.max(1, Math.round((eventEndMs - eventStartMs) / 60000)) : 1;

    // Average duration per attendee (in minutes)
    let totalDurAll = 0;
    let attendeeCountForAvg = 0;
    for (const v of sessionsByReg.values()) { totalDurAll += v.totalDur; attendeeCountForAvg++; }
    for (const u of unmatched) { totalDurAll += u.totalDur; attendeeCountForAvg++; }
    const avgDurMin = attendeeCountForAvg > 0 ? Math.round(totalDurAll / attendeeCountForAvg / 60) : 0;
    const avgRetention = eventDurationMin > 0 && attendeeCountForAvg > 0
      ? Math.round((totalDurAll / attendeeCountForAvg / 60) / eventDurationMin * 100)
      : 0;

    return { peak, totalAttended, matchedCount, unmatchedCount, avgDurMin, avgRetention };
  }, [event, sessions, sessionsByReg, unmatched]);

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
  const hasRecording = !!(event.recording_files && event.recording_files.length);
  const isZoomEvent = event.external_source === "zoom";

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
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {TYPE_LABEL[event.event_type]}
              </span>
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
              {isZoomEvent && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">Zoom</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {date.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span>· {event.duration_minutes} דקות</span>
              {event.host_email && <span dir="ltr">· {event.host_email}</span>}
              {event.last_synced_at && (
                <span className="text-[11px]">· סונכרן {new Date(event.last_synced_at).toLocaleString("he-IL")}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {event.meeting_url && (
              <a href={event.meeting_url} target="_blank" rel="noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink size={12} /> קישור לאירוע
              </a>
            )}
          </div>
        </div>
        {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Users size={14} />} label="נרשמים" value={(event.registered_count || registrations?.length || 0).toLocaleString()} />
        <StatCard icon={<BadgeCheck size={14} />} label="נכחו" value={stats.totalAttended.toLocaleString()} hint={stats.unmatchedCount > 0 ? `+${stats.unmatchedCount} לא משויכים` : undefined} />
        <StatCard icon={<Activity size={14} />} label="שיא בו-זמני" value={stats.peak.toLocaleString()} />
        <StatCard icon={<Clock size={14} />} label="שהייה ממוצעת" value={stats.avgDurMin > 0 ? `${stats.avgDurMin}m` : "—"} hint={stats.avgRetention > 0 ? `${stats.avgRetention}% מהזמן` : undefined} />
        <StatCard icon={<DollarSign size={14} />} label="עסקאות" value={`${event.deals_count}`} />
        <StatCard icon={<DollarSign size={14} />} label="הכנסה" value={`₪${event.revenue.toLocaleString()}`} />
      </div>

      {/* Recording widget */}
      {(isZoomEvent || hasRecording || event.recording_url) && (
        <ZoomRecordingWidget
          eventId={event.id}
          hasRecording={hasRecording}
          recordingShareUrl={event.recording_url}
          recordingPassword={event.recording_password}
        />
      )}

      {/* Attendance timeline */}
      <AttendanceTimelineChart
        sessions={sessions || []}
        eventStart={event.scheduled_at}
        eventEnd={event.end_at}
        durationMinutes={event.duration_minutes}
      />

      {/* Attended (matched contacts) */}
      {attended.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <BadgeCheck size={16} className="text-emerald-500" />
            נכחו ({attended.length})
          </h2>
          <RegistrantTable registrations={attended} sessionsByReg={sessionsByReg} showDuration />
        </div>
      )}

      {/* Unmatched attendees */}
      {unmatched.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <UserX size={16} className="text-amber-500" />
            נוכחים לא משויכים ({unmatched.length})
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            מיילים שהשתתפו אבל לא קיימים במערכת. אם רלוונטי — צור ליד ידנית.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-center py-2 font-medium">שם</th>
                  <th className="text-center py-2 font-medium">מייל</th>
                  <th className="text-center py-2 font-medium">כניסה</th>
                  <th className="text-center py-2 font-medium">משך נוכחות</th>
                  <th className="text-center py-2 font-medium">חיבורים</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.map((u) => (
                  <tr key={u.email + u.firstJoin} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-2">{u.name || "—"}</td>
                    <td className="py-2 text-muted-foreground" dir="ltr">{u.email || "—"}</td>
                    <td className="py-2 text-muted-foreground text-xs">
                      {new Date(u.firstJoin).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2 text-xs font-medium">{formatSeconds(u.totalDur)}</td>
                    <td className="py-2 text-muted-foreground text-xs">{u.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Registered (didn't attend) */}
      {registeredOnly.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-3">נרשמו ולא נכחו ({registeredOnly.length})</h2>
          <RegistrantTable registrations={registeredOnly} sessionsByReg={sessionsByReg} />
        </div>
      )}

      {(!registrations || registrations.length === 0) && (!sessions || sessions.length === 0) && (
        <div className="text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <Users size={32} className="mx-auto mb-2 opacity-30" />
          <p>אין נרשמים או נוכחים</p>
          {isZoomEvent && (
            <p className="text-xs mt-2">הרץ סנכרון מ-Zoom כדי לטעון נתונים</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <p className="text-xl font-bold">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function RegistrantTable({
  registrations,
  sessionsByReg,
  showDuration,
}: {
  registrations: RegistrationRow[];
  sessionsByReg: Map<string, { totalDur: number; firstJoin: string }>;
  showDuration?: boolean;
}) {
  const { sorted, isSorted, toggleSort } = useSortable<RegistrationRow>(registrations);
  const get = (k: string) => {
    switch (k) {
      case "name":   return (r: RegistrationRow) => `${r.contact?.first_name || ""} ${r.contact?.last_name || ""}`.trim();
      case "email":  return (r: RegistrationRow) => r.contact?.email || "";
      case "phone":  return (r: RegistrationRow) => r.contact?.phone || "";
      case "status": return (r: RegistrationRow) => r.contact?.status || "";
      case "utm":    return (r: RegistrationRow) => `${r.utm_source || ""}/${r.utm_medium || ""}`;
      case "registered_at": return (r: RegistrationRow) => r.registered_at || "";
      case "duration":      return (r: RegistrationRow) => sessionsByReg.get(r.id)?.totalDur ?? 0;
      case "joined_at":     return (r: RegistrationRow) => sessionsByReg.get(r.id)?.firstJoin ?? "";
    }
    return undefined;
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-center py-2 font-medium"><SortableHeader sortKey="name" align="center" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>שם</SortableHeader></th>
            <th className="text-center py-2 font-medium"><SortableHeader sortKey="email" align="center" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>מייל</SortableHeader></th>
            <th className="text-center py-2 font-medium"><SortableHeader sortKey="phone" align="center" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>טלפון</SortableHeader></th>
            <th className="text-center py-2 font-medium"><SortableHeader sortKey="status" align="center" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>סטטוס</SortableHeader></th>
            {showDuration && (
              <>
                <th className="text-center py-2 font-medium"><SortableHeader sortKey="joined_at" align="center" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>כניסה</SortableHeader></th>
                <th className="text-center py-2 font-medium"><SortableHeader sortKey="duration" align="center" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>משך נוכחות</SortableHeader></th>
              </>
            )}
            <th className="text-center py-2 font-medium"><SortableHeader sortKey="utm" align="center" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>UTM</SortableHeader></th>
            <th className="text-center py-2 font-medium"><SortableHeader sortKey="registered_at" align="center" isSorted={isSorted} onSort={k => toggleSort(k, get(k))}>הרשמה</SortableHeader></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => {
            const sess = sessionsByReg.get(r.id);
            return (
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
                {showDuration && (
                  <>
                    <td className="py-2 text-muted-foreground text-xs">
                      {sess ? new Date(sess.firstJoin).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="py-2 text-xs font-medium">
                      {sess ? formatSeconds(sess.totalDur) : "—"}
                    </td>
                  </>
                )}
                <td className="py-2 text-muted-foreground text-xs" dir="ltr">
                  {[r.utm_source, r.utm_medium].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="py-2 text-muted-foreground text-xs">
                  {r.registered_at ? new Date(r.registered_at).toLocaleDateString("he-IL") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

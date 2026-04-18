import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";
import { MEETING_TYPES, MEETING_OUTCOMES } from "@/lib/constants";

const TABS = [
  { value: "funnel", label: "משפך" },
  { value: "attribution", label: "שיוך" },
  { value: "meetings", label: "פגישות" },
  { value: "programs", label: "תכניות" },
] as const;

type Tab = (typeof TABS)[number]["value"];

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("funnel");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">אנליטיקס</h1>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "funnel" && <FunnelTab />}
      {activeTab === "attribution" && <AttributionTab />}
      {activeTab === "meetings" && <MeetingsTab />}
      {activeTab === "programs" && <ProgramsTab />}
    </div>
  );
}

// ── Funnel Tab ──

function FunnelTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "funnel"],
    queryFn: async () => {
      const [contactsRes, meetingsRes, dealsRes] = await Promise.all([
        supabase.from("crm_contacts").select("id", { count: "exact", head: true }),
        supabase.from("crm_meetings").select("id, status", { count: "exact" }),
        supabase.from("crm_deals").select("id, status", { count: "exact" }),
      ]);

      const totalContacts = contactsRes.count || 0;
      const meetings = meetingsRes.data || [];
      const deals = dealsRes.data || [];

      const scheduledMeetings = meetings.filter(
        (m) => ["scheduled", "confirmed", "completed", "no_show"].includes(m.status)
      ).length;
      const completedMeetings = meetings.filter((m) => m.status === "completed").length;
      const wonDeals = deals.filter((d) => d.status === "won").length;

      return {
        steps: [
          { label: "כניסות", value: totalContacts },
          { label: "לידים", value: totalContacts },
          { label: "פגישות נקבעו", value: scheduledMeetings },
          { label: "פגישות התקיימו", value: completedMeetings },
          { label: "נסגר", value: wonDeals },
        ],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const steps = data?.steps || [];

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="font-semibold mb-6">משפך המרה</h3>
      <div className="space-y-4">
        {steps.map((step, i) => {
          const maxVal = steps[0]?.value || 1;
          const pct = maxVal > 0 ? (step.value / maxVal) * 100 : 0;
          const conversionFromPrev =
            i > 0 && steps[i - 1].value > 0
              ? Math.round((step.value / steps[i - 1].value) * 100)
              : null;

          return (
            <div key={step.label}>
              {conversionFromPrev !== null && (
                <div className="flex items-center gap-2 mb-1 mr-2">
                  <span className="text-xs text-muted-foreground">
                    {conversionFromPrev}% המרה
                  </span>
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-right shrink-0">
                  {step.label}
                </div>
                <div className="flex-1 bg-muted rounded-full h-10 overflow-hidden">
                  <div
                    className="bg-primary/80 h-full rounded-full flex items-center justify-end px-3 transition-all duration-500"
                    style={{ width: `${Math.max(pct, 5)}%` }}
                  >
                    <span className="text-sm font-bold text-primary-foreground">
                      {step.value}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Attribution Tab ──

function AttributionTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "attribution"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("crm_contacts")
        .select("id, utm_source, utm_campaign");
      const { data: deals } = await supabase
        .from("crm_deals")
        .select("id, contact_id, status, value");

      if (!contacts) return [];

      const wonDeals = (deals || []).filter((d) => d.status === "won");
      const wonByContact = new Map<string, { count: number; revenue: number }>();
      wonDeals.forEach((d) => {
        const existing = wonByContact.get(d.contact_id) || { count: 0, revenue: 0 };
        wonByContact.set(d.contact_id, {
          count: existing.count + 1,
          revenue: existing.revenue + (d.value || 0),
        });
      });

      // Group by utm_source
      const sourceMap = new Map<
        string,
        {
          source: string;
          contacts: number;
          deals: number;
          revenue: number;
          campaigns: Map<string, { contacts: number; deals: number; revenue: number }>;
        }
      >();

      contacts.forEach((c) => {
        const source = c.utm_source || "ישיר";
        const campaign = c.utm_campaign || "";

        if (!sourceMap.has(source)) {
          sourceMap.set(source, {
            source,
            contacts: 0,
            deals: 0,
            revenue: 0,
            campaigns: new Map(),
          });
        }

        const entry = sourceMap.get(source)!;
        entry.contacts++;

        const contactDeals = wonByContact.get(c.id);
        if (contactDeals) {
          entry.deals += contactDeals.count;
          entry.revenue += contactDeals.revenue;
        }

        if (campaign) {
          if (!entry.campaigns.has(campaign)) {
            entry.campaigns.set(campaign, { contacts: 0, deals: 0, revenue: 0 });
          }
          const campEntry = entry.campaigns.get(campaign)!;
          campEntry.contacts++;
          if (contactDeals) {
            campEntry.deals += contactDeals.count;
            campEntry.revenue += contactDeals.revenue;
          }
        }
      });

      return Array.from(sourceMap.values())
        .map((s) => ({
          ...s,
          campaigns: Array.from(s.campaigns.entries()).map(([name, data]) => ({
            name,
            ...data,
          })),
        }))
        .sort((a, b) => b.contacts - a.contacts);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-right px-4 py-3 font-medium text-muted-foreground">מקור</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground">אנשי קשר</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground">עסקאות שנסגרו</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground">הכנסה</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row) => (
              <>
                <tr
                  key={row.source}
                  className="border-b border-border hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{row.source}</td>
                  <td className="px-4 py-3">{row.contacts}</td>
                  <td className="px-4 py-3">{row.deals}</td>
                  <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                </tr>
                {row.campaigns.map((camp) => (
                  <tr
                    key={`${row.source}-${camp.name}`}
                    className="border-b border-border bg-muted/10"
                  >
                    <td className="px-4 py-2 pr-8 text-muted-foreground text-xs">
                      {camp.name}
                    </td>
                    <td className="px-4 py-2 text-xs">{camp.contacts}</td>
                    <td className="px-4 py-2 text-xs">{camp.deals}</td>
                    <td className="px-4 py-2 text-xs">{formatCurrency(camp.revenue)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">—</td>
                  </tr>
                ))}
              </>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                <p className="text-lg font-medium mb-1">אין נתוני שיוך</p>
                <p className="text-sm">נתוני UTM יופיעו כאן כשיהיו אנשי קשר עם פרמטרים</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Meetings Tab ──

function MeetingsTab() {
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["analytics", "meetings-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_meetings")
        .select("status, outcome, meeting_type");
      if (!data) return { scheduled: 0, showRate: 0, closeRate: 0, byType: [], byOutcome: [] };

      const total = data.length;
      const completed = data.filter((m) => m.status === "completed").length;
      const noShow = data.filter((m) => m.status === "no_show").length;
      const showRate = completed + noShow > 0 ? Math.round((completed / (completed + noShow)) * 100) : 0;

      const sales = data.filter(
        (m) => m.meeting_type === "sales_consultation" && m.status === "completed"
      );
      const won = sales.filter((m) => m.outcome === "won").length;
      const closeRate = sales.length > 0 ? Math.round((won / sales.length) * 100) : 0;

      // By type
      const typeCount = new Map<string, number>();
      data.forEach((m) => {
        typeCount.set(m.meeting_type, (typeCount.get(m.meeting_type) || 0) + 1);
      });
      const byType = Array.from(typeCount.entries()).map(([type, count]) => ({
        name: MEETING_TYPES.find((t) => t.value === type)?.label || type,
        value: count,
      }));

      // By outcome
      const outcomeCount = new Map<string, number>();
      data
        .filter((m) => m.outcome)
        .forEach((m) => {
          outcomeCount.set(m.outcome!, (outcomeCount.get(m.outcome!) || 0) + 1);
        });
      const byOutcome = Array.from(outcomeCount.entries()).map(([outcome, count]) => ({
        name: MEETING_OUTCOMES.find((o) => o.value === outcome)?.label || outcome,
        value: count,
      }));

      return {
        scheduled: data.filter((m) =>
          ["scheduled", "confirmed"].includes(m.status)
        ).length,
        showRate,
        closeRate,
        byType,
        byOutcome,
      };
    },
  });

  if (loadingStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">פגישות מתוכננות</p>
          <p className="text-2xl font-bold">{stats?.scheduled || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">אחוז הגעה</p>
          <p className="text-2xl font-bold">{stats?.showRate || 0}%</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">אחוז סגירה</p>
          <p className="text-2xl font-bold">{stats?.closeRate || 0}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - By Type */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">לפי סוג פגישה</h3>
          {stats?.byType && stats.byType.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stats.byType}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {stats.byType.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-16 text-sm">אין נתונים</p>
          )}
        </div>

        {/* Bar Chart - Outcomes */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">תוצאות פגישות</h3>
          {stats?.byOutcome && stats.byOutcome.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.byOutcome}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="כמות" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-16 text-sm">אין נתונים</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Programs Tab ──

function ProgramsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "programs"],
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from("crm_program_enrollments")
        .select("id, status, total_sessions, completed_sessions");
      const { data: sessions } = await supabase
        .from("crm_program_sessions")
        .select("id, status");

      if (!enrollments)
        return { active: 0, sessionsCompleted: 0, completionRate: 0 };

      const active = enrollments.filter((e) => e.status === "active").length;
      const totalSessions = enrollments.reduce((s, e) => s + (e.total_sessions || 0), 0);
      const completedSessions = enrollments.reduce((s, e) => s + (e.completed_sessions || 0), 0);
      const completionRate =
        totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

      const sessionCompleted = (sessions || []).filter((s) => s.status === "completed").length;

      return {
        active,
        sessionsCompleted: sessionCompleted,
        completionRate,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">הרשמות פעילות</p>
          <p className="text-2xl font-bold">{data?.active || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">מפגשים שהושלמו</p>
          <p className="text-2xl font-bold">{data?.sessionsCompleted || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">אחוז השלמה</p>
          <p className="text-2xl font-bold">{data?.completionRate || 0}%</p>
        </div>
      </div>

      {!data?.active && (
        <div className="bg-card border border-border rounded-xl p-16 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-1">אין הרשמות לתכניות</p>
          <p className="text-sm">נתוני תכניות יופיעו כאן כשיהיו הרשמות פעילות</p>
        </div>
      )}
    </div>
  );
}

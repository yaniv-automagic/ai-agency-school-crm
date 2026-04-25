import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Send, Users, Mail, Eye, MousePointer, AlertTriangle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn, timeAgo } from "@/lib/utils";
import type { Campaign, CampaignStats } from "@/types/crm";
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_campaigns").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Campaign;
    },
    enabled: !!id,
  });

  const { data: recipients } = useQuery({
    queryKey: ["campaign-recipients", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_campaign_recipients")
        .select("*, contact:crm_contacts(first_name, last_name, email)")
        .eq("campaign_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!campaign) {
    return <div className="text-center py-16 text-muted-foreground">קמפיין לא נמצא</div>;
  }

  const stats = campaign.stats || {};
  const sent = stats.sent_count || 0;
  const delivered = stats.delivered || sent;
  const opened = stats.opened || 0;
  const clicked = stats.clicked || 0;
  const bounced = stats.bounced || 0;

  const funnelData = [
    { name: "נשלח", value: sent, color: "#6366f1" },
    { name: "הגיע", value: delivered, color: "#3b82f6" },
    { name: "נפתח", value: opened, color: "#22c55e" },
    { name: "לחץ", value: clicked, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0";
  const clickRate = opened > 0 ? ((clicked / opened) * 100).toFixed(1) : "0";
  const bounceRate = sent > 0 ? ((bounced / sent) * 100).toFixed(1) : "0";

  const statusData = [
    { name: "נשלח", value: recipients?.filter(r => r.status === "sent").length || 0 },
    { name: "הגיע", value: recipients?.filter(r => r.status === "delivered").length || 0 },
    { name: "נפתח", value: recipients?.filter(r => r.status === "opened").length || 0 },
    { name: "לחץ", value: recipients?.filter(r => r.status === "clicked").length || 0 },
    { name: "חזר", value: recipients?.filter(r => r.status === "bounced").length || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/campaigns")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight size={16} /> חזרה לקמפיינים
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span>{campaign.type === "email" ? "מייל" : campaign.type === "whatsapp" ? "WhatsApp" : "SMS"}</span>
            {campaign.sent_at && <span>נשלח {timeAgo(campaign.sent_at)}</span>}
          </div>
        </div>
        {campaign.status === "draft" && (
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90">
            <Send size={14} /> שלח עכשיו
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "נשלחו", value: sent, icon: Send, color: "text-blue-600 bg-blue-50" },
          { label: "נפתחו", value: `${openRate}%`, icon: Eye, color: "text-green-600 bg-green-50", sub: `${opened} מתוך ${sent}` },
          { label: "לחצו", value: `${clickRate}%`, icon: MousePointer, color: "text-amber-600 bg-amber-50", sub: `${clicked} מתוך ${opened}` },
          { label: "חזרו", value: `${bounceRate}%`, icon: AlertTriangle, color: "text-red-600 bg-red-50", sub: `${bounced} מתוך ${sent}` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1.5 rounded-lg", kpi.color)}><kpi.icon size={16} /></div>
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
            {kpi.sub && <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">משפך ביצועים</h3>
          {funnelData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ direction: "rtl", fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {funnelData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">אין נתונים עדיין</p>
          )}
        </div>

        {/* Status breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">פילוח סטטוס</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ direction: "rtl", fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">אין נתונים</p>
          )}
        </div>
      </div>

      {/* Recipients table */}
      {recipients && recipients.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">נמענים ({recipients.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">שם</th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">מייל</th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">סטטוס</th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">נפתח</th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">לחץ</th>
              </tr>
            </thead>
            <tbody>
              {recipients.slice(0, 20).map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">{r.contact?.first_name} {r.contact?.last_name}</td>
                  <td className="px-4 py-2 text-muted-foreground" dir="ltr">{r.contact?.email}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{r.status}</span></td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{r.opened_at ? timeAgo(r.opened_at) : "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{r.clicked_at ? timeAgo(r.clicked_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

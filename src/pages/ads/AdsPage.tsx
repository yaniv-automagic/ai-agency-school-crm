import { useQuery } from "@tanstack/react-query";
import { Megaphone, Link2, TrendingUp, MousePointerClick, DollarSign, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency, cn } from "@/lib/utils";
import type { AdCampaign, AdDailyStat } from "@/types/crm";

export default function AdsPage() {
  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["ad-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_ad_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AdCampaign[];
    },
  });

  const { data: dailyStats, isLoading: loadingStats } = useQuery({
    queryKey: ["ad-daily-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_ad_daily_stats")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as AdDailyStat[];
    },
  });

  const isLoading = loadingCampaigns || loadingStats;
  const hasAccount = campaigns && campaigns.length > 0;

  // Aggregate KPIs from daily stats
  const totals = (dailyStats || []).reduce(
    (acc, s) => ({
      spend: acc.spend + (s.spend || 0),
      clicks: acc.clicks + (s.clicks || 0),
      leads: acc.leads + (s.leads || 0),
      impressions: acc.impressions + (s.impressions || 0),
    }),
    { spend: 0, clicks: 0, leads: 0, impressions: 0 }
  );
  const avgCpl = totals.leads > 0 ? totals.spend / totals.leads : 0;

  // Aggregate stats per campaign
  const campaignStats = new Map<string, { spend: number; impressions: number; clicks: number; leads: number }>();
  (dailyStats || []).forEach((s) => {
    if (!s.campaign_id) return;
    const existing = campaignStats.get(s.campaign_id) || { spend: 0, impressions: 0, clicks: 0, leads: 0 };
    campaignStats.set(s.campaign_id, {
      spend: existing.spend + (s.spend || 0),
      impressions: existing.impressions + (s.impressions || 0),
      clicks: existing.clicks + (s.clicks || 0),
      leads: existing.leads + (s.leads || 0),
    });
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Empty state: no ad account
  if (!hasAccount) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">קמפיינים ממומנים</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 bg-card border border-border rounded-xl">
          <Megaphone size={56} className="text-muted-foreground/30 mb-4" />
          <p className="text-xl font-semibold mb-2">אין חשבון פרסום מחובר</p>
          <p className="text-muted-foreground mb-6">חבר את חשבון הפייסבוק שלך כדי לראות נתוני קמפיינים</p>
          <button className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors">
            <Link2 size={16} />
            חבר חשבון
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">קמפיינים ממומנים</h1>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-secondary transition-colors">
          <Link2 size={16} />
          חבר חשבון
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <DollarSign size={16} />
            <span className="text-xs font-medium">סה"כ הוצאות</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totals.spend)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <MousePointerClick size={16} />
            <span className="text-xs font-medium">סה"כ קליקים</span>
          </div>
          <p className="text-2xl font-bold">{totals.clicks.toLocaleString("he-IL")}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">עלות לליד ממוצעת</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(avgCpl)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users size={16} />
            <span className="text-xs font-medium">סה"כ לידים</span>
          </div>
          <p className="text-2xl font-bold">{totals.leads.toLocaleString("he-IL")}</p>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">שם קמפיין</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">סטטוס</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">הוצאות</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">חשיפות</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">קליקים</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">CPL</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">CPA</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">לידים</th>
            </tr>
          </thead>
          <tbody>
            {campaigns && campaigns.length > 0 ? (
              campaigns.map((campaign) => {
                const stats = campaignStats.get(campaign.id) || {
                  spend: 0,
                  impressions: 0,
                  clicks: 0,
                  leads: 0,
                };
                const cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;
                const cpa = stats.leads > 0 ? stats.spend / stats.leads : 0;
                const statusColor =
                  campaign.status === "ACTIVE"
                    ? "bg-green-100 text-green-700"
                    : campaign.status === "PAUSED"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-600";

                return (
                  <tr
                    key={campaign.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{campaign.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          statusColor
                        )}
                      >
                        {campaign.status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatCurrency(stats.spend)}</td>
                    <td className="px-4 py-3">{stats.impressions.toLocaleString("he-IL")}</td>
                    <td className="px-4 py-3">{stats.clicks.toLocaleString("he-IL")}</td>
                    <td className="px-4 py-3">{cpl > 0 ? formatCurrency(cpl) : "—"}</td>
                    <td className="px-4 py-3">{cpa > 0 ? formatCurrency(cpa) : "—"}</td>
                    <td className="px-4 py-3">{stats.leads}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                  <p className="text-lg font-medium mb-1">אין קמפיינים</p>
                  <p className="text-sm">סנכרן את חשבון הפרסום שלך כדי לראות נתונים</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

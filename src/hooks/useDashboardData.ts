import { supabase } from "@/lib/supabase";
import type { WidgetConfig } from "@/types/dashboard";
import { CHART_COLORS, MONTH_NAMES, FIELD_LABELS } from "@/types/dashboard";
import { formatCurrency } from "@/lib/utils";

function resolveLabel(field: string, value: string): string {
  return FIELD_LABELS[field]?.[value] || value || "אחר";
}

export async function fetchWidgetData(config: WidgetConfig): Promise<Partial<WidgetConfig>> {
  if (!config.dataSource) return {};

  try {
    // Date field depends on table
    const dateField = config.dataSource === "crm_ad_daily_stats" ? "date"
      : config.dataSource === "crm_meetings" ? "scheduled_at"
      : "created_at";

    let query = supabase.from(config.dataSource).select("*");

    // Apply date filter
    if (config.dateFilter) {
      const now = new Date();
      let from: string;
      if (config.dateFilter === "this_month") {
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (config.dateFilter === "this_year") {
        from = new Date(now.getFullYear(), 0, 1).toISOString();
      } else {
        from = new Date(now.getFullYear(), 0, 1).toISOString();
      }
      query = query.gte(dateField, config.dataSource === "crm_ad_daily_stats" ? from.slice(0, 10) : from);
    }

    // Apply filters
    if (config.filters) {
      for (const f of config.filters) {
        if (!f.field) continue;
        switch (f.operator) {
          case "eq": query = query.eq(f.field, f.value); break;
          case "ne": query = query.neq(f.field, f.value); break;
          case "gt": query = query.gt(f.field, f.value); break;
          case "lt": query = query.lt(f.field, f.value); break;
          case "contains": query = query.ilike(f.field, `%${f.value}%`); break;
          case "is-null": query = query.is(f.field, null); break;
          case "is-not-null": query = query.not(f.field, "is", null); break;
        }
      }
    }

    const { data: records, error } = await query;
    if (error) throw error;
    if (!records) return {};

    const sourceLabel = config.title || config.dataSource;

    // ── Number widget ──
    if (config.type === "number") {
      let value = records.length;
      let formattedValue = value.toLocaleString();
      let subtitle = "רשומות";

      // Deals: sum value
      if (config.dataSource === "crm_deals" && config.metric === "value") {
        const totalValue = records.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
        formattedValue = formatCurrency(totalValue);
        subtitle = `${value} עסקאות`;
      }

      // Ad spend: sum spend
      if (config.dataSource === "crm_ad_daily_stats") {
        if (config.metric === "spend") {
          const totalSpend = records.reduce((sum, r) => sum + (Number(r.spend) || 0), 0);
          formattedValue = formatCurrency(totalSpend);
          subtitle = `${value} ימים`;
          value = totalSpend;
        } else if (config.metric === "clicks") {
          const totalClicks = records.reduce((sum, r) => sum + (Number(r.clicks) || 0), 0);
          formattedValue = totalClicks.toLocaleString();
          subtitle = "קליקים";
          value = totalClicks;
        } else if (config.metric === "leads") {
          const totalLeads = records.reduce((sum, r) => sum + (Number(r.leads) || 0), 0);
          formattedValue = totalLeads.toLocaleString();
          subtitle = "לידים מפרסום";
          value = totalLeads;
        } else if (config.metric === "cpl") {
          const totalSpend = records.reduce((sum, r) => sum + (Number(r.spend) || 0), 0);
          const totalLeads = records.reduce((sum, r) => sum + (Number(r.leads) || 0), 0);
          const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
          formattedValue = formatCurrency(cpl);
          subtitle = "עלות לליד";
          value = cpl;
        }
      }

      // Meetings: show rate
      if (config.dataSource === "crm_meetings" && config.metric === "show_rate") {
        const completed = records.filter(r => r.status === "completed").length;
        const noShow = records.filter(r => r.status === "no_show").length;
        const total = completed + noShow;
        const rate = total > 0 ? (completed / total) * 100 : 0;
        formattedValue = `${Math.round(rate)}%`;
        subtitle = `${completed} מתוך ${total} הגיעו`;
        value = rate;
      }

      // Meetings: close rate
      if (config.dataSource === "crm_meetings" && config.metric === "close_rate") {
        const sales = records.filter(r => r.meeting_type === "sales_consultation" && r.status === "completed");
        const won = sales.filter(r => r.outcome === "won").length;
        const rate = sales.length > 0 ? (won / sales.length) * 100 : 0;
        formattedValue = `${Math.round(rate)}%`;
        subtitle = `${won} מתוך ${sales.length} נסגרו`;
        value = rate;
      }

      // Enrollments: completion rate
      if (config.dataSource === "crm_program_enrollments" && config.metric === "completion") {
        const totalSessions = records.reduce((sum, r) => sum + (Number(r.total_sessions) || 0), 0);
        const completedSessions = records.reduce((sum, r) => sum + (Number(r.completed_sessions) || 0), 0);
        const rate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
        formattedValue = `${Math.round(rate)}%`;
        subtitle = `${completedSessions} מתוך ${totalSessions} סשנים`;
        value = rate;
      }

      return {
        kpiData: { id: `kpi-${config.dataSource}`, label: sourceLabel, value, formattedValue, subtitle },
      };
    }

    // ── Funnel ──
    if (config.type === "funnel" && config.funnelField && config.funnelStages?.length) {
      const chartData = config.funnelStages.map(stage => ({
        label: stage.label,
        value: records.filter(r => String(r[config.funnelField!]) === stage.fieldValue).length,
        color: stage.color,
      }));
      return { chartData };
    }

    // ── GroupBy: month ──
    if (config.groupBy === "created_month" || config.groupBy === "date_month") {
      const counts = new Array(12).fill(0);
      for (const rec of records) {
        const d = new Date(rec[dateField]);
        if (!isNaN(d.getTime())) counts[d.getMonth()]++;
      }
      return { chartData: MONTH_NAMES.map((label, i) => ({ label, value: counts[i] })) };
    }

    // ── GroupBy: stage_name (deals) ──
    if (config.groupBy === "stage_name") {
      const { data: stages } = await supabase.from("crm_pipeline_stages").select("id, name, color, order_index").order("order_index");
      const grouped: Record<string, { count: number; color: string }> = {};
      for (const rec of records) {
        const stage = stages?.find(s => s.id === rec.stage_id);
        const name = stage?.name || "אחר";
        if (!grouped[name]) grouped[name] = { count: 0, color: stage?.color || "#6366f1" };
        grouped[name].count++;
      }
      return {
        chartData: Object.entries(grouped).map(([label, { count, color }]) => ({ label, value: count, color })),
      };
    }

    // ── GroupBy: ad spend by month (sum spend, not count) ──
    if (config.dataSource === "crm_ad_daily_stats" && config.groupBy) {
      const monthlySpend = new Array(12).fill(0);
      for (const rec of records) {
        const d = new Date(rec.date);
        if (!isNaN(d.getTime())) monthlySpend[d.getMonth()] += Number(rec.spend) || 0;
      }
      return { chartData: MONTH_NAMES.map((label, i) => ({ label, value: Math.round(monthlySpend[i]) })) };
    }

    // ── GroupBy: generic field ──
    if (config.groupBy) {
      const grouped: Record<string, number> = {};
      for (const rec of records) {
        const raw = rec[config.groupBy];
        const label = resolveLabel(config.groupBy, String(raw || ""));
        grouped[label] = (grouped[label] || 0) + 1;
      }
      return {
        chartData: Object.entries(grouped)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] })),
      };
    }

    // Default: just count
    return { chartData: [{ label: sourceLabel, value: records.length, color: CHART_COLORS[0] }] };
  } catch (e) {
    console.error("[CRM Dashboard] Widget fetch failed:", e);
    return {};
  }
}

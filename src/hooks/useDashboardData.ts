import { supabase } from "@/lib/supabase";
import type { WidgetConfig, ChartDataPoint, KpiData } from "@/types/dashboard";
import { CHART_COLORS, MONTH_NAMES, FIELD_LABELS } from "@/types/dashboard";
import { formatCurrency } from "@/lib/utils";

function resolveLabel(field: string, value: string): string {
  return FIELD_LABELS[field]?.[value] || value || "אחר";
}

export async function fetchWidgetData(config: WidgetConfig): Promise<Partial<WidgetConfig>> {
  if (!config.dataSource) return {};

  try {
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
      query = query.gte("created_at", from);
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

    const { data: records, error, count } = await query;
    if (error) throw error;
    if (!records) return {};

    const sourceLabel = config.title || config.dataSource;

    // Number widget
    if (config.type === "number") {
      const value = records.length;
      let formattedValue = value.toLocaleString();
      let subtitle = "רשומות";

      // Special handling for deals - show total value
      if (config.dataSource === "crm_deals" && config.metric === "value") {
        const totalValue = records.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
        formattedValue = formatCurrency(totalValue);
        subtitle = `${value} עסקאות`;
      }

      return {
        kpiData: { id: `kpi-${config.dataSource}`, label: sourceLabel, value, formattedValue, subtitle },
      };
    }

    // Funnel
    if (config.type === "funnel" && config.funnelField && config.funnelStages?.length) {
      const chartData = config.funnelStages.map(stage => ({
        label: stage.label,
        value: records.filter(r => String(r[config.funnelField!]) === stage.fieldValue).length,
        color: stage.color,
      }));
      return { chartData };
    }

    // Charts with groupBy
    if (config.groupBy === "created_month") {
      const counts = new Array(12).fill(0);
      for (const rec of records) {
        const d = new Date(rec.created_at);
        if (!isNaN(d.getTime())) counts[d.getMonth()]++;
      }
      return { chartData: MONTH_NAMES.map((label, i) => ({ label, value: counts[i] })) };
    }

    if (config.groupBy === "stage_name") {
      // For deals, fetch stage names
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

import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Receipt, Download, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatCurrency, cn, timeAgo } from "@/lib/utils";
import { DEAL_STATUSES } from "@/lib/constants";
import {
  BarChart, Bar, LineChart, Line, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const MONTHS = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];

export default function FinancePage() {
  const [year, setYear] = useState(new Date().getFullYear());

  // Fetch won deals (= revenue)
  const { data: wonDeals } = useQuery({
    queryKey: ["finance-deals", year],
    queryFn: async () => {
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const { data, error } = await supabase
        .from("crm_deals")
        .select("id, title, value, currency, actual_close, updated_at, contact:crm_contacts(first_name, last_name), product:crm_products(name)")
        .eq("status", "won")
        .gte("updated_at", start)
        .lte("updated_at", end + "T23:59:59")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all open deals
  const { data: openDeals } = useQuery({
    queryKey: ["finance-open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("id, value")
        .eq("status", "open");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch ad spend
  const { data: adSpend } = useQuery({
    queryKey: ["finance-adspend", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_ad_daily_stats")
        .select("date, spend")
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
  });

  const totalRevenue = wonDeals?.reduce((sum, d) => sum + (Number(d.value) || 0), 0) || 0;
  const totalDeals = wonDeals?.length || 0;
  const avgDealValue = totalDeals > 0 ? totalRevenue / totalDeals : 0;
  const pipelineValue = openDeals?.reduce((sum, d) => sum + (Number(d.value) || 0), 0) || 0;
  const totalAdSpend = adSpend?.reduce((sum, s) => sum + (Number(s.spend) || 0), 0) || 0;
  const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0;
  const profit = totalRevenue - totalAdSpend;

  // Monthly revenue chart
  const monthlyRevenue = useMemo(() => {
    const months = new Array(12).fill(0);
    wonDeals?.forEach(d => {
      const date = new Date(d.updated_at);
      if (date.getFullYear() === year) {
        months[date.getMonth()] += Number(d.value) || 0;
      }
    });
    return MONTHS.map((name, i) => ({ name, revenue: months[i] }));
  }, [wonDeals, year]);

  // Monthly ad spend
  const monthlySpend = useMemo(() => {
    const months = new Array(12).fill(0);
    adSpend?.forEach(s => {
      const month = new Date(s.date).getMonth();
      months[month] += Number(s.spend) || 0;
    });
    return MONTHS.map((name, i) => ({ name, spend: months[i] }));
  }, [adSpend, year]);

  // Combined chart data
  const combinedData = MONTHS.map((name, i) => ({
    name,
    revenue: monthlyRevenue[i]?.revenue || 0,
    spend: monthlySpend[i]?.spend || 0,
    profit: (monthlyRevenue[i]?.revenue || 0) - (monthlySpend[i]?.spend || 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">פיננסים</h1>
          <p className="text-muted-foreground text-sm">הכנסות, הוצאות ורווחיות</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-input rounded-lg bg-background">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-green-50"><TrendingUp size={18} className="text-green-600" /></div>
            <span className="text-xs text-muted-foreground">הכנסות {year}</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">{totalDeals} עסקאות נסגרו</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-red-50"><TrendingDown size={18} className="text-red-500" /></div>
            <span className="text-xs text-muted-foreground">הוצאות פרסום</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalAdSpend)}</p>
          <p className="text-xs text-muted-foreground mt-1">ROAS: {roas.toFixed(1)}x</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-blue-50"><DollarSign size={18} className="text-blue-600" /></div>
            <span className="text-xs text-muted-foreground">רווח נקי</span>
          </div>
          <p className={cn("text-2xl font-bold", profit >= 0 ? "text-blue-600" : "text-red-500")}>{formatCurrency(profit)}</p>
          <p className="text-xs text-muted-foreground mt-1">מרווח: {totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(0) : 0}%</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-purple-50"><CreditCard size={18} className="text-purple-600" /></div>
            <span className="text-xs text-muted-foreground">ממוצע עסקה</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(avgDealValue)}</p>
          <p className="text-xs text-muted-foreground mt-1">צנרת פתוחה: {formatCurrency(pipelineValue)}</p>
        </div>
      </div>

      {/* Revenue vs Spend Chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">הכנסות מול הוצאות — {year}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={combinedData} margin={{ right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
            <Tooltip
              contentStyle={{ direction: "rtl", fontSize: 12, borderRadius: 8 }}
              formatter={(value: number, name: string) => [
                `₪${value.toLocaleString()}`,
                name === "revenue" ? "הכנסות" : name === "spend" ? "הוצאות" : "רווח"
              ]}
            />
            <Bar dataKey="revenue" fill="#22c55e" name="revenue" radius={[4, 4, 0, 0]} />
            <Bar dataKey="spend" fill="#ef4444" name="spend" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent transactions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">עסקאות אחרונות שנסגרו</h3>
          <span className="text-xs text-muted-foreground">{totalDeals} עסקאות ב-{year}</span>
        </div>
        {wonDeals && wonDeals.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">עסקה</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">לקוח</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">מוצר</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">סכום</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">תאריך</th>
              </tr>
            </thead>
            <tbody>
              {wonDeals.slice(0, 20).map((deal: any) => (
                <tr key={deal.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium">{deal.title}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{deal.contact?.first_name} {deal.contact?.last_name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{deal.product?.name || "—"}</td>
                  <td className="px-4 py-2.5 font-semibold text-green-600">{formatCurrency(deal.value)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{timeAgo(deal.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">אין עסקאות שנסגרו ב-{year}</p>
        )}
      </div>
    </div>
  );
}

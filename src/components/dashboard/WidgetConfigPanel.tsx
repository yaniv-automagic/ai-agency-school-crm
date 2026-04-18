import { useState } from "react";
import { X, Hash, BarChart3, PieChart as PieIcon, LineChart as LineIcon, Triangle, Loader2, Plus, Trash2 } from "lucide-react";
import type { WidgetConfig, WidgetType, WidgetFilter } from "@/types/dashboard";
import { CRM_DATA_SOURCES, CRM_GROUPBY_OPTIONS, CHART_COLORS } from "@/types/dashboard";
import { fetchWidgetData } from "@/hooks/useDashboardData";

const TYPES: { type: WidgetType; label: string; icon: typeof Hash }[] = [
  { type: "number", label: "מספר", icon: Hash },
  { type: "bar", label: "עמודות", icon: BarChart3 },
  { type: "pie", label: "עוגה", icon: PieIcon },
  { type: "line", label: "קו", icon: LineIcon },
  { type: "funnel", label: "משפך", icon: Triangle },
];

const OPERATORS: { value: WidgetFilter["operator"]; label: string }[] = [
  { value: "eq", label: "שווה" },
  { value: "ne", label: "שונה" },
  { value: "gt", label: "גדול מ" },
  { value: "lt", label: "קטן מ" },
  { value: "contains", label: "מכיל" },
  { value: "is-not-null", label: "לא ריק" },
  { value: "is-null", label: "ריק" },
];

const DATE_FILTERS = [
  { value: "", label: "הכל" },
  { value: "this_month", label: "חודש נוכחי" },
  { value: "this_year", label: "שנה נוכחית" },
];

interface Props {
  config: WidgetConfig;
  onSave: (config: WidgetConfig) => void;
  onClose: () => void;
}

export default function WidgetConfigPanel({ config, onSave, onClose }: Props) {
  const [title, setTitle] = useState(config.title);
  const [widgetType, setWidgetType] = useState(config.type);
  const [dataSource, setDataSource] = useState(config.dataSource || "");
  const [groupBy, setGroupBy] = useState(config.groupBy || "");
  const [dateFilter, setDateFilter] = useState(config.dateFilter || "");
  const [metric, setMetric] = useState(config.metric || "");
  const [filters, setFilters] = useState<WidgetFilter[]>(config.filters || []);
  const [saving, setSaving] = useState(false);

  const groupByOptions = CRM_GROUPBY_OPTIONS[dataSource] || [];

  const handleSave = async () => {
    setSaving(true);
    const newConfig: WidgetConfig = {
      title, type: widgetType, dataSource: dataSource || undefined,
      groupBy: groupBy || undefined, dateFilter: dateFilter || undefined,
      metric: metric || undefined,
      filters: filters.length > 0 ? filters : undefined,
    };
    const fetched = await fetchWidgetData(newConfig);
    onSave({ ...newConfig, ...fetched });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <div
        className="fixed inset-y-0 left-0 w-96 bg-card shadow-2xl overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold">הגדרות ווידג׳ט</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-secondary">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">כותרת</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">סוג תצוגה</label>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map(t => (
                <button
                  key={t.type}
                  onClick={() => setWidgetType(t.type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    widgetType === t.type
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <t.icon size={13} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data source */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">מקור נתונים</label>
            <select
              value={dataSource}
              onChange={e => { setDataSource(e.target.value); setGroupBy(""); }}
              className="w-full px-3 py-2 rounded-xl text-sm border border-input bg-background outline-none"
            >
              <option value="">בחר טבלה...</option>
              {CRM_DATA_SOURCES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Metric options per data source */}
          {widgetType === "number" && dataSource && (() => {
            const metricOptions: { value: string; label: string }[] =
              dataSource === "crm_deals" ? [{ value: "", label: "ספירה" }, { value: "value", label: "סכום ₪" }] :
              dataSource === "crm_ad_daily_stats" ? [{ value: "spend", label: "הוצאה ₪" }, { value: "clicks", label: "קליקים" }, { value: "leads", label: "לידים" }, { value: "cpl", label: "עלות לליד" }] :
              dataSource === "crm_meetings" ? [{ value: "", label: "ספירה" }, { value: "show_rate", label: "אחוז הגעה" }, { value: "close_rate", label: "אחוז סגירה" }] :
              dataSource === "crm_program_enrollments" ? [{ value: "", label: "ספירה" }, { value: "completion", label: "אחוז השלמה" }] :
              [];
            if (metricOptions.length === 0) return null;
            return (
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">מדד</label>
                <div className="flex flex-wrap gap-1.5">
                  {metricOptions.map(m => (
                    <button key={m.value} onClick={() => setMetric(m.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${metric === m.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Group by */}
          {["bar", "pie", "line"].includes(widgetType) && dataSource && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">קיבוץ לפי</label>
              <div className="flex flex-wrap gap-1.5">
                {groupByOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setGroupBy(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      groupBy === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date filter */}
          {dataSource && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">תקופה</label>
              <div className="flex gap-1.5">
                {DATE_FILTERS.map(df => (
                  <button
                    key={df.value}
                    onClick={() => setDateFilter(df.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      dateFilter === df.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {df.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          {dataSource && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground">פילטרים</label>
                <button
                  onClick={() => setFilters([...filters, { field: "", operator: "eq", value: "" }])}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:bg-primary/5 px-2 py-1 rounded-lg"
                >
                  <Plus size={11} /> הוסף
                </button>
              </div>
              <div className="space-y-2">
                {filters.map((f, i) => (
                  <div key={i} className="flex gap-1.5 items-center">
                    <input
                      value={f.field}
                      onChange={e => { const n = [...filters]; n[i] = { ...f, field: e.target.value }; setFilters(n); }}
                      placeholder="שדה"
                      className="flex-1 px-2 py-1.5 rounded-lg text-xs border border-input bg-background outline-none"
                    />
                    <select
                      value={f.operator}
                      onChange={e => { const n = [...filters]; n[i] = { ...f, operator: e.target.value as any }; setFilters(n); }}
                      className="w-20 px-2 py-1.5 rounded-lg text-xs border border-input bg-background outline-none"
                    >
                      {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {!["is-null", "is-not-null"].includes(f.operator) && (
                      <input
                        value={f.value}
                        onChange={e => { const n = [...filters]; n[i] = { ...f, value: e.target.value }; setFilters(n); }}
                        placeholder="ערך"
                        className="w-20 px-2 py-1.5 rounded-lg text-xs border border-input bg-background outline-none"
                      />
                    )}
                    <button
                      onClick={() => setFilters(filters.filter((_, idx) => idx !== i))}
                      className="p-1 rounded text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {filters.length === 0 && (
                  <p className="text-xs text-muted-foreground">ללא פילטרים — כל הרשומות</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "טוען נתונים..." : "שמור"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-input hover:bg-secondary"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import {
  Plus, Edit3, Save, GripVertical, X, Settings, LayoutGrid,
  Hash, BarChart3, PieChart as PieIcon, TrendingUp, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import type { GridWidget, WidgetConfig, KpiData, ChartDataPoint } from "@/types/dashboard";
import { CHART_COLORS } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { fetchWidgetData } from "@/hooks/useDashboardData";
import WidgetConfigPanel from "./WidgetConfigPanel";

const COLS = 12;

// ── Widget Content Renderers ──

function KpiWidget({ kpi }: { kpi: KpiData }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-2 text-center">
      <p className="text-3xl font-bold">{kpi.formattedValue}</p>
      <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
      {kpi.trend && (
        <div className={cn(
          "flex items-center gap-1 mt-1.5 text-xs font-medium",
          kpi.trend.direction === "up" ? "text-green-600" : kpi.trend.direction === "down" ? "text-red-500" : "text-muted-foreground"
        )}>
          {kpi.trend.direction === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {kpi.trend.percent}%
        </div>
      )}
    </div>
  );
}

function BarChartWidgetContent({ data }: { data: ChartDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ direction: "rtl", fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieChartWidgetContent({ data }: { data: ChartDataPoint[] }) {
  return (
    <div className="flex h-full">
      <ResponsiveContainer width="60%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius="40%" outerRadius="75%" dataKey="value" stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={data[i].color || CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ direction: "rtl", fontSize: 12, borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 flex flex-col justify-center gap-1.5 pr-2">
        {data.slice(0, 6).map((d, i) => (
          <div key={d.label} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color || CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="truncate flex-1">{d.label}</span>
            <span className="font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChartWidgetContent({ data }: { data: ChartDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ direction: "rtl", fontSize: 12, borderRadius: 8 }} />
        <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function FunnelWidgetContent({ data }: { data: ChartDataPoint[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex flex-col justify-center gap-1.5 h-full px-2">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="flex items-center gap-2">
            <span className="text-xs w-20 truncate text-left">{d.label}</span>
            <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: d.color || CHART_COLORS[i] }} />
            </div>
            <span className="text-xs font-medium w-8 text-right">{d.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function WidgetContent({ widget }: { widget: GridWidget }) {
  const { config } = widget;
  if (config.type === "number" && config.kpiData) return <KpiWidget kpi={config.kpiData} />;
  if (config.type === "bar" && config.chartData) return <BarChartWidgetContent data={config.chartData} />;
  if (config.type === "pie" && config.chartData) return <PieChartWidgetContent data={config.chartData} />;
  if (config.type === "line" && config.chartData) return <LineChartWidgetContent data={config.chartData} />;
  if (config.type === "funnel" && config.chartData) return <FunnelWidgetContent data={config.chartData} />;
  return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">לחץ ⚙️ להגדרה</div>;
}

// ── RTL Handling ──

function rtlToLtr(widgets: GridWidget[]) {
  return widgets.map(w => ({ i: w.i, x: COLS - w.x - w.w, y: w.y, w: w.w, h: w.h, minW: w.config.type === "number" ? 2 : 3, minH: 1 }));
}

function ltrToRtl(layout: any[], existingWidgets: GridWidget[]): GridWidget[] {
  return layout.map(l => {
    const existing = existingWidgets.find(w => w.i === l.i);
    return { i: l.i, x: COLS - l.x - l.w, y: l.y, w: l.w, h: l.h, config: existing?.config || { title: "", type: "number" } };
  });
}

// ── Default Widgets ──

const DEFAULT_WIDGETS: GridWidget[] = [
  { i: "w1", x: 9, y: 0, w: 3, h: 2, config: { title: "לידים", type: "number", dataSource: "crm_contacts" } },
  { i: "w2", x: 6, y: 0, w: 3, h: 2, config: { title: "עסקאות פתוחות", type: "number", dataSource: "crm_deals", filters: [{ field: "status", operator: "eq", value: "open" }] } },
  { i: "w3", x: 3, y: 0, w: 3, h: 2, config: { title: "ערך צנרת", type: "number", dataSource: "crm_deals", metric: "value", filters: [{ field: "status", operator: "eq", value: "open" }] } },
  { i: "w4", x: 0, y: 0, w: 3, h: 2, config: { title: "משימות פתוחות", type: "number", dataSource: "crm_tasks", filters: [{ field: "status", operator: "ne", value: "completed" }] } },
  { i: "w5", x: 6, y: 2, w: 6, h: 4, config: { title: "לידים לפי מקור", type: "pie", dataSource: "crm_contacts", groupBy: "source" } },
  { i: "w6", x: 0, y: 2, w: 6, h: 4, config: { title: "לידים לפי שלב", type: "bar", dataSource: "crm_contacts", groupBy: "stage_id" } },
  { i: "w7", x: 0, y: 6, w: 12, h: 4, config: { title: "לידים לפי חודש", type: "line", dataSource: "crm_contacts", groupBy: "created_month" } },
];

// ── Main Component ──

export default function DynamicDashboard() {
  const [widgets, setWidgets] = useState<GridWidget[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [configWidget, setConfigWidget] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1000);

  // Load saved layout or use defaults
  useEffect(() => {
    const saved = localStorage.getItem("crm-dashboard-layout");
    const initial = saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    setWidgets(initial);
    loadAllData(initial);
  }, []);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setContainerWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(containerRef.current);
    setContainerWidth(containerRef.current.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const loadAllData = async (ws: GridWidget[]) => {
    setLoading(true);
    const updated = await Promise.all(
      ws.map(async w => {
        if (!w.config.dataSource) return w;
        const fetched = await fetchWidgetData(w.config);
        return { ...w, config: { ...w.config, ...fetched } };
      })
    );
    setWidgets(updated);
    setLoading(false);
  };

  const saveLayout = (ws: GridWidget[]) => {
    localStorage.setItem("crm-dashboard-layout", JSON.stringify(ws));
  };

  const handleLayoutChange = useCallback((newLayout: any[]) => {
    setWidgets(prev => {
      const updated = ltrToRtl(newLayout, prev);
      saveLayout(updated);
      return updated;
    });
  }, []);

  const addWidget = () => {
    const id = `w${Date.now()}`;
    const newWidget: GridWidget = {
      i: id, x: 0, y: 999, w: 4, h: 3,
      config: { title: "ווידג׳ט חדש", type: "number" },
    };
    const updated = [...widgets, newWidget];
    setWidgets(updated);
    saveLayout(updated);
    setConfigWidget(id);
  };

  const removeWidget = (id: string) => {
    const updated = widgets.filter(w => w.i !== id);
    setWidgets(updated);
    saveLayout(updated);
  };

  const updateWidgetConfig = async (id: string, config: WidgetConfig) => {
    const updated = widgets.map(w => w.i === id ? { ...w, config } : w);
    setWidgets(updated);
    saveLayout(updated);
    setConfigWidget(null);
  };

  const refreshAll = () => loadAllData(widgets);

  const layout = useMemo(() => {
    const items = rtlToLtr(widgets);
    if (!editMode) return items.map(item => ({ ...item, static: true }));
    return items;
  }, [widgets, editMode]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">דשבורד</h1>
          <p className="text-muted-foreground text-sm">
            {widgets.length} ווידג׳טים
            {editMode && " • מצב עריכה"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            className="px-3 py-2 text-sm border border-input rounded-lg hover:bg-secondary transition-colors"
          >
            🔄 רענן
          </button>
          {editMode && (
            <button
              onClick={addWidget}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-input rounded-lg hover:bg-secondary transition-colors"
            >
              <Plus size={14} />
              ווידג׳ט
            </button>
          )}
          <button
            onClick={() => setEditMode(!editMode)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              editMode
                ? "bg-primary text-primary-foreground"
                : "border border-input hover:bg-secondary"
            )}
          >
            {editMode ? <><Save size={14} /> סיים עריכה</> : <><Edit3 size={14} /> עריכה</>}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div ref={containerRef}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-border text-muted-foreground">
            <LayoutGrid size={48} className="mb-3 opacity-20" />
            <p className="text-lg font-medium mb-2">הדשבורד ריק</p>
            <p className="text-sm mb-4">לחץ על "עריכה" ואז "ווידג׳ט" כדי להתחיל</p>
            <button onClick={() => { setEditMode(true); addWidget(); }} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg">
              הוסף ווידג׳ט ראשון
            </button>
          </div>
        ) : (
          <div dir="ltr">
            <GridLayout
              layout={layout}
              cols={COLS}
              rowHeight={60}
              width={containerWidth}
              isDraggable={editMode}
              isResizable={editMode}
              draggableHandle=".widget-drag-handle"
              resizeHandles={["se"]}
              compactType="vertical"
              margin={[14, 14]}
              containerPadding={[0, 0]}
              onDragStop={handleLayoutChange}
              onResizeStop={handleLayoutChange}
              useCSSTransforms
            >
              {widgets.map(widget => (
                <div key={widget.i} dir="rtl">
                  <div className={cn(
                    "h-full bg-card border rounded-xl overflow-hidden transition-shadow",
                    editMode ? "border-primary/30 shadow-md" : "border-border hover:shadow-sm"
                  )}>
                    {/* Widget header */}
                    <div className={cn(
                      "flex items-center justify-between px-3 py-2 border-b border-border",
                      editMode && "widget-drag-handle cursor-grab active:cursor-grabbing"
                    )}>
                      <div className="flex items-center gap-2 min-w-0">
                        {editMode && <GripVertical size={14} className="text-muted-foreground shrink-0" />}
                        <h3 className="text-xs font-semibold truncate">{widget.config.title}</h3>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => setConfigWidget(widget.i)}
                          className={cn(
                            "p-1 rounded-md transition-all text-muted-foreground hover:bg-secondary",
                            editMode ? "opacity-100" : "opacity-0 hover:opacity-100"
                          )}
                        >
                          <Settings size={12} />
                        </button>
                        {editMode && (
                          <button
                            onClick={() => removeWidget(widget.i)}
                            className="p-1 rounded-md text-destructive hover:bg-destructive/10"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Widget content */}
                    <div className="p-2 h-[calc(100%-36px)] overflow-hidden">
                      <WidgetContent widget={widget} />
                    </div>
                  </div>
                </div>
              ))}
            </GridLayout>
          </div>
        )}
      </div>

      {/* Config panel */}
      {configWidget && (
        <WidgetConfigPanel
          config={widgets.find(w => w.i === configWidget)?.config || { title: "", type: "number" }}
          onSave={(config) => updateWidgetConfig(configWidget, config)}
          onClose={() => setConfigWidget(null)}
        />
      )}
    </div>
  );
}

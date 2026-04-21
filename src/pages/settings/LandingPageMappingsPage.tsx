import { useState, useEffect } from "react";
import { ArrowRight, Plus, Trash2, Save, Globe, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePipelines } from "@/hooks/useDeals";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LandingPageMapping {
  id: string;
  url_pattern: string;
  label: string;
  pipeline_id: string | null;
  stage_id: string | null;
  entry_type: string | null;
}

const ENTRY_TYPES = [
  { value: "vsl", label: "VSL" },
  { value: "webinar", label: "וובינר" },
  { value: "organic", label: "אורגני" },
  { value: "direct", label: "ישיר" },
];

interface DiscoveredPage {
  url: string;
  label: string;
  leads: number; // 0 = from WP only
  source: "wp" | "crm" | "both";
}

const WP_SITE = "https://aiagencyschool.co.il";

export default function LandingPageMappingsPage() {
  const [mappings, setMappings] = useState<LandingPageMapping[]>([]);
  const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { data: pipelines } = usePipelines();
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_landing_page_mappings")
      .select("*")
      .order("created_at");
    setMappings((data as LandingPageMapping[]) || []);
    await discoverAll();
    setLoading(false);
  };

  const normalizeUrl = (url: string) => {
    try {
      const u = new URL(url);
      // Decode URI to merge encoded and decoded versions of the same URL
      const path = decodeURIComponent(u.pathname).replace(/\/$/, "");
      return path === "" ? u.origin : `${u.origin}${path}`;
    } catch {
      try { return decodeURIComponent(url).split("?")[0]; } catch { return url.split("?")[0]; }
    }
  };

  // ── Merge WordPress pages + CRM contact URLs into one list ──
  const discoverAll = async () => {
    setRefreshing(true);
    const pageMap = new Map<string, DiscoveredPage>();

    // 1. WordPress pages
    try {
      let page = 1;
      while (true) {
        const res = await fetch(
          `${WP_SITE}/wp-json/wp/v2/pages?per_page=100&page=${page}&status=publish&_fields=id,title,link,status`
        );
        if (!res.ok) break;
        const data = await res.json();
        if (data.length === 0) break;
        for (const wp of data) {
          const url = normalizeUrl(wp.link);
          pageMap.set(url, { url, label: wp.title.rendered, leads: 0, source: "wp" });
        }
        if (page >= parseInt(res.headers.get("x-wp-totalpages") || "1")) break;
        page++;
      }
    } catch { /* WP not accessible */ }

    // 2. CRM contact landing pages
    const { data: contacts } = await supabase
      .from("crm_contacts")
      .select("landing_page_url")
      .not("landing_page_url", "is", null);

    if (contacts) {
      for (const c of contacts) {
        const url = normalizeUrl(c.landing_page_url || "");
        if (!url) continue;
        const existing = pageMap.get(url);
        if (existing) {
          existing.leads++;
          existing.source = "both";
        } else {
          pageMap.set(url, { url, label: "", leads: 1, source: "crm" });
        }
      }
    }

    // Sort: pages with leads first, then WP pages
    const sorted = Array.from(pageMap.values()).sort((a, b) => {
      if (a.leads !== b.leads) return b.leads - a.leads;
      return a.url.localeCompare(b.url);
    });

    setDiscoveredPages(sorted);
    setRefreshing(false);
  };

  const addMapping = (url?: string, label?: string) => {
    setMappings(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        url_pattern: url || "",
        label: label || "",
        pipeline_id: null,
        stage_id: null,
        entry_type: null,
      },
    ]);
  };

  const updateMapping = (index: number, updates: Partial<LandingPageMapping>) => {
    setMappings(prev => prev.map((m, i) => (i === index ? { ...m, ...updates } : m)));
  };

  const removeMapping = (index: number) => {
    const mapping = mappings[index];
    setMappings(prev => prev.filter((_, i) => i !== index));
    if (!mapping.id.startsWith("new-")) {
      supabase.from("crm_landing_page_mappings").delete().eq("id", mapping.id).then();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    for (const m of mappings) {
      if (!m.url_pattern) continue;
      const data = {
        url_pattern: m.url_pattern,
        label: m.label || null,
        pipeline_id: m.pipeline_id || null,
        stage_id: m.stage_id || null,
        entry_type: m.entry_type || null,
      };
      if (m.id.startsWith("new-")) {
        await supabase.from("crm_landing_page_mappings").insert(data);
      } else {
        await supabase.from("crm_landing_page_mappings").update(data).eq("id", m.id);
      }
    }
    toast.success("מיפוי דפי נחיתה נשמר");
    setSaving(false);
    loadData();
  };

  const getStagesForPipeline = (pipelineId: string | null) => {
    if (!pipelineId) return [];
    return pipelines?.find(p => p.id === pipelineId)?.stages || [];
  };

  const isMapped = (url: string) =>
    mappings.some(m => {
      const normM = normalizeUrl(m.url_pattern);
      const normU = normalizeUrl(url);
      return normM === normU || normU.includes(normM) || normM.includes(normU);
    });

  const unmapped = discoveredPages.filter(d => !isMapped(d.url));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground">
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">מיפוי דפי נחיתה</h1>
          <p className="text-muted-foreground text-sm">קשר כל דף נחיתה לצנרת הרלוונטית — לידים חדשים ישויכו אוטומטית</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* Mapped pages */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">דפים ממופים ({mappings.length})</h2>
            {mappings.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">אין מיפויים עדיין — בחר דף מהרשימה למטה</p>
            )}
            {mappings.map((mapping, idx) => (
              <div key={mapping.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
                <Globe size={16} className="text-muted-foreground shrink-0" />

                <input
                  value={mapping.url_pattern}
                  onChange={e => updateMapping(idx, { url_pattern: e.target.value })}
                  placeholder="https://aiagencyschool.co.il/vsl"
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring"
                  dir="ltr"
                />

                <input
                  value={mapping.label}
                  onChange={e => updateMapping(idx, { label: e.target.value })}
                  placeholder="שם הדף"
                  className="w-36 px-3 py-1.5 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring"
                />

                <Select
                  value={mapping.pipeline_id || "__none__"}
                  onValueChange={v => updateMapping(idx, { pipeline_id: v === "__none__" ? null : v, stage_id: null })}
                >
                  <SelectTrigger className="w-36 px-3 py-1.5 text-sm border border-input rounded-lg bg-background">
                    <SelectValue placeholder="בחר צנרת" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">בחר צנרת</SelectItem>
                    {pipelines?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={mapping.stage_id || "__none__"}
                  onValueChange={v => updateMapping(idx, { stage_id: v === "__none__" ? null : v })}
                  disabled={!mapping.pipeline_id}
                >
                  <SelectTrigger className="w-36 px-3 py-1.5 text-sm border border-input rounded-lg bg-background">
                    <SelectValue placeholder="שלב ראשון" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">שלב ראשון</SelectItem>
                    {getStagesForPipeline(mapping.pipeline_id).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={mapping.entry_type || "__none__"}
                  onValueChange={v => updateMapping(idx, { entry_type: v === "__none__" ? null : v })}
                >
                  <SelectTrigger className="w-32 px-3 py-1.5 text-sm border border-input rounded-lg bg-background">
                    <SelectValue placeholder="סוג כניסה" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">סוג כניסה</SelectItem>
                    {ENTRY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <button onClick={() => removeMapping(idx)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => addMapping()}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-dashed border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <Plus size={14} />
              הוסף ידנית
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 ml-auto"
            >
              <Save size={14} />
              {saving ? "שומר..." : "שמור"}
            </button>
          </div>

          {/* All discovered pages (WP + CRM merged) */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">
                דפים שזוהו ({unmapped.length} לא ממופים מתוך {discoveredPages.length})
              </h2>
              <button
                onClick={discoverAll}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-input rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
              >
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                רענן
              </button>
            </div>

            {discoveredPages.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">לא נמצאו דפים</p>
            )}

            <div className="grid gap-2">
              {discoveredPages.map(page => {
                const mapped = isMapped(page.url);
                return (
                  <div
                    key={page.url}
                    className={cn(
                      "flex items-center gap-3 border rounded-lg px-4 py-3",
                      mapped ? "bg-primary/5 border-primary/20" : "bg-card border-border"
                    )}
                  >
                    <Globe size={14} className={mapped ? "text-primary" : "text-muted-foreground"} />
                    <div className="flex-1 min-w-0">
                      {page.label && <p className="text-sm font-medium truncate">{page.label}</p>}
                      <p className={cn("text-xs truncate", page.label ? "text-muted-foreground" : "text-sm font-mono")} dir="ltr">{page.url}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {page.leads > 0 && (
                        <span className="text-xs text-muted-foreground">{page.leads} לידים</span>
                      )}
                      {page.source === "wp" && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">WP</span>
                      )}
                      <a href={page.url} target="_blank" rel="noopener" className="p-1 text-muted-foreground hover:text-foreground">
                        <ExternalLink size={12} />
                      </a>
                      {mapped ? (
                        <span className="text-xs text-primary font-medium">ממופה</span>
                      ) : (
                        <button
                          onClick={() => addMapping(page.url, page.label)}
                          className="text-xs text-primary hover:underline whitespace-nowrap"
                        >
                          + מפה לצנרת
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

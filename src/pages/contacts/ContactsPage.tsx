import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus, Search, LayoutGrid, List, SlidersHorizontal, X, Columns3,
  Trash2, GripVertical,
} from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useContacts, useUpdateContact } from "@/hooks/useContacts";
import { usePipelines } from "@/hooks/useDeals";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { CONTACT_SOURCES } from "@/lib/constants";
import { cn, formatPhone, formatDateTime } from "@/lib/utils";
import ContactForm from "@/components/contacts/ContactForm";
import { ExportButton, ImportButton } from "@/components/contacts/ImportExportContacts";
import BulkActions from "@/components/contacts/BulkActions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Contact, PipelineStage } from "@/types/crm";

// ── Column definitions ──
interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  render: (contact: Contact, helpers: RenderHelpers) => React.ReactNode;
}
interface RenderHelpers {
  getStage: (c: Contact) => PipelineStage | undefined;
  openStagePicker: (contactId: string, e: React.MouseEvent) => void;
  openAssigneePicker: (contactId: string, e: React.MouseEvent) => void;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "name", label: "שם", defaultVisible: true,
    render: (c) => <span className="font-medium">{c.first_name} {c.last_name}</span>,
  },
  { key: "email", label: "מייל", defaultVisible: true, render: (c) => <span className="text-muted-foreground">{c.email || "—"}</span> },
  { key: "phone", label: "טלפון", defaultVisible: true, render: (c) => <span className="text-muted-foreground" dir="ltr">{formatPhone(c.phone || "") || "—"}</span> },
  { key: "stage", label: "שלב", defaultVisible: true,
    render: (c, { getStage, openStagePicker }) => {
      const stage = getStage(c);
      return (
        <button onClick={(e) => { e.stopPropagation(); openStagePicker(c.id, e); }}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage?.color || "#6b7280" }} />
          {stage?.name || "ללא שלב"}
        </button>
      );
    },
  },
  { key: "assigned", label: "אחראי", defaultVisible: true,
    render: (c, { openAssigneePicker }) => (
      <button onClick={(e) => { e.stopPropagation(); openAssigneePicker(c.id, e); }}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
        {c.assigned_member ? (
          <>
            {c.assigned_member.avatar_url ? (
              <img src={c.assigned_member.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">{c.assigned_member.display_name?.charAt(0)}</div>
            )}
            {c.assigned_member.display_name}
          </>
        ) : "לא משויך"}
      </button>
    ),
  },
  { key: "source", label: "מקור", defaultVisible: true, render: (c) => <span className="text-muted-foreground text-xs">{CONTACT_SOURCES.find(s => s.value === c.source)?.label || "—"}</span> },
  { key: "created", label: "נוצר", defaultVisible: true, render: (c) => <span className="text-muted-foreground text-xs">{formatDateTime(c.created_at)}</span> },
  { key: "tags", label: "תגיות", defaultVisible: false,
    render: (c) => c.tags?.length > 0 ? (
      <div className="flex gap-1 flex-wrap justify-center">
        {c.tags.slice(0, 2).map(t => <span key={t} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{t}</span>)}
        {c.tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{c.tags.length - 2}</span>}
      </div>
    ) : <span className="text-muted-foreground">—</span>,
  },
  { key: "address", label: "כתובת", defaultVisible: false, render: (c) => <span className="text-muted-foreground text-xs">{c.address || c.city || "—"}</span> },
  { key: "utm_source", label: "UTM Source", defaultVisible: false, render: (c) => <span className="text-muted-foreground text-xs" dir="ltr">{c.utm_source || "—"}</span> },
  { key: "utm_campaign", label: "קמפיין", defaultVisible: false, render: (c) => <span className="text-muted-foreground text-xs" dir="ltr">{c.utm_campaign || "—"}</span> },
  { key: "entry_type", label: "סוג כניסה", defaultVisible: false, render: (c) => <span className="text-muted-foreground text-xs">{c.entry_type || "—"}</span> },
  { key: "landing_page", label: "דף נחיתה", defaultVisible: false,
    render: (c) => <span className="text-muted-foreground text-xs truncate max-w-[150px] block mx-auto" dir="ltr">{c.landing_page_url?.replace("https://aiagencyschool.co.il", "") || "—"}</span> },
  { key: "id_number", label: "ת.ז.", defaultVisible: false, render: (c) => <span className="text-muted-foreground text-xs">{c.id_number || "—"}</span> },
  { key: "ad_platform", label: "פלטפורמה", defaultVisible: false, render: (c) => <span className="text-muted-foreground text-xs">{c.ad_platform || "—"}</span> },
  { key: "utm_medium", label: "utm_medium", defaultVisible: false, render: (c) => <span className="text-muted-foreground text-xs" dir="ltr">{c.utm_medium || "—"}</span> },
  { key: "utm_content", label: "utm_content", defaultVisible: false, render: (c) => <span className="text-muted-foreground text-xs" dir="ltr">{c.utm_content || "—"}</span> },
  { key: "utm_term", label: "utm_term", defaultVisible: false, render: (c) => <span className="text-muted-foreground text-xs" dir="ltr">{c.utm_term || "—"}</span> },
  { key: "sales_call", label: "שיחה קצה לקצה", defaultVisible: false, render: (c) => (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", c.sales_call_completed ? "bg-green-100 text-green-700" : "bg-secondary text-muted-foreground")}>
      {c.sales_call_completed ? "בוצעה" : "לא"}
    </span>
  )},
  { key: "marketing_consent", label: "אישור דיוור", defaultVisible: false, render: (c) => (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", c.marketing_consent ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>
      {c.marketing_consent ? "אישר" : "לא אישר"}
    </span>
  )},
  { key: "community_groups", label: "קבוצות WhatsApp", defaultVisible: false, render: (c) => c.community_groups?.length > 0 ? (
    <div className="flex gap-1 flex-wrap justify-center">
      {c.community_groups.slice(0, 2).map((g: string) => <span key={g} className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{g}</span>)}
      {c.community_groups.length > 2 && <span className="text-[10px] text-muted-foreground">+{c.community_groups.length - 2}</span>}
    </div>
  ) : <span className="text-[10px] text-amber-600">לא צורף</span> },
  { key: "webinar_registered", label: "נרשם לוובינר", defaultVisible: false, render: (c) => <span className="text-muted-foreground text-xs">{c.webinar_registered || "—"}</span> },
  { key: "webinar_attended", label: "נכח בוובינר", defaultVisible: false, render: (c) => <span className="text-muted-foreground text-xs">{c.webinar_attended || "—"}</span> },
];

// ── Filter types ──
type FilterLogic = "and" | "or";
interface FilterCondition { id: string; field: string; operator: string; value: string; }
interface FilterGroup { id: string; logic: FilterLogic; conditions: FilterCondition[]; }

interface SavedView { id: string; name: string; columns: string[]; filterGroups: FilterGroup[]; pipelineId?: string; stageId?: string; assigneeFilter?: string; }

const FILTER_FIELDS = [
  { key: "first_name", label: "שם פרטי" }, { key: "last_name", label: "שם משפחה" },
  { key: "email", label: "מייל" }, { key: "phone", label: "טלפון" },
  { key: "assigned_to", label: "אחראי" }, { key: "stage_id", label: "שלב" },
  { key: "source", label: "מקור" }, { key: "entry_type", label: "סוג כניסה" },
  { key: "utm_source", label: "UTM Source" }, { key: "utm_campaign", label: "קמפיין" },
  { key: "utm_medium", label: "UTM Medium" }, { key: "ad_platform", label: "פלטפורמה" },
  { key: "tags", label: "תגיות" }, { key: "address", label: "כתובת" },
  { key: "city", label: "עיר" }, { key: "id_number", label: "ת.ז." },
  { key: "notes", label: "הערות" }, { key: "landing_page_url", label: "דף נחיתה" },
];
const FILTER_OPS = [
  { key: "contains", label: "מכיל" }, { key: "eq", label: "שווה" },
  { key: "neq", label: "שונה" }, { key: "not_contains", label: "לא מכיל" },
  { key: "is_empty", label: "ריק" }, { key: "is_not_empty", label: "לא ריק" },
];

const STORAGE_COLS = "crm-leads-columns";
const STORAGE_VIEWS = "crm-leads-views";

// Fields that use dropdown values instead of free text
const DROPDOWN_FIELDS: Record<string, string> = {
  assigned_to: "assignee", source: "source", entry_type: "entry_type",
  ad_platform: "ad_platform", stage_id: "stage",
};

function matchCondition(c: Contact, cond: FilterCondition, meId?: string): boolean {
  const val = String((c as any)[cond.field] || "").toLowerCase();
  // Resolve __me__ token for assigned_to
  const target = (cond.value === "__me__" && meId) ? meId.toLowerCase() : cond.value.toLowerCase();
  switch (cond.operator) {
    case "eq": return val === target;
    case "neq": return val !== target;
    case "contains": return val.includes(target);
    case "not_contains": return !val.includes(target);
    case "is_empty": return !val || val === "null";
    case "is_not_empty": return !!val && val !== "null";
    default: return true;
  }
}

export default function ContactsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("__all__");
  const [showForm, setShowForm] = useState(searchParams.get("new") === "true");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusPickerId, setStatusPickerId] = useState<string | null>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; right: number } | null>(null);
  const [assigneePickerId, setAssigneePickerId] = useState<string | null>(null);
  const [assigneePickerPos, setAssigneePickerPos] = useState<{ top: number; right: number } | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showNewView, setShowNewView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string>("__all__");

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_COLS);
    return saved ? JSON.parse(saved) : ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
  });
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    const saved = localStorage.getItem(STORAGE_VIEWS);
    return saved ? JSON.parse(saved) : [];
  });

  const navigate = useNavigate();
  const updateContact = useUpdateContact();
  const confirmDialog = useConfirm();
  const { teamMember } = useAuth();
  const { members } = useTeamMembers();
  const { data: pipelines } = usePipelines();

  const activePipeline = selectedPipelineId ? pipelines?.find(p => p.id === selectedPipelineId) : pipelines?.find(p => p.is_default) || pipelines?.[0];
  const stages = activePipeline?.stages || [];
  const allStages = pipelines?.flatMap(p => p.stages || []) || [];

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => { if (!contacts) return; setSelectedIds(prev => prev.length === contacts.length ? [] : contacts.map(c => c.id)); };

  const { data: contacts, isLoading } = useContacts({ search: search || undefined, stage_id: stageFilter === "__all__" ? undefined : stageFilter });
  const getStage = useCallback((c: Contact) => c.stage || allStages.find(s => s.id === c.stage_id), [allStages]);

  // ── Compound filtering ──
  const totalConditions = filterGroups.reduce((n, g) => n + g.conditions.length, 0);
  const filteredContacts = useMemo(() => {
    if (!contacts) return contacts;
    let result = contacts;

    // Assignee quick filter
    if (assigneeFilter !== "__all__") {
      const assigneeId = assigneeFilter === "__me__" ? teamMember?.id : assigneeFilter;
      result = result.filter(c => c.assigned_to === assigneeId);
    }

    // Compound filter groups
    if (filterGroups.length > 0) {
      const meId = teamMember?.id;
      result = result.filter(c =>
        filterGroups.every(group => {
          if (group.conditions.length === 0) return true;
          return group.logic === "and"
            ? group.conditions.every(cond => matchCondition(c, cond, meId))
            : group.conditions.some(cond => matchCondition(c, cond, meId));
        })
      );
    }

    return result;
  }, [contacts, filterGroups, assigneeFilter, teamMember?.id]);

  // ── Columns ──
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const persistColumns = (cols: string[]) => { setVisibleColumns(cols); localStorage.setItem(STORAGE_COLS, JSON.stringify(cols)); };
  const toggleColumn = (key: string) => persistColumns(visibleColumns.includes(key) ? visibleColumns.filter(k => k !== key) : [...visibleColumns, key]);
  const handleColumnDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIdx = visibleColumns.indexOf(active.id as string);
      const newIdx = visibleColumns.indexOf(over.id as string);
      persistColumns(arrayMove(visibleColumns, oldIdx, newIdx));
    }
  };
  const activeColumns = visibleColumns.map(k => ALL_COLUMNS.find(c => c.key === k)!).filter(Boolean);

  // ── Filter groups ──
  const addGroup = () => setFilterGroups(prev => [...prev, { id: `g-${Date.now()}`, logic: "and", conditions: [{ id: `c-${Date.now()}`, field: "first_name", operator: "contains", value: "" }] }]);
  const removeGroup = (gid: string) => setFilterGroups(prev => prev.filter(g => g.id !== gid));
  const toggleGroupLogic = (gid: string) => setFilterGroups(prev => prev.map(g => g.id === gid ? { ...g, logic: g.logic === "and" ? "or" : "and" } : g));
  const addCondition = (gid: string) => setFilterGroups(prev => prev.map(g => g.id === gid ? { ...g, conditions: [...g.conditions, { id: `c-${Date.now()}`, field: "first_name", operator: "contains", value: "" }] } : g));
  const removeCondition = (gid: string, cid: string) => setFilterGroups(prev => prev.map(g => g.id === gid ? { ...g, conditions: g.conditions.filter(c => c.id !== cid) } : g).filter(g => g.conditions.length > 0));
  const updateCondition = (gid: string, cid: string, updates: Partial<FilterCondition>) => setFilterGroups(prev => prev.map(g => g.id === gid ? { ...g, conditions: g.conditions.map(c => c.id === cid ? { ...c, ...updates } : c) } : g));

  // ── Views ──
  const persistViews = (views: SavedView[]) => { setSavedViews(views); localStorage.setItem(STORAGE_VIEWS, JSON.stringify(views)); };
  const saveCurrentView = () => {
    if (!newViewName.trim()) return;
    const view: SavedView = { id: `v-${Date.now()}`, name: newViewName.trim(), columns: visibleColumns, filterGroups, pipelineId: selectedPipelineId, stageId: stageFilter, assigneeFilter };
    persistViews([...savedViews, view]);
    setActiveViewId(view.id);
    setNewViewName(""); setShowNewView(false);
  };
  const loadView = (view: SavedView) => {
    persistColumns(view.columns);
    setFilterGroups(view.filterGroups || []);
    if (view.pipelineId) setSelectedPipelineId(view.pipelineId);
    if (view.stageId) setStageFilter(view.stageId);
    setAssigneeFilter(view.assigneeFilter || "__all__");
    setActiveViewId(view.id);
  };
  const deleteView = async (id: string) => {
    const ok = await confirmDialog({ title: "מחיקת תצוגה", description: "למחוק את התצוגה?", confirmText: "מחק", cancelText: "ביטול", variant: "destructive" });
    if (!ok) return;
    persistViews(savedViews.filter(v => v.id !== id));
    if (activeViewId === id) setActiveViewId(null);
  };
  const handleViewDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIdx = savedViews.findIndex(v => v.id === active.id);
      const newIdx = savedViews.findIndex(v => v.id === over.id);
      persistViews(arrayMove(savedViews, oldIdx, newIdx));
    }
  };

  const openStagePicker = (contactId: string, e: React.MouseEvent) => {
    if (statusPickerId === contactId) { setStatusPickerId(null); setPickerPos(null); return; }
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPickerPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setStatusPickerId(contactId);
  };

  const openAssigneePicker = (contactId: string, e: React.MouseEvent) => {
    if (assigneePickerId === contactId) { setAssigneePickerId(null); setAssigneePickerPos(null); return; }
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setAssigneePickerPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setAssigneePickerId(contactId);
    setStatusPickerId(null); setPickerPos(null);
  };

  const helpers: RenderHelpers = { getStage, openStagePicker, openAssigneePicker };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">לידים</h1>
          <p className="text-muted-foreground text-sm">{filteredContacts?.length || 0} לידים</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors">
          <Plus size={16} /> ליד חדש
        </button>
      </div>

      {/* Views bar */}
      <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto">
        <button onClick={() => { setActiveViewId(null); persistColumns(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)); setFilterGroups([]); setStageFilter("__all__"); setAssigneeFilter("__all__"); }}
          className={cn("px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors shrink-0",
            !activeViewId ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>
          כל הלידים
        </button>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleViewDragEnd}>
          <SortableContext items={savedViews.map(v => v.id)} strategy={horizontalListSortingStrategy}>
            {savedViews.map(v => <SortableViewTab key={v.id} view={v} isActive={activeViewId === v.id} onLoad={() => loadView(v)} onDelete={() => deleteView(v.id)} />)}
          </SortableContext>
        </DndContext>
        {showNewView ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <input value={newViewName} onChange={e => setNewViewName(e.target.value)} placeholder="שם התצוגה..."
              className="px-2 py-1 text-xs border border-input rounded-lg bg-background outline-none w-28" autoFocus
              onKeyDown={e => { if (e.key === "Enter") saveCurrentView(); if (e.key === "Escape") setShowNewView(false); }} />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {[
                stageFilter !== "__all__" && "שלב",
                assigneeFilter !== "__all__" && "אחראי",
                totalConditions > 0 && `${totalConditions} פילטרים`,
                `${visibleColumns.length} עמודות`,
              ].filter(Boolean).join(" · ")}
            </span>
            <button onClick={saveCurrentView} disabled={!newViewName.trim()}
              className="px-2 py-1 text-xs font-medium text-primary-foreground bg-primary rounded-lg disabled:opacity-50">שמור</button>
            <button onClick={() => setShowNewView(false)} className="p-0.5 text-muted-foreground"><X size={12} /></button>
          </div>
        ) : (
          <button onClick={() => setShowNewView(true)}
            className="px-2 py-1.5 text-xs text-muted-foreground hover:text-primary border border-dashed border-border rounded-lg hover:border-primary/30 whitespace-nowrap shrink-0">
            + צור תצוגה
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="חיפוש..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        {pipelines && pipelines.length > 1 && (
          <Select value={activePipeline?.id || ""} onValueChange={(v) => { setSelectedPipelineId(v); setStageFilter("__all__"); }}>
            <SelectTrigger className="w-auto px-3 py-2 text-sm border border-input rounded-lg bg-background"><SelectValue placeholder="צנרת" /></SelectTrigger>
            <SelectContent>{pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-auto px-3 py-2 text-sm border border-input rounded-lg bg-background"><SelectValue placeholder="שלב" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">כל השלבים</SelectItem>
            {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {/* Assignee quick filter */}
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-auto px-3 py-2 text-sm border border-input rounded-lg bg-background"><SelectValue placeholder="אחראי" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">כל האחראים</SelectItem>
            <SelectItem value="__me__">הלידים שלי</SelectItem>
            {members.map(m => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <button onClick={() => setShowFilters(!showFilters)}
          className={cn("flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors",
            totalConditions > 0 ? "border-primary bg-primary/5 text-primary" : "border-input hover:bg-secondary text-muted-foreground")}>
          <SlidersHorizontal size={14} /> פילטרים{totalConditions > 0 && ` (${totalConditions})`}
        </button>
        <div className="relative">
          <button onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-input rounded-lg hover:bg-secondary text-muted-foreground">
            <Columns3 size={14} /> עמודות
          </button>
          {showColumnPicker && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowColumnPicker(false)} />
              <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-xl shadow-xl py-2 w-56 z-40" dir="rtl">
                <p className="text-[10px] text-muted-foreground px-3 pb-1">גרור לשינוי סדר</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
                  <SortableContext items={visibleColumns} strategy={verticalListSortingStrategy}>
                    {visibleColumns.map(key => {
                      const col = ALL_COLUMNS.find(c => c.key === key);
                      if (!col) return null;
                      return <SortableColumnItem key={key} colKey={key} label={col.label} onToggle={() => toggleColumn(key)} />;
                    })}
                  </SortableContext>
                </DndContext>
                <div className="border-t border-border mt-1 pt-1">
                  {ALL_COLUMNS.filter(c => !visibleColumns.includes(c.key)).map(col => (
                    <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary cursor-pointer text-muted-foreground">
                      <input type="checkbox" checked={false} onChange={() => toggleColumn(col.key)} className="rounded accent-primary w-3.5 h-3.5" />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <ExportButton contacts={filteredContacts || []} />
        <ImportButton />
        <div className="flex items-center border border-input rounded-lg overflow-hidden ml-auto">
          <button onClick={() => setViewMode("table")} className={cn("p-2 transition-colors", viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}><List size={16} /></button>
          <button onClick={() => setViewMode("kanban")} className={cn("p-2 transition-colors", viewMode === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}><LayoutGrid size={16} /></button>
        </div>
      </div>

      {/* Filters panel - compound groups */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3" dir="rtl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">פילטרים</h3>
            {filterGroups.length > 0 && <button onClick={() => setFilterGroups([])} className="text-xs text-destructive hover:underline">נקה הכל</button>}
          </div>
          {filterGroups.map((group, gi) => (
            <div key={group.id} className="border border-border rounded-lg p-3 space-y-2 relative">
              {gi > 0 && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-card px-2 text-muted-foreground">AND</div>}
              <div className="flex items-center justify-between">
                <button onClick={() => toggleGroupLogic(group.id)}
                  className="text-xs font-bold px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80">
                  {group.logic === "and" ? "AND — כל התנאים" : "OR — לפחות תנאי אחד"}
                </button>
                <button onClick={() => removeGroup(group.id)} className="p-1 text-muted-foreground hover:text-destructive"><X size={14} /></button>
              </div>
              {group.conditions.map((cond, ci) => (
                <div key={cond.id} className="flex items-center gap-2">
                  {ci > 0 && <span className="text-[10px] font-bold text-muted-foreground w-6 text-center shrink-0">{group.logic === "and" ? "ו" : "או"}</span>}
                  {ci === 0 && <span className="w-6 shrink-0" />}
                  <Select value={cond.field} onValueChange={v => {
                    const isDropdown = v in DROPDOWN_FIELDS;
                    updateCondition(group.id, cond.id, { field: v, value: "", operator: isDropdown ? "eq" : cond.operator });
                  }}>
                    <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{FILTER_FIELDS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={cond.operator} onValueChange={v => updateCondition(group.id, cond.id, { operator: v })}>
                    <SelectTrigger className="w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{FILTER_OPS.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {!["is_empty", "is_not_empty"].includes(cond.operator) && (
                    <FilterValueInput field={cond.field} value={cond.value}
                      onChange={v => updateCondition(group.id, cond.id, { value: v })}
                      members={members} stages={allStages} pipelines={pipelines} />
                  )}
                  <button onClick={() => removeCondition(group.id, cond.id)} className="p-1 text-muted-foreground hover:text-destructive"><X size={12} /></button>
                </div>
              ))}
              <button onClick={() => addCondition(group.id)} className="text-[11px] text-primary hover:underline"><Plus size={10} className="inline" /> הוסף תנאי</button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 border-t border-border mt-2">
            <button onClick={addGroup} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Plus size={12} /> הוסף קבוצת תנאים
            </button>
            <button onClick={() => setShowNewView(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
              שמור כתצוגה
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : viewMode === "table" ? (
        <div className="border border-border rounded-xl bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-3 text-center">
                  <input type="checkbox" className="rounded accent-primary" checked={filteredContacts?.length ? selectedIds.length === filteredContacts.length : false} onChange={toggleAll} />
                </th>
                {activeColumns.map(col => <th key={col.key} className="px-4 py-3 font-medium text-muted-foreground text-center text-xs">{col.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredContacts && filteredContacts.length > 0 ? filteredContacts.map(contact => (
                <tr key={contact.id} onClick={() => navigate(`/contacts/${contact.id}`)}
                  className={cn("border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors", selectedIds.includes(contact.id) && "bg-primary/5")}>
                  <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="rounded accent-primary" checked={selectedIds.includes(contact.id)} onChange={() => toggleSelect(contact.id)} />
                  </td>
                  {activeColumns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-center" onClick={(col.key === "stage" || col.key === "assigned") ? e => e.stopPropagation() : undefined}>
                      {col.render(contact, helpers)}
                    </td>
                  ))}
                </tr>
              )) : (
                <tr><td colSpan={activeColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                  <p className="text-lg font-medium mb-1">אין לידים</p><p className="text-sm">התחל להוסיף לידים למערכת</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => {
            const sc = filteredContacts?.filter(c => c.stage_id === stage.id) || [];
            return (
              <div key={stage.id} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color || "#6b7280" }} />
                  <span className="text-sm font-medium">{stage.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{sc.length}</span>
                </div>
                <div className="space-y-2">
                  {sc.map(c => (
                    <div key={c.id} onClick={() => navigate(`/contacts/${c.id}`)} className="p-3 bg-card border border-border rounded-lg hover:shadow-md cursor-pointer transition-all">
                      <p className="font-medium text-sm">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{c.email || c.phone || "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <ContactForm onClose={() => { setShowForm(false); searchParams.delete("new"); setSearchParams(searchParams); }} />}
      <BulkActions selectedIds={selectedIds} onClear={() => setSelectedIds([])} totalCount={filteredContacts?.length || 0} />

      {statusPickerId && pickerPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setStatusPickerId(null); setPickerPos(null); }} />
          <div className="fixed bg-card border border-border rounded-xl shadow-xl py-1 w-48 z-50 max-h-80 overflow-y-auto" style={{ top: pickerPos.top, right: pickerPos.right }} dir="rtl">
            {(() => {
              const pickerContact = filteredContacts?.find(c => c.id === statusPickerId);
              const contactPipeline = pickerContact?.stage_id
                ? pipelines?.find(p => p.stages?.some((s: PipelineStage) => s.id === pickerContact.stage_id))
                : null;
              const relevantPipelines = contactPipeline ? [contactPipeline] : [pipelines?.find(p => p.is_default) || pipelines?.[0]].filter(Boolean);
              return relevantPipelines.map(p => (
                <div key={p.id}>
                  {pipelines && pipelines.length > 1 && <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">{p.name}</div>}
                  {p.stages?.map((s: PipelineStage) => (
                    <button key={s.id} onClick={() => { updateContact.mutate({ id: statusPickerId, stage_id: s.id } as any); setStatusPickerId(null); setPickerPos(null); }}
                      className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                        pickerContact?.stage_id === s.id && "bg-secondary/50 font-medium")}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || "#6b7280" }} />{s.name}
                    </button>
                  ))}
                </div>
              ));
            })()}
          </div>
        </>, document.body
      )}

      {/* Assignee picker portal */}
      {assigneePickerId && assigneePickerPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setAssigneePickerId(null); setAssigneePickerPos(null); }} />
          <div className="fixed bg-card border border-border rounded-xl shadow-xl py-1 w-44 z-50" style={{ top: assigneePickerPos.top, right: assigneePickerPos.right }} dir="rtl">
            <button onClick={() => { updateContact.mutate({ id: assigneePickerId, assigned_to: null } as any); setAssigneePickerId(null); setAssigneePickerPos(null); }}
              className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                !filteredContacts?.find(c => c.id === assigneePickerId)?.assigned_to && "bg-secondary/50 font-medium")}>
              ללא שיוך
            </button>
            {members.map(m => (
              <button key={m.id} onClick={() => { updateContact.mutate({ id: assigneePickerId, assigned_to: m.id } as any); setAssigneePickerId(null); setAssigneePickerPos(null); }}
                className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                  filteredContacts?.find(c => c.id === assigneePickerId)?.assigned_to === m.id && "bg-secondary/50 font-medium")}>
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-medium">{m.display_name?.charAt(0)}</div>
                )}
                {m.display_name}
              </button>
            ))}
          </div>
        </>, document.body
      )}
    </div>
  );
}

// ── Sortable column item for picker ──
function SortableColumnItem({ colKey, label, onToggle }: { colKey: string; label: string; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colKey });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-secondary">
      <span {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground shrink-0">
        <GripVertical size={12} />
      </span>
      <label className="flex items-center gap-2 flex-1 cursor-pointer text-sm">
        <input type="checkbox" checked onChange={onToggle} className="rounded accent-primary w-3.5 h-3.5" />
        {label}
      </label>
    </div>
  );
}

// ── Sortable view tab ──
function SortableViewTab({ view, isActive, onLoad, onDelete }: { view: SavedView; isActive: boolean; onLoad: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: view.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-0.5 shrink-0 group">
      <span {...attributes} {...listeners} className="cursor-grab text-muted-foreground/30 hover:text-muted-foreground p-0.5">
        <GripVertical size={10} />
      </span>
      <button onClick={onLoad}
        className={cn("px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors",
          isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>
        {view.name}
      </button>
      <button onClick={onDelete}
        className="p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" title="מחק תצוגה">
        <Trash2 size={10} />
      </button>
    </div>
  );
}

// ── Smart filter value input — dropdown for known fields, text for others ──
function FilterValueInput({ field, value, onChange, members, stages, pipelines }: {
  field: string; value: string; onChange: (v: string) => void;
  members: { id: string; display_name: string }[];
  stages: PipelineStage[];
  pipelines: any[] | undefined;
}) {
  if (field === "assigned_to") {
    return (
      <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="בחר אחראי" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">בחר...</SelectItem>
          <SelectItem value="__me__">אני (דינמי)</SelectItem>
          {members.map(m => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field === "stage_id") {
    return (
      <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="בחר שלב" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">בחר...</SelectItem>
          {pipelines?.map(p => p.stages?.map((s: PipelineStage) => (
            <SelectItem key={s.id} value={s.id}>{pipelines.length > 1 ? `${p.name} — ${s.name}` : s.name}</SelectItem>
          )))}
        </SelectContent>
      </Select>
    );
  }
  if (field === "source") {
    return (
      <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="בחר מקור" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">בחר...</SelectItem>
          {CONTACT_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field === "entry_type") {
    return (
      <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="בחר סוג" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">בחר...</SelectItem>
          <SelectItem value="vsl">VSL</SelectItem>
          <SelectItem value="webinar">וובינר</SelectItem>
          <SelectItem value="organic">אורגני</SelectItem>
          <SelectItem value="direct">ישיר</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (field === "ad_platform") {
    return (
      <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="בחר פלטפורמה" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">בחר...</SelectItem>
          <SelectItem value="facebook">פייסבוק</SelectItem>
          <SelectItem value="instagram">אינסטגרם</SelectItem>
          <SelectItem value="google">גוגל</SelectItem>
          <SelectItem value="youtube">יוטיוב</SelectItem>
          <SelectItem value="organic">אורגני</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  // Default: free text input
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder="ערך..." className="flex-1 px-2 py-1 text-xs border border-input rounded-lg bg-background outline-none" />
  );
}

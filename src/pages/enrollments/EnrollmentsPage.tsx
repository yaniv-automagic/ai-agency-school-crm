import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, GraduationCap, SlidersHorizontal, X, Columns3,
  Trash2, GripVertical,
} from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments, useCreateEnrollment } from "@/hooks/useEnrollments";
import { useContacts } from "@/hooks/useContacts";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { ENROLLMENT_STATUSES } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { useUserPreference } from "@/hooks/useUserPreferences";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import type { ProgramEnrollment, EnrollmentStatus } from "@/types/crm";

// ── Column definitions ──
interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  render: (enrollment: ProgramEnrollment) => React.ReactNode;
}

const ALL_COLUMNS: ColumnDef[] = [
  {
    key: "name", label: "שם התלמיד", defaultVisible: true,
    render: (e) => <span className="font-medium">{e.contact?.first_name} {e.contact?.last_name}</span>,
  },
  {
    key: "product", label: "מוצר / תכנית", defaultVisible: true,
    render: (e) => <span className="text-muted-foreground">{e.product?.name || "—"}</span>,
  },
  {
    key: "status", label: "סטטוס", defaultVisible: true,
    render: (e) => {
      const s = ENROLLMENT_STATUSES.find(st => st.value === e.status);
      return (
        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", s?.color)}>
          {s?.label}
        </span>
      );
    },
  },
  {
    key: "progress", label: "התקדמות", defaultVisible: true,
    render: (e) => {
      const pct = e.total_sessions > 0 ? Math.round((e.completed_sessions / e.total_sessions) * 100) : 0;
      return (
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{e.completed_sessions}/{e.total_sessions}</span>
        </div>
      );
    },
  },
  {
    key: "mentor", label: "מנטור", defaultVisible: true,
    render: (e) => <span className="text-muted-foreground text-xs">{e.mentor_name || "—"}</span>,
  },
  {
    key: "assigned", label: "אחראי", defaultVisible: true,
    render: (e) => (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
        {e.assigned_member ? (
          <>
            {e.assigned_member.avatar_url ? (
              <img src={e.assigned_member.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">{e.assigned_member.display_name?.charAt(0)}</div>
            )}
            {e.assigned_member.display_name}
          </>
        ) : "לא משויך"}
      </span>
    ),
  },
  {
    key: "start_date", label: "תאריך התחלה", defaultVisible: true,
    render: (e) => <span className="text-muted-foreground text-xs">{e.start_date ? new Date(e.start_date).toLocaleDateString("he-IL") : "—"}</span>,
  },
  {
    key: "end_date", label: "תאריך סיום", defaultVisible: false,
    render: (e) => <span className="text-muted-foreground text-xs">{e.end_date ? new Date(e.end_date).toLocaleDateString("he-IL") : "—"}</span>,
  },
  {
    key: "email", label: "מייל", defaultVisible: false,
    render: (e) => <span className="text-muted-foreground text-xs">{e.contact?.email || "—"}</span>,
  },
  {
    key: "phone", label: "טלפון", defaultVisible: false,
    render: (e) => <span className="text-muted-foreground text-xs" dir="ltr">{e.contact?.phone || "—"}</span>,
  },
  {
    key: "portal", label: "גישה לפורטל", defaultVisible: false,
    render: (e) => (
      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", e.portal_access_granted ? "bg-green-100 text-green-700" : "bg-secondary text-muted-foreground")}>
        {e.portal_access_granted ? "כן" : "לא"}
      </span>
    ),
  },
  {
    key: "created", label: "נוצר", defaultVisible: false,
    render: (e) => <span className="text-muted-foreground text-xs">{formatDateTime(e.created_at)}</span>,
  },
  {
    key: "notes", label: "הערות", defaultVisible: false,
    render: (e) => <span className="text-muted-foreground text-xs truncate max-w-[150px] block mx-auto">{e.notes || "—"}</span>,
  },
];

// ── Filter types ──
type FilterLogic = "and" | "or";
interface FilterCondition { id: string; field: string; operator: string; value: string; }
interface FilterGroup { id: string; logic: FilterLogic; conditions: FilterCondition[]; }
interface SavedView { id: string; name: string; columns: string[]; filterGroups: FilterGroup[]; statusFilter?: string; assigneeFilter?: string; }

const FILTER_FIELDS = [
  { key: "contact_name", label: "שם תלמיד" },
  { key: "product_name", label: "מוצר" },
  { key: "mentor_name", label: "מנטור" },
  { key: "assigned_to", label: "אחראי" },
  { key: "status", label: "סטטוס" },
  { key: "notes", label: "הערות" },
];
const FILTER_OPS = [
  { key: "contains", label: "מכיל" }, { key: "eq", label: "שווה" },
  { key: "neq", label: "שונה" }, { key: "not_contains", label: "לא מכיל" },
  { key: "is_empty", label: "ריק" }, { key: "is_not_empty", label: "לא ריק" },
];

const DEFAULT_COLS = ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);

function getEnrollmentFieldValue(e: ProgramEnrollment, field: string): string {
  switch (field) {
    case "contact_name": return `${e.contact?.first_name || ""} ${e.contact?.last_name || ""}`.toLowerCase();
    case "product_name": return (e.product?.name || "").toLowerCase();
    case "mentor_name": return (e.mentor_name || "").toLowerCase();
    case "assigned_to": return (e.assigned_to || "").toLowerCase();
    case "status": return (e.status || "").toLowerCase();
    case "notes": return (e.notes || "").toLowerCase();
    default: return "";
  }
}

function matchCondition(e: ProgramEnrollment, cond: FilterCondition, meId?: string): boolean {
  const val = getEnrollmentFieldValue(e, cond.field);
  const target = (cond.value === "__me__" && meId) ? meId.toLowerCase() : cond.value.toLowerCase();
  switch (cond.operator) {
    case "eq": return val === target;
    case "neq": return val !== target;
    case "contains": return val.includes(target);
    case "not_contains": return !val.includes(target);
    case "is_empty": return !val || val === "null" || val.trim() === "";
    case "is_not_empty": return !!val && val !== "null" && val.trim() !== "";
    default: return true;
  }
}

export default function EnrollmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("__all__");
  const [showForm, setShowForm] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showNewView, setShowNewView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);

  const [dbColumns, persistColumns] = useUserPreference<string[]>("enrollments-columns", DEFAULT_COLS);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLS);
  const [dbViews, persistDbViews] = useUserPreference<SavedView[]>("enrollments-views", []);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  useEffect(() => { setVisibleColumns(dbColumns); }, [dbColumns]);
  useEffect(() => { setSavedViews(dbViews); }, [dbViews]);

  const navigate = useNavigate();
  const confirmDialog = useConfirm();
  const { teamMember } = useAuth();
  const { members } = useTeamMembers();

  const statusParam = statusFilter !== "__all__" ? statusFilter as EnrollmentStatus : undefined;
  const { data: enrollments, isLoading } = useEnrollments(statusParam ? { status: statusParam } : undefined);

  // ── Search + filtering ──
  const totalConditions = filterGroups.reduce((n, g) => n + g.conditions.length, 0);
  const filteredEnrollments = useMemo(() => {
    if (!enrollments) return enrollments;
    let result = enrollments;

    // Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e =>
        `${e.contact?.first_name} ${e.contact?.last_name}`.toLowerCase().includes(s) ||
        (e.product?.name || "").toLowerCase().includes(s) ||
        (e.mentor_name || "").toLowerCase().includes(s) ||
        (e.contact?.email || "").toLowerCase().includes(s) ||
        (e.contact?.phone || "").includes(s)
      );
    }

    // Assignee quick filter
    if (assigneeFilter !== "__all__") {
      const assigneeId = assigneeFilter === "__me__" ? teamMember?.id : assigneeFilter;
      result = result.filter(e => e.assigned_to === assigneeId);
    }

    // Compound filter groups
    if (filterGroups.length > 0) {
      const meId = teamMember?.id;
      result = result.filter(e =>
        filterGroups.every(group => {
          if (group.conditions.length === 0) return true;
          return group.logic === "and"
            ? group.conditions.every(cond => matchCondition(e, cond, meId))
            : group.conditions.some(cond => matchCondition(e, cond, meId));
        })
      );
    }

    return result;
  }, [enrollments, search, assigneeFilter, filterGroups, teamMember?.id]);

  // ── Columns ──
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const updateColumns = (cols: string[]) => { setVisibleColumns(cols); persistColumns(cols); };
  const toggleColumn = (key: string) => updateColumns(visibleColumns.includes(key) ? visibleColumns.filter(k => k !== key) : [...visibleColumns, key]);
  const handleColumnDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIdx = visibleColumns.indexOf(active.id as string);
      const newIdx = visibleColumns.indexOf(over.id as string);
      updateColumns(arrayMove(visibleColumns, oldIdx, newIdx));
    }
  };
  const activeColumns = visibleColumns.map(k => ALL_COLUMNS.find(c => c.key === k)!).filter(Boolean);

  // ── Filter groups ──
  const addGroup = () => setFilterGroups(prev => [...prev, { id: `g-${Date.now()}`, logic: "and", conditions: [{ id: `c-${Date.now()}`, field: "contact_name", operator: "contains", value: "" }] }]);
  const removeGroup = (gid: string) => setFilterGroups(prev => prev.filter(g => g.id !== gid));
  const toggleGroupLogic = (gid: string) => setFilterGroups(prev => prev.map(g => g.id === gid ? { ...g, logic: g.logic === "and" ? "or" : "and" } : g));
  const addCondition = (gid: string) => setFilterGroups(prev => prev.map(g => g.id === gid ? { ...g, conditions: [...g.conditions, { id: `c-${Date.now()}`, field: "contact_name", operator: "contains", value: "" }] } : g));
  const removeCondition = (gid: string, cid: string) => setFilterGroups(prev => prev.map(g => g.id === gid ? { ...g, conditions: g.conditions.filter(c => c.id !== cid) } : g).filter(g => g.conditions.length > 0));
  const updateCondition = (gid: string, cid: string, updates: Partial<FilterCondition>) => setFilterGroups(prev => prev.map(g => g.id === gid ? { ...g, conditions: g.conditions.map(c => c.id === cid ? { ...c, ...updates } : c) } : g));

  // ── Views ──
  const updateViews = (views: SavedView[]) => { setSavedViews(views); persistDbViews(views); };
  const saveCurrentView = () => {
    if (!newViewName.trim()) return;
    const view: SavedView = { id: `v-${Date.now()}`, name: newViewName.trim(), columns: visibleColumns, filterGroups, statusFilter, assigneeFilter };
    updateViews([...savedViews, view]);
    setActiveViewId(view.id);
    setNewViewName(""); setShowNewView(false);
  };
  const loadView = (view: SavedView) => {
    updateColumns(view.columns);
    setFilterGroups(view.filterGroups || []);
    if (view.statusFilter) setStatusFilter(view.statusFilter);
    setAssigneeFilter(view.assigneeFilter || "__all__");
    setActiveViewId(view.id);
  };
  const deleteView = async (id: string) => {
    const ok = await confirmDialog({ title: "מחיקת תצוגה", description: "למחוק את התצוגה?", confirmText: "מחק", cancelText: "ביטול", variant: "destructive" });
    if (!ok) return;
    updateViews(savedViews.filter(v => v.id !== id));
    if (activeViewId === id) setActiveViewId(null);
  };
  const handleViewDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIdx = savedViews.findIndex(v => v.id === active.id);
      const newIdx = savedViews.findIndex(v => v.id === over.id);
      updateViews(arrayMove(savedViews, oldIdx, newIdx));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">תלמידים</h1>
          <p className="text-muted-foreground text-sm">{filteredEnrollments?.length || 0} הרשמות</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors">
          <Plus size={16} /> הרשמה חדשה
        </button>
      </div>

      {/* Views bar */}
      <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto">
        <button onClick={() => { setActiveViewId(null); updateColumns(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)); setFilterGroups([]); setStatusFilter("__all__"); setAssigneeFilter("__all__"); }}
          className={cn("px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors shrink-0",
            !activeViewId ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>
          כל התלמידים
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
                statusFilter !== "__all__" && "סטטוס",
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
          <input type="text" placeholder="חיפוש תלמיד, מוצר, מנטור..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-auto px-3 py-2 text-sm border border-input rounded-lg bg-background"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">כל הסטטוסים</SelectItem>
            {ENROLLMENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-auto px-3 py-2 text-sm border border-input rounded-lg bg-background"><SelectValue placeholder="אחראי" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">כל האחראים</SelectItem>
            <SelectItem value="__me__">התלמידים שלי</SelectItem>
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
      </div>

      {/* Filters panel */}
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
                  <Select value={cond.field} onValueChange={v => updateCondition(group.id, cond.id, { field: v, value: "" })}>
                    <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{FILTER_FIELDS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={cond.operator} onValueChange={v => updateCondition(group.id, cond.id, { operator: v })}>
                    <SelectTrigger className="w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{FILTER_OPS.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {!["is_empty", "is_not_empty"].includes(cond.operator) && (
                    cond.field === "assigned_to" ? (
                      <Select value={cond.value || "__none__"} onValueChange={v => updateCondition(group.id, cond.id, { value: v === "__none__" ? "" : v })}>
                        <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="בחר אחראי" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">בחר...</SelectItem>
                          <SelectItem value="__me__">אני (דינמי)</SelectItem>
                          {members.map(m => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : cond.field === "status" ? (
                      <Select value={cond.value || "__none__"} onValueChange={v => updateCondition(group.id, cond.id, { value: v === "__none__" ? "" : v })}>
                        <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="בחר סטטוס" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">בחר...</SelectItem>
                          {ENROLLMENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <input value={cond.value} onChange={e => updateCondition(group.id, cond.id, { value: e.target.value })}
                        placeholder="ערך..." className="flex-1 px-2 py-1 text-xs border border-input rounded-lg bg-background outline-none" />
                    )
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
      ) : (
        <div className="border border-border rounded-xl bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {activeColumns.map(col => <th key={col.key} className="px-4 py-3 font-medium text-muted-foreground text-center text-xs">{col.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredEnrollments && filteredEnrollments.length > 0 ? filteredEnrollments.map(enrollment => (
                <tr key={enrollment.id} onClick={() => navigate(`/enrollments/${enrollment.id}`)}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                  {activeColumns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-center">
                      {col.render(enrollment)}
                    </td>
                  ))}
                </tr>
              )) : (
                <tr><td colSpan={activeColumns.length} className="px-4 py-16 text-center text-muted-foreground">
                  <GraduationCap size={48} className="text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-1">אין הרשמות</p><p className="text-sm">צור הרשמה חדשה כדי להתחיל</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Enrollment Form */}
      {showForm && <EnrollmentForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ── Enrollment Form Slide-over ──
function EnrollmentForm({ onClose }: { onClose: () => void }) {
  const createEnrollment = useCreateEnrollment();
  const { data: contacts } = useContacts();
  const { members } = useTeamMembers();

  const [formData, setFormData] = useState({
    contact_id: "",
    product_id: "",
    total_sessions: 12,
    mentor_name: "",
    assigned_to: "",
    start_date: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact_id || !formData.product_id) return;
    await createEnrollment.mutateAsync({
      contact_id: formData.contact_id,
      product_id: formData.product_id,
      status: "pending",
      total_sessions: formData.total_sessions,
      completed_sessions: 0,
      mentor_name: formData.mentor_name || null,
      assigned_to: formData.assigned_to || null,
      start_date: formData.start_date || null,
      notes: formData.notes || null,
    });
    onClose();
  };

  const inputClass =
    "w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="fixed inset-y-0 left-0 w-full max-w-lg bg-card shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">הרשמה חדשה</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <Plus size={20} className="rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">ליד *</label>
            <Select
              value={formData.contact_id || "__all__"}
              onValueChange={(val) => setFormData((p) => ({ ...p, contact_id: val === "__all__" ? "" : val }))}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="בחר ליד" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">בחר ליד</SelectItem>
                {contacts?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">מוצר / תכנית *</label>
            <input
              value={formData.product_id}
              onChange={(e) => setFormData((p) => ({ ...p, product_id: e.target.value }))}
              className={inputClass}
              placeholder="מזהה מוצר"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">סה״כ מפגשים</label>
              <input
                type="number"
                value={formData.total_sessions}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, total_sessions: parseInt(e.target.value) || 0 }))
                }
                className={inputClass}
                min={0}
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">תאריך התחלה</label>
              <DatePicker
                value={formData.start_date}
                onChange={(v) => setFormData((p) => ({ ...p, start_date: v }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">מנטור</label>
              <input
                value={formData.mentor_name}
                onChange={(e) => setFormData((p) => ({ ...p, mentor_name: e.target.value }))}
                className={inputClass}
                placeholder="שם המנטור"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">אחראי</label>
              <Select
                value={formData.assigned_to || "__all__"}
                onValueChange={(val) => setFormData((p) => ({ ...p, assigned_to: val === "__all__" ? "" : val }))}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="ללא שיוך" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">ללא שיוך</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">הערות</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              className={cn(inputClass, "resize-none")}
              placeholder="הערות..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={createEnrollment.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createEnrollment.isPending ? "שומר..." : "צור הרשמה"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
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

import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Plus, X, Calendar, Ban, CheckCircle2, Search, Check, ChevronsUpDown, Pencil, Link, BarChart3, Trash2, Users } from "lucide-react";
import { useMeetings, useMeetingStats, useCreateMeeting, useUpdateMeeting, useDeleteMeetings } from "@/hooks/useMeetings";
import { useContacts } from "@/hooks/useContacts";
import { useEnrollments } from "@/hooks/useEnrollments";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { MEETING_TYPES, MEETING_STATUSES, CONTACT_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { MeetingType, MeetingStatus, Meeting } from "@/types/crm";

const TABS = [
  { value: "", label: "הכל" },
  { value: "sales_consultation", label: "שיחות מכירה" },
  { value: "mentoring_1on1", label: "ליווי אישי" },
] as const;

// ── Picker portal helper ──

type PickerState = { id: string; field: string; top: number; right: number } | null;

function openPicker(
  current: PickerState,
  meetingId: string,
  field: string,
  e: React.MouseEvent,
  setPicker: (p: PickerState) => void
) {
  e.stopPropagation();
  if (current?.id === meetingId && current?.field === field) { setPicker(null); return; }
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  setPicker({ id: meetingId, field, top: rect.bottom + 4, right: window.innerWidth - rect.right });
}

// ── Main Page ──

export default function MeetingsPage() {
  const [activeTab, setActiveTab] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("__all__");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const navigate = useNavigate();

  const { members } = useTeamMembers();
  const { teamMember } = useAuth();
  const updateMeeting = useUpdateMeeting();
  const deleteMeetings = useDeleteMeetings();
  const confirmDialog = useConfirm();
  const [picker, setPicker] = useState<PickerState>(null);

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => { if (!filteredMeetings) return; setSelectedIds(prev => prev.length === filteredMeetings.length ? [] : filteredMeetings.map(m => m.id)); };

  // Build filters for the hook
  const hookFilters = useMemo(() => {
    const f: Record<string, any> = {};
    if (activeTab) f.meeting_type = activeTab;
    if (statusFilter !== "__all__") f.status = statusFilter;
    if (assigneeFilter !== "__all__") f.assigned_to = assigneeFilter;
    if (search.trim()) f.search = search.trim();
    return Object.keys(f).length > 0 ? f : undefined;
  }, [activeTab, statusFilter, assigneeFilter, search]);

  const { data: meetings, isLoading } = useMeetings(hookFilters);
  const { data: stats } = useMeetingStats(activeTab ? activeTab as MeetingType : undefined);

  // Client-side filter for contact name
  const filteredMeetings = useMemo(() => {
    if (!meetings) return meetings;
    if (!search.trim()) return meetings;
    const q = search.trim().toLowerCase();
    return meetings.filter(
      (m) =>
        m.title?.toLowerCase().includes(q) ||
        m.contact?.first_name?.toLowerCase().includes(q) ||
        m.contact?.last_name?.toLowerCase().includes(q) ||
        m.contact?.phone?.includes(q)
    );
  }, [meetings, search]);

  const handleQuickUpdate = (meetingId: string, updates: Partial<Meeting>) => {
    updateMeeting.mutate({ id: meetingId, ...updates, _tenantId: teamMember?.tenant_id } as any);
    setPicker(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">פגישות</h1>
          <p className="text-muted-foreground text-sm">
            {filteredMeetings?.length || 0} פגישות
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          פגישה חדשה
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar size={14} />
              <span className="text-xs">פגישות שנקבעו</span>
            </div>
            <p className="text-2xl font-bold">{stats.scheduled}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Ban size={14} />
              <span className="text-xs">פגישות שבוטלו</span>
            </div>
            <p className="text-2xl font-bold">{stats.cancelled}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 size={14} />
              <span className="text-xs">פגישות שהתבצעו</span>
            </div>
            <p className="text-2xl font-bold">{stats.completed}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 size={14} />
              <span className="text-xs">אחוזי הגעה</span>
            </div>
            <p className="text-2xl font-bold">{stats.showRate}%</p>
          </div>
        </div>
      )}

      {/* Search & Filters Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="חיפוש לפי כותרת, שם ליד, טלפון..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-auto px-3 py-2 text-sm border border-input rounded-lg bg-background">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">כל הסטטוסים</SelectItem>
            {MEETING_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-auto px-3 py-2 text-sm border border-input rounded-lg bg-background">
            <SelectValue placeholder="אחראי" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">כל האחראים</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(search || statusFilter !== "__all__" || assigneeFilter !== "__all__") && (
          <button
            onClick={() => { setSearch(""); setStatusFilter("__all__"); setAssigneeFilter("__all__"); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            נקה סינון
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-3 text-center">
                  <input type="checkbox" className="rounded accent-primary" checked={filteredMeetings?.length ? selectedIds.length === filteredMeetings.length : false} onChange={toggleAll} />
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">כותרת</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">תאריך</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">אחראי</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">סוג</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">ליד / תלמיד</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">סטטוס</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredMeetings && filteredMeetings.length > 0 ? (
                filteredMeetings.map((meeting) => {
                  const status = MEETING_STATUSES.find((s) => s.value === meeting.status);
                  const type = MEETING_TYPES.find((t) => t.value === meeting.meeting_type);

                  return (
                    <tr
                      key={meeting.id}
                      onClick={() => navigate(`/meetings/${meeting.id}`)}
                      className={cn("border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors", selectedIds.includes(meeting.id) && "bg-primary/5")}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="rounded accent-primary" checked={selectedIds.includes(meeting.id)} onChange={() => toggleSelect(meeting.id)} />
                      </td>
                      {/* כותרת */}
                      <td className="px-4 py-3 font-medium">{meeting.title}</td>

                      {/* תאריך */}
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(meeting.scheduled_at).toLocaleDateString("he-IL", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* אחראי - quick edit */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => openPicker(picker, meeting.id, "assignee", e, setPicker)}
                          className="flex items-center gap-2 text-sm hover:bg-secondary px-2 py-0.5 rounded transition-colors"
                        >
                          {meeting.assigned_member ? (
                            <>
                              {meeting.assigned_member.avatar_url ? (
                                <img src={meeting.assigned_member.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-medium shrink-0">
                                  {meeting.assigned_member.display_name?.charAt(0)}
                                </span>
                              )}
                              <span>{meeting.assigned_member.display_name}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </button>
                      </td>

                      {/* סוג - quick edit */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => openPicker(picker, meeting.id, "type", e, setPicker)}
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary cursor-pointer hover:opacity-80 transition-opacity",
                            type?.color
                          )}
                        >
                          {type?.label}
                        </button>
                      </td>

                      {/* ליד / תלמיד */}
                      <td className="px-4 py-3">
                        <span className="text-sm">
                          {meeting.contact?.first_name} {meeting.contact?.last_name}
                        </span>
                      </td>

                      {/* סטטוס - quick edit */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => openPicker(picker, meeting.id, "status", e, setPicker)}
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                            status?.color
                          )}
                        >
                          {status?.label}
                        </button>
                      </td>

                      {/* Edit */}
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMeeting(meeting);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="ערוך פגישה"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    <p className="text-lg font-medium mb-1">אין פגישות</p>
                    <p className="text-sm">צור פגישה חדשה כדי להתחיל</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick-edit Picker Portal */}
      {picker && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} />
          <div
            className="fixed bg-card border border-border rounded-xl shadow-xl py-1 w-48 z-50 max-h-80 overflow-y-auto"
            style={{ top: picker.top, right: picker.right }}
            dir="rtl"
          >
            {picker.field === "status" && MEETING_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => handleQuickUpdate(picker.id, { status: s.value as MeetingStatus })}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                  filteredMeetings?.find((m) => m.id === picker.id)?.status === s.value && "bg-secondary/50 font-medium"
                )}
              >
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", s.color)}>
                  {s.label}
                </span>
              </button>
            ))}
            {picker.field === "type" && MEETING_TYPES.filter(t => t.value !== "mastermind_group").map((t) => (
              <button
                key={t.value}
                onClick={() => handleQuickUpdate(picker.id, { meeting_type: t.value as MeetingType })}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                  filteredMeetings?.find((m) => m.id === picker.id)?.meeting_type === t.value && "bg-secondary/50 font-medium"
                )}
              >
                <span className={cn("text-xs", t.color)}>{t.label}</span>
              </button>
            ))}
            {picker.field === "assignee" && (
              <>
                <button
                  onClick={() => handleQuickUpdate(picker.id, { assigned_to: null } as any)}
                  className="w-full px-3 py-2 text-sm hover:bg-secondary text-right text-muted-foreground"
                >
                  ללא שיוך
                </button>
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleQuickUpdate(picker.id, { assigned_to: m.id })}
                    className={cn(
                      "w-full px-3 py-2 text-sm hover:bg-secondary text-right",
                      filteredMeetings?.find((mt) => mt.id === picker.id)?.assigned_to === m.id && "bg-secondary/50 font-medium"
                    )}
                  >
                    {m.display_name}
                  </button>
                ))}
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {/* Create/Edit Meeting Slide-over Form */}
      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-2xl shadow-2xl">
            <div className="flex items-center gap-2 pr-3 border-r border-white/20">
              <Users size={15} />
              <span className="text-sm font-semibold">{selectedIds.length}</span>
              <span className="text-xs text-white/60">נבחרו</span>
            </div>

            {/* Change status */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-white/10 transition-colors">
                <CheckCircle2 size={13} />
                שנה סטטוס
              </button>
              <div className="absolute bottom-full mb-2 right-0 bg-white text-gray-900 rounded-xl shadow-xl border border-gray-200 py-1 w-40 hidden group-hover:block" dir="rtl">
                {MEETING_STATUSES.map(s => (
                  <button key={s.value} onClick={async () => {
                    for (const id of selectedIds) {
                      await updateMeeting.mutateAsync({ id, status: s.value as MeetingStatus, _tenantId: teamMember?.tenant_id } as any);
                    }
                    setSelectedIds([]);
                  }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-right">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", s.color)}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Delete */}
            <button
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "מחיקת פגישות",
                  description: `למחוק ${selectedIds.length} פגישות? פעולה זו לא ניתנת לביטול.`,
                  confirmText: "מחק",
                  cancelText: "ביטול",
                  variant: "destructive",
                });
                if (!ok) return;
                await deleteMeetings.mutateAsync(selectedIds);
                toast.success(`${selectedIds.length} פגישות נמחקו`);
                setSelectedIds([]);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-red-500/20 text-red-300 transition-colors"
            >
              <Trash2 size={13} />
              מחק
            </button>

            <button onClick={() => setSelectedIds([])} className="p-1.5 rounded-full hover:bg-white/10 transition-colors mr-1">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {showForm && <MeetingForm onClose={() => { setShowForm(false); setEditingMeeting(null); }} editMeeting={editingMeeting} />}
    </div>
  );
}

// ── Searchable Contact Picker ──

type PickerEntry = { contact_id: string; key: string; name: string; email: string | null; label: string };

function ContactPicker({
  value,
  onChange,
  contacts,
  enrollments,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  contacts: { id: string; first_name: string; last_name: string; email: string | null; status: string }[] | undefined;
  enrollments: { id: string; contact_id: string; contact?: { first_name: string; last_name: string; email: string | null } | null; product?: { name: string } | null }[] | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Build unified list: all contacts as leads + all enrollments as students
  const entries = useMemo<PickerEntry[]>(() => {
    const result: PickerEntry[] = [];
    const enrolledContactIds = new Set<string>();

    // Add students from enrollments first
    if (enrollments) {
      for (const e of enrollments) {
        if (!e.contact) continue;
        enrolledContactIds.add(e.contact_id);
        result.push({
          contact_id: e.contact_id,
          key: `enroll-${e.id}`,
          name: `${e.contact.first_name} ${e.contact.last_name}`,
          email: e.contact.email,
          label: "תלמיד",
        });
      }
    }

    // Add all contacts as leads (even if also enrolled, so user can pick either)
    if (contacts) {
      for (const c of contacts) {
        result.push({
          contact_id: c.id,
          key: `contact-${c.id}`,
          name: `${c.first_name} ${c.last_name}`,
          email: c.email,
          label: "ליד",
        });
      }
    }

    return result;
  }, [contacts, enrollments]);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) => e.name.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q)
    );
  }, [entries, search]);

  const selected = entries.find((e) => e.contact_id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm text-right ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-2">
            {selected
              ? <>{selected.name} <span className="text-xs text-muted-foreground">({selected.label})</span></>
              : "בחר ליד / תלמיד"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2 border-b border-border">
          <div className="flex items-center gap-2 px-2">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש..."
              className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">לא נמצאו תוצאות</p>
          ) : (
            filtered.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => {
                  onChange(entry.contact_id);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-right hover:bg-accent transition-colors",
                  value === entry.contact_id && "bg-accent"
                )}
              >
                <Check size={14} className={cn("shrink-0", value === entry.contact_id ? "opacity-100" : "opacity-0")} />
                <div className="flex-1 text-right">
                  <span className="font-medium">{entry.name}</span>
                  <span className="inline-flex items-center mr-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                    {entry.label}
                  </span>
                  {entry.email && <span className="text-muted-foreground text-xs mr-1">({entry.email})</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Meeting Form Slide-over ──

function MeetingForm({ onClose, editMeeting }: { onClose: () => void; editMeeting?: Meeting | null }) {
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const { data: contacts } = useContacts();
  const { data: enrollments } = useEnrollments();
  const { members } = useTeamMembers();
  const { teamMember } = useAuth();
  const isEditing = !!editMeeting;

  const [isVirtual, setIsVirtual] = useState(!!editMeeting?.meeting_url);
  const [linkMode, setLinkMode] = useState<"auto" | "manual">(editMeeting?.meeting_url ? "manual" : "auto");

  const [formData, setFormData] = useState({
    contact_id: editMeeting?.contact_id || "",
    meeting_type: (editMeeting?.meeting_type || "sales_consultation") as MeetingType,
    title: editMeeting?.title || "",
    scheduled_at: editMeeting?.scheduled_at ? new Date(editMeeting.scheduled_at).toISOString().slice(0, 16) : "",
    duration_minutes: editMeeting?.duration_minutes || 60,
    meeting_url: editMeeting?.meeting_url || "",
    location: (editMeeting as any)?.location || "",
    description: editMeeting?.description || "",
    assigned_to: editMeeting?.assigned_to || teamMember?.id || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact_id || !formData.title || !formData.scheduled_at) return;

    let meetingUrl: string | null = null;
    if (isVirtual) {
      if (linkMode === "manual") {
        meetingUrl = formData.meeting_url || null;
      } else {
        meetingUrl = "auto_generate";
      }
    }

    const payload = {
      contact_id: formData.contact_id,
      meeting_type: formData.meeting_type,
      title: formData.title,
      scheduled_at: new Date(formData.scheduled_at).toISOString(),
      duration_minutes: formData.duration_minutes,
      meeting_url: meetingUrl,
      location: !isVirtual ? (formData.location || null) : null,
      description: formData.description || null,
      assigned_to: formData.assigned_to || null,
    };

    if (isEditing) {
      await updateMeeting.mutateAsync({ id: editMeeting.id, ...payload, _tenantId: teamMember?.tenant_id } as any);
    } else {
      await createMeeting.mutateAsync({ ...payload, status: "scheduled", _tenantId: teamMember?.tenant_id, _performedBy: teamMember?.id } as any);
    }
    onClose();
  };

  const isPending = createMeeting.isPending || updateMeeting.isPending;

  const inputClass =
    "w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="fixed inset-y-0 left-0 w-full max-w-lg bg-card shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">{isEditing ? "עריכת פגישה" : "פגישה חדשה"}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Contact */}
          <div>
            <label className="text-sm font-medium mb-1 block">ליד / תלמיד *</label>
            <ContactPicker
              value={formData.contact_id}
              onChange={(id) => setFormData((p) => ({ ...p, contact_id: id }))}
              contacts={contacts}
              enrollments={enrollments}
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-medium mb-1 block">סוג פגישה *</label>
            <Select
              value={formData.meeting_type}
              onValueChange={(val) => setFormData((p) => ({ ...p, meeting_type: val as MeetingType }))}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="בחר סוג פגישה" />
              </SelectTrigger>
              <SelectContent>
                {MEETING_TYPES.filter(t => t.value !== "mastermind_group").map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1 block">כותרת *</label>
            <input
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              className={inputClass}
              placeholder="כותרת הפגישה"
              required
            />
          </div>

          {/* Date & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">תאריך ושעה *</label>
              <DateTimePicker
                value={formData.scheduled_at}
                onChange={(v) => setFormData((p) => ({ ...p, scheduled_at: v }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">משך</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={formData.duration_minutes >= 60 && formData.duration_minutes % 60 === 0
                    ? formData.duration_minutes / 60
                    : formData.duration_minutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    const unit = formData.duration_minutes >= 60 && formData.duration_minutes % 60 === 0 ? "hours" : "minutes";
                    setFormData((p) => ({ ...p, duration_minutes: unit === "hours" ? val * 60 : val }));
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  dir="ltr"
                />
                <Select
                  value={formData.duration_minutes >= 60 && formData.duration_minutes % 60 === 0 ? "hours" : "minutes"}
                  onValueChange={unit => {
                    const current = formData.duration_minutes >= 60 && formData.duration_minutes % 60 === 0
                      ? formData.duration_minutes / 60
                      : formData.duration_minutes;
                    setFormData((p) => ({ ...p, duration_minutes: unit === "hours" ? current * 60 : current }));
                  }}
                >
                  <SelectTrigger className="w-24 px-3 py-2 text-sm border border-input rounded-lg bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">דקות</SelectItem>
                    <SelectItem value="hours">שעות</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Virtual Meeting Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">פגישה וירטואלית</label>
              <Switch
                checked={isVirtual}
                onCheckedChange={(checked) => {
                  setIsVirtual(checked);
                  if (!checked) {
                    setFormData((p) => ({ ...p, meeting_url: "" }));
                  }
                }}
              />
            </div>

            {isVirtual && (
              <div className="space-y-3 pr-1">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="linkMode"
                      checked={linkMode === "auto"}
                      onChange={() => {
                        setLinkMode("auto");
                        setFormData((p) => ({ ...p, meeting_url: "" }));
                      }}
                      className="accent-primary h-4 w-4"
                    />
                    צור לינק אוטומטי
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="linkMode"
                      checked={linkMode === "manual"}
                      onChange={() => setLinkMode("manual")}
                      className="accent-primary h-4 w-4"
                    />
                    לינק ידני
                  </label>
                </div>

                {linkMode === "manual" && (
                  <div className="flex items-center gap-2">
                    <Link size={16} className="text-muted-foreground shrink-0" />
                    <input
                      value={formData.meeting_url}
                      onChange={(e) => setFormData((p) => ({ ...p, meeting_url: e.target.value }))}
                      className={inputClass}
                      placeholder="https://zoom.us/j/..."
                      dir="ltr"
                    />
                  </div>
                )}
              </div>
            )}
            {!isVirtual && (
              <div>
                <label className="text-sm font-medium mb-1 block">מיקום</label>
                <input
                  value={formData.location}
                  onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                  className={inputClass}
                  placeholder="כתובת / שם המקום"
                />
              </div>
            )}
          </div>

          {/* Assigned To */}
          <div>
            <label className="text-sm font-medium mb-1 block">אחראי</label>
            <Select
              value={formData.assigned_to || "__none__"}
              onValueChange={(val) => setFormData((p) => ({ ...p, assigned_to: val === "__none__" ? "" : val }))}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="ללא שיוך" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא שיוך</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1 block">תיאור</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className={cn(inputClass, "resize-none")}
              placeholder="תיאור הפגישה..."
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isPending ? "שומר..." : isEditing ? "שמור שינויים" : "צור פגישה"}
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

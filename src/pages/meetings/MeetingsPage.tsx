import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, Calendar, Video, Users, TrendingUp } from "lucide-react";
import { useMeetings, useMeetingStats, useCreateMeeting } from "@/hooks/useMeetings";
import { useContacts } from "@/hooks/useContacts";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { MEETING_TYPES, MEETING_STATUSES, MEETING_OUTCOMES } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MeetingType } from "@/types/crm";

const TABS = [
  { value: "", label: "הכל" },
  { value: "sales_consultation", label: "שיחות מכירה" },
  { value: "mentoring_1on1", label: "ליווי אישי" },
  { value: "mastermind_group", label: "מאסטרמיינד" },
] as const;

export default function MeetingsPage() {
  const [activeTab, setActiveTab] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const { data: meetings, isLoading } = useMeetings(
    activeTab ? { meeting_type: activeTab as MeetingType } : undefined
  );
  const { data: stats } = useMeetingStats();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">פגישות</h1>
          <p className="text-muted-foreground text-sm">
            {meetings?.length || 0} פגישות
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
              <span className="text-xs">סה״כ פגישות</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Video size={14} />
              <span className="text-xs">מתוזמנות</span>
            </div>
            <p className="text-2xl font-bold">{stats.scheduled}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users size={14} />
              <span className="text-xs">אחוז הגעה</span>
            </div>
            <p className="text-2xl font-bold">{stats.showRate}%</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp size={14} />
              <span className="text-xs">אחוז סגירה</span>
            </div>
            <p className="text-2xl font-bold">{stats.closeRate}%</p>
          </div>
        </div>
      )}

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
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">סטטוס</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">סוג</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">ליד</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">כותרת</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">תאריך</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">תוצאה</th>
              </tr>
            </thead>
            <tbody>
              {meetings && meetings.length > 0 ? (
                meetings.map((meeting) => {
                  const status = MEETING_STATUSES.find((s) => s.value === meeting.status);
                  const type = MEETING_TYPES.find((t) => t.value === meeting.meeting_type);
                  const outcome = meeting.outcome
                    ? MEETING_OUTCOMES.find((o) => o.value === meeting.outcome)
                    : null;

                  return (
                    <tr
                      key={meeting.id}
                      onClick={() => navigate(`/meetings/${meeting.id}`)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                            status?.color
                          )}
                        >
                          {status?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary",
                            type?.color
                          )}
                        >
                          {type?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                            {meeting.contact?.first_name?.charAt(0)}
                            {meeting.contact?.last_name?.charAt(0)}
                          </div>
                          <span className="font-medium">
                            {meeting.contact?.first_name} {meeting.contact?.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{meeting.title}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(meeting.scheduled_at).toLocaleDateString("he-IL", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {outcome ? (
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary",
                              outcome.color
                            )}
                          >
                            {outcome.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                    <p className="text-lg font-medium mb-1">אין פגישות</p>
                    <p className="text-sm">צור פגישה חדשה כדי להתחיל</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Meeting Slide-over Form */}
      {showForm && <MeetingForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ── Meeting Form Slide-over ──

function MeetingForm({ onClose }: { onClose: () => void }) {
  const createMeeting = useCreateMeeting();
  const { data: contacts } = useContacts();
  const { members } = useTeamMembers();

  const [formData, setFormData] = useState({
    contact_id: "",
    meeting_type: "sales_consultation" as MeetingType,
    title: "",
    scheduled_at: "",
    duration_minutes: 60,
    meeting_url: "",
    description: "",
    assigned_to: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact_id || !formData.title || !formData.scheduled_at) return;
    await createMeeting.mutateAsync({
      contact_id: formData.contact_id,
      meeting_type: formData.meeting_type,
      title: formData.title,
      scheduled_at: new Date(formData.scheduled_at).toISOString(),
      duration_minutes: formData.duration_minutes,
      meeting_url: formData.meeting_url || null,
      description: formData.description || null,
      assigned_to: formData.assigned_to || null,
      status: "scheduled",
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
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">פגישה חדשה</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Contact */}
          <div>
            <label className="text-sm font-medium mb-1 block">ליד *</label>
            <Select
              value={formData.contact_id || "__none__"}
              onValueChange={(val) => setFormData((p) => ({ ...p, contact_id: val === "__none__" ? "" : val }))}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="בחר ליד" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">בחר ליד</SelectItem>
                {contacts?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} {c.email ? `(${c.email})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                {MEETING_TYPES.map((t) => (
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
              <label className="text-sm font-medium mb-1 block">משך (דקות)</label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, duration_minutes: parseInt(e.target.value) || 60 }))
                }
                className={inputClass}
                min={5}
                dir="ltr"
              />
            </div>
          </div>

          {/* Meeting URL */}
          <div>
            <label className="text-sm font-medium mb-1 block">קישור לפגישה</label>
            <input
              value={formData.meeting_url}
              onChange={(e) => setFormData((p) => ({ ...p, meeting_url: e.target.value }))}
              className={inputClass}
              placeholder="https://zoom.us/j/..."
              dir="ltr"
            />
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
              disabled={createMeeting.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMeeting.isPending ? "שומר..." : "צור פגישה"}
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

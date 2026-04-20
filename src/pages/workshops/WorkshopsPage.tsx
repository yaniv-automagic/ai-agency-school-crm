import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, BookOpen, Users, Calendar, User } from "lucide-react";
import { useWorkshops, useCreateWorkshop, useCreateSession } from "@/hooks/useWorkshops";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import type { WorkshopStatus } from "@/types/crm";

const STATUS_CONFIG: Record<WorkshopStatus, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "bg-gray-100 text-gray-700" },
  active: { label: "פעילה", color: "bg-green-100 text-green-700" },
  completed: { label: "הושלמה", color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "בוטלה", color: "bg-red-100 text-red-700" },
};

export default function WorkshopsPage() {
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();
  const { data: workshops, isLoading } = useWorkshops();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">סדנאות</h1>
          <p className="text-muted-foreground text-sm">
            {workshops?.length || 0} סדנאות
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          סדנה חדשה
        </button>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : workshops && workshops.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workshops.map((workshop) => {
            const statusCfg = STATUS_CONFIG[workshop.status];
            const sessionsCount = workshop.sessions?.length || 0;
            const participantsCount = workshop.participants?.length || 0;

            return (
              <div
                key={workshop.id}
                onClick={() => navigate(`/workshops/${workshop.id}`)}
                className="bg-card border border-border rounded-xl p-4 hover:shadow-md cursor-pointer transition-all"
              >
                {/* Top: Name + Status */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-base leading-tight line-clamp-1">
                    {workshop.name}
                  </h3>
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 mr-2",
                      statusCfg.color
                    )}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                {/* Description */}
                {workshop.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {workshop.description}
                  </p>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <BookOpen size={13} />
                    {sessionsCount} מפגשים
                  </span>
                  <span className="text-border">|</span>
                  <span className="flex items-center gap-1">
                    <Users size={13} />
                    {participantsCount} תלמידים
                  </span>
                </div>

                {/* Date range */}
                {(workshop.start_date || workshop.end_date) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <Calendar size={13} />
                    <span dir="ltr">
                      {workshop.start_date
                        ? new Date(workshop.start_date).toLocaleDateString("he-IL")
                        : "—"}
                      {" - "}
                      {workshop.end_date
                        ? new Date(workshop.end_date).toLocaleDateString("he-IL")
                        : "—"}
                    </span>
                  </div>
                )}

                {/* Mentor */}
                {workshop.mentor_name && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <User size={13} />
                      מנטור: <span className="font-medium text-foreground">{workshop.mentor_name}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen size={48} className="text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground mb-1">אין סדנאות</p>
          <p className="text-sm text-muted-foreground">צור סדנה חדשה כדי להתחיל</p>
        </div>
      )}

      {/* Create Workshop Slide-over */}
      {showForm && <WorkshopForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ── Workshop Form Slide-over ──

function WorkshopForm({ onClose }: { onClose: () => void }) {
  const createWorkshop = useCreateWorkshop();
  const createSession = useCreateSession();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "draft" as "draft" | "active",
    start_date: "",
    end_date: "",
    max_participants: "",
    meeting_url: "",
    mentor_name: "",
    total_sessions: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const totalSessions = parseInt(formData.total_sessions) || 0;

    const workshop = await createWorkshop.mutateAsync({
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      status: formData.status,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
      meeting_url: formData.meeting_url.trim() || null,
      mentor_name: formData.mentor_name.trim() || null,
      total_sessions: totalSessions,
    });

    // Auto-create session records
    if (totalSessions > 0 && workshop?.id) {
      for (let i = 1; i <= totalSessions; i++) {
        await createSession.mutateAsync({
          workshop_id: workshop.id,
          session_number: i,
          title: `מפגש ${i}`,
          duration_minutes: 60,
          status: "planned",
        });
      }
    }

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
          <h2 className="text-lg font-semibold">סדנה חדשה</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <Plus size={20} className="rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">שם הסדנה *</label>
            <input
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className={inputClass}
              placeholder="שם הסדנה"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">תיאור</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className={cn(inputClass, "resize-none")}
              placeholder="תיאור הסדנה..."
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">סטטוס</label>
            <Select
              value={formData.status}
              onValueChange={(val) => setFormData((p) => ({ ...p, status: val as "draft" | "active" }))}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="בחר סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">טיוטה</SelectItem>
                <SelectItem value="active">פעילה</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">תאריך התחלה</label>
              <DatePicker
                value={formData.start_date}
                onChange={(v) => setFormData((p) => ({ ...p, start_date: v }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">תאריך סיום</label>
              <DatePicker
                value={formData.end_date}
                onChange={(v) => setFormData((p) => ({ ...p, end_date: v }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">מקסימום משתתפים</label>
              <input
                type="number"
                value={formData.max_participants}
                onChange={(e) => setFormData((p) => ({ ...p, max_participants: e.target.value }))}
                className={inputClass}
                min={1}
                dir="ltr"
                placeholder="ללא הגבלה"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">מספר מפגשים</label>
              <input
                type="number"
                value={formData.total_sessions}
                onChange={(e) => setFormData((p) => ({ ...p, total_sessions: e.target.value }))}
                className={inputClass}
                min={0}
                dir="ltr"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">קישור למפגש</label>
            <input
              value={formData.meeting_url}
              onChange={(e) => setFormData((p) => ({ ...p, meeting_url: e.target.value }))}
              className={inputClass}
              placeholder="https://zoom.us/..."
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">מנטור</label>
            <input
              value={formData.mentor_name}
              onChange={(e) => setFormData((p) => ({ ...p, mentor_name: e.target.value }))}
              className={inputClass}
              placeholder="שם המנטור"
            />
          </div>

          {formData.total_sessions && parseInt(formData.total_sessions) > 0 && (
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2">
              ייווצרו {formData.total_sessions} מפגשים באופן אוטומטי
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={createWorkshop.isPending || createSession.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createWorkshop.isPending || createSession.isPending ? "שומר..." : "צור סדנה"}
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

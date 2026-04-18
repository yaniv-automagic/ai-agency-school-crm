import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, GraduationCap } from "lucide-react";
import { useEnrollments, useCreateEnrollment } from "@/hooks/useEnrollments";
import { useContacts } from "@/hooks/useContacts";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { ENROLLMENT_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "@/types/crm";

const STATUS_TABS = [
  { value: "", label: "הכל" },
  ...ENROLLMENT_STATUSES,
] as const;

export default function EnrollmentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const { data: enrollments, isLoading } = useEnrollments(
    statusFilter ? { status: statusFilter as EnrollmentStatus } : undefined
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">תלמידים</h1>
          <p className="text-muted-foreground text-sm">
            {enrollments?.length || 0} הרשמות
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          הרשמה חדשה
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              statusFilter === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : enrollments && enrollments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {enrollments.map((enrollment) => {
            const statusInfo = ENROLLMENT_STATUSES.find((s) => s.value === enrollment.status);
            const progress =
              enrollment.total_sessions > 0
                ? Math.round((enrollment.completed_sessions / enrollment.total_sessions) * 100)
                : 0;

            return (
              <div
                key={enrollment.id}
                onClick={() => navigate(`/enrollments/${enrollment.id}`)}
                className="bg-card border border-border rounded-xl p-4 hover:shadow-md cursor-pointer transition-all"
              >
                {/* Top: Contact + Status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                      {enrollment.contact?.first_name?.charAt(0)}
                      {enrollment.contact?.last_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {enrollment.contact?.first_name} {enrollment.contact?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {enrollment.product?.name || "—"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      statusInfo?.color
                    )}
                  >
                    {statusInfo?.label}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">התקדמות</span>
                    <span className="font-medium">
                      {enrollment.completed_sessions}/{enrollment.total_sessions} מפגשים
                    </span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    {enrollment.start_date && (
                      <span>
                        התחלה: {new Date(enrollment.start_date).toLocaleDateString("he-IL")}
                      </span>
                    )}
                  </div>
                  <div>
                    {enrollment.end_date && (
                      <span>
                        סיום: {new Date(enrollment.end_date).toLocaleDateString("he-IL")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mentor */}
                {enrollment.mentor_name && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      מנטור: <span className="font-medium text-foreground">{enrollment.mentor_name}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GraduationCap size={48} className="text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground mb-1">אין הרשמות</p>
          <p className="text-sm text-muted-foreground">צור הרשמה חדשה כדי להתחיל</p>
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
            <select
              value={formData.contact_id}
              onChange={(e) => setFormData((p) => ({ ...p, contact_id: e.target.value }))}
              className={inputClass}
              required
            >
              <option value="">בחר ליד</option>
              {contacts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
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
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData((p) => ({ ...p, start_date: e.target.value }))}
                className={inputClass}
                dir="ltr"
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
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData((p) => ({ ...p, assigned_to: e.target.value }))}
                className={inputClass}
              >
                <option value="">ללא שיוך</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
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

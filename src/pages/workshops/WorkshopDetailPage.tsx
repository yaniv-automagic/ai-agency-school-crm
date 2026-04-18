import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Circle,
  XCircle,
  Plus,
  Trash2,
  Pencil,
  Users,
  Link as LinkIcon,
  Video,
  ChevronDown,
  ChevronUp,
  X,
  Search,
  BookOpen,
} from "lucide-react";
import {
  useWorkshop,
  useUpdateWorkshop,
  useDeleteWorkshop,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  useAddParticipant,
  useRemoveParticipant,
  useSessionAttendance,
  useToggleAttendance,
} from "@/hooks/useWorkshops";
import { useContacts } from "@/hooks/useContacts";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import type { Workshop, WorkshopSession, WorkshopParticipant } from "@/types/crm";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "bg-gray-100 text-gray-700" },
  active: { label: "פעילה", color: "bg-green-100 text-green-700" },
  completed: { label: "הושלמה", color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "בוטלה", color: "bg-red-100 text-red-700" },
};

const SESSION_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planned: { label: "מתוכנן", color: "bg-gray-100 text-gray-700" },
  scheduled: { label: "נקבע", color: "bg-blue-100 text-blue-700" },
  completed: { label: "הושלם", color: "bg-green-100 text-green-700" },
  cancelled: { label: "בוטל", color: "bg-red-100 text-red-700" },
};

const PARTICIPANT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "פעיל", color: "bg-green-100 text-green-700" },
  completed: { label: "סיים", color: "bg-blue-100 text-blue-700" },
  dropped: { label: "נשר", color: "bg-red-100 text-red-700" },
  paused: { label: "מושהה", color: "bg-yellow-100 text-yellow-700" },
};

export default function WorkshopDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: workshop, isLoading } = useWorkshop(id);
  const deleteWorkshop = useDeleteWorkshop();
  const [showAddSession, setShowAddSession] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!workshop) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">סדנה לא נמצאה</p>
        <button onClick={() => navigate("/workshops")} className="text-primary mt-2 text-sm">
          חזרה לסדנאות
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[workshop.status] || STATUS_CONFIG.draft;
  const sessions = workshop.sessions || [];
  const participants = workshop.participants || [];

  const handleDelete = async () => {
    if (!confirm("למחוק את הסדנה?")) return;
    await deleteWorkshop.mutateAsync(workshop.id);
    toast.success("סדנה נמחקה");
    navigate("/workshops");
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/workshops")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRight size={16} />
        חזרה לסדנאות
      </button>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT side - Sessions */}
        <div className="lg:col-span-2 space-y-4">
          {/* Workshop Header */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-2xl font-bold">{workshop.name}</h1>
                {workshop.description && (
                  <p className="text-sm text-muted-foreground mt-1">{workshop.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 mr-3">
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                    statusCfg.color
                  )}
                >
                  {statusCfg.label}
                </span>
                <button
                  onClick={() => navigate(`/workshops/${workshop.id}/edit`)}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  title="עריכה"
                >
                  <Pencil size={16} className="text-muted-foreground" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteWorkshop.isPending}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="מחיקה"
                >
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            </div>

            {/* Info bar */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {(workshop.start_date || workshop.end_date) && (
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  {workshop.start_date
                    ? new Date(workshop.start_date).toLocaleDateString("he-IL")
                    : "—"}
                  {" - "}
                  {workshop.end_date
                    ? new Date(workshop.end_date).toLocaleDateString("he-IL")
                    : "—"}
                </span>
              )}
              {workshop.mentor_name && (
                <span className="flex items-center gap-1">
                  <Users size={13} />
                  מנטור: {workshop.mentor_name}
                </span>
              )}
              {workshop.meeting_url && (
                <a
                  href={workshop.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <LinkIcon size={13} />
                  קישור למפגש
                </a>
              )}
              {workshop.max_participants && (
                <span className="flex items-center gap-1">
                  <Users size={13} />
                  מקסימום: {workshop.max_participants} משתתפים
                </span>
              )}
            </div>
          </div>

          {/* Sessions */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">מפגשים ({sessions.length})</h3>
              <button
                onClick={() => setShowAddSession(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus size={14} />
                הוסף מפגש
              </button>
            </div>

            {sessions.length > 0 ? (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    workshopId={workshop.id}
                    participants={participants}
                    isExpanded={expandedSession === session.id}
                    onToggle={() =>
                      setExpandedSession(expandedSession === session.id ? null : session.id)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <BookOpen size={36} className="text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">אין מפגשים עדיין</p>
              </div>
            )}
          </div>

          {/* Add Session Form */}
          {showAddSession && (
            <AddSessionForm
              workshopId={workshop.id}
              nextNumber={sessions.length + 1}
              onClose={() => setShowAddSession(false)}
            />
          )}
        </div>

        {/* RIGHT side - Participants Sidebar */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">תלמידים ({participants.length})</h3>
              <button
                onClick={() => setShowAddParticipant(!showAddParticipant)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-input rounded-lg hover:bg-secondary transition-colors"
              >
                <Plus size={13} />
                הוסף תלמיד
              </button>
            </div>

            {/* Add Participant Search */}
            {showAddParticipant && (
              <AddParticipantSearch
                workshopId={workshop.id}
                existingContactIds={participants.map((p) => p.contact_id)}
                onClose={() => setShowAddParticipant(false)}
              />
            )}

            {/* Participants List */}
            {participants.length > 0 ? (
              <div className="space-y-2">
                {participants.map((participant) => (
                  <ParticipantRow
                    key={participant.id}
                    participant={participant}
                    sessions={sessions}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users size={32} className="text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">אין תלמידים רשומים</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Session Card ──

function SessionCard({
  session,
  workshopId,
  participants,
  isExpanded,
  onToggle,
}: {
  session: WorkshopSession;
  workshopId: string;
  participants: WorkshopParticipant[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const updateSession = useUpdateSession();
  const sessionStatus = SESSION_STATUS_CONFIG[session.status] || SESSION_STATUS_CONFIG.planned;

  const handleMarkComplete = async () => {
    await updateSession.mutateAsync({
      id: session.id,
      status: "completed",
    });
    toast.success("מפגש סומן כהושלם");
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={onToggle}
      >
        {/* Number circle */}
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
          {session.session_number}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{session.title}</span>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                sessionStatus.color
              )}
            >
              {sessionStatus.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {session.scheduled_at && (
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {new Date(session.scheduled_at).toLocaleDateString("he-IL", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            {session.duration_minutes > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {session.duration_minutes} דקות
              </span>
            )}
            {session.recording_url && (
              <a
                href={session.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Video size={11} />
                הקלטה
              </a>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {session.status === "scheduled" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkComplete();
              }}
              disabled={updateSession.isPending}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 size={12} />
              סמן הושלם
            </button>
          )}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded: Attendance */}
      {isExpanded && (
        <AttendancePanel
          sessionId={session.id}
          participants={participants}
        />
      )}
    </div>
  );
}

// ── Attendance Panel ──

function AttendancePanel({
  sessionId,
  participants,
}: {
  sessionId: string;
  participants: WorkshopParticipant[];
}) {
  const { data: attendance, isLoading } = useSessionAttendance(sessionId);
  const toggleAttendance = useToggleAttendance();

  if (isLoading) {
    return (
      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  const attendanceMap = new Map(
    (attendance || []).map((a: any) => [a.participant_id, a.attended])
  );

  return (
    <div className="p-3 border-t border-border bg-secondary/20">
      <p className="text-xs font-medium text-muted-foreground mb-2">נוכחות</p>
      {participants.length > 0 ? (
        <div className="space-y-1.5">
          {participants.map((p) => {
            const isAttended = attendanceMap.get(p.id) ?? false;
            return (
              <label
                key={p.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isAttended}
                  onChange={(e) =>
                    toggleAttendance.mutate({
                      sessionId,
                      participantId: p.id,
                      attended: e.target.checked,
                    })
                  }
                  className="rounded border-input"
                />
                <span className="text-sm">
                  {p.contact?.first_name} {p.contact?.last_name}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">אין תלמידים רשומים</p>
      )}
    </div>
  );
}

// ── Add Session Form ──

function AddSessionForm({
  workshopId,
  nextNumber,
  onClose,
}: {
  workshopId: string;
  nextNumber: number;
  onClose: () => void;
}) {
  const createSession = useCreateSession();
  const [formData, setFormData] = useState({
    title: `מפגש ${nextNumber}`,
    scheduled_at: "",
    duration_minutes: "60",
    meeting_url: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSession.mutateAsync({
      workshop_id: workshopId,
      session_number: nextNumber,
      title: formData.title.trim(),
      scheduled_at: formData.scheduled_at || null,
      duration_minutes: parseInt(formData.duration_minutes) || 60,
      meeting_url: formData.meeting_url.trim() || null,
      status: formData.scheduled_at ? "scheduled" : "planned",
    });
    onClose();
  };

  const inputClass =
    "w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm">הוסף מפגש</h4>
        <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
          <X size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-medium mb-1 block">כותרת</label>
          <input
            value={formData.title}
            onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
            className={inputClass}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block">תאריך ושעה</label>
            <input
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData((p) => ({ ...p, scheduled_at: e.target.value }))}
              className={inputClass}
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">משך (דקות)</label>
            <input
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => setFormData((p) => ({ ...p, duration_minutes: e.target.value }))}
              className={inputClass}
              min={1}
              dir="ltr"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">קישור למפגש</label>
          <input
            value={formData.meeting_url}
            onChange={(e) => setFormData((p) => ({ ...p, meeting_url: e.target.value }))}
            className={inputClass}
            placeholder="https://zoom.us/..."
            dir="ltr"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={createSession.isPending}
            className="flex-1 px-3 py-2 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createSession.isPending ? "שומר..." : "הוסף מפגש"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium border border-input rounded-lg hover:bg-secondary transition-colors"
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Add Participant Search ──

function AddParticipantSearch({
  workshopId,
  existingContactIds,
  onClose,
}: {
  workshopId: string;
  existingContactIds: string[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const { data: contacts } = useContacts(search ? { search } : undefined);
  const addParticipant = useAddParticipant();

  const filteredContacts = (contacts || []).filter(
    (c) => !existingContactIds.includes(c.id)
  );

  const handleAdd = async (contactId: string) => {
    await addParticipant.mutateAsync({ workshop_id: workshopId, contact_id: contactId });
    onClose();
  };

  return (
    <div className="mb-4 border border-border rounded-lg p-3 bg-secondary/20">
      <div className="relative mb-2">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חפש ליד..."
          className="w-full pr-9 pl-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {filteredContacts.length > 0 ? (
          filteredContacts.slice(0, 20).map((contact) => (
            <button
              key={contact.id}
              onClick={() => handleAdd(contact.id)}
              disabled={addParticipant.isPending}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-secondary transition-colors text-right disabled:opacity-50"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs shrink-0">
                {contact.first_name?.charAt(0)}
                {contact.last_name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {contact.first_name} {contact.last_name}
                </p>
                {contact.email && (
                  <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                )}
              </div>
            </button>
          ))
        ) : search ? (
          <p className="text-xs text-muted-foreground text-center py-3">לא נמצאו תוצאות</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">הקלד לחיפוש</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="mt-2 w-full px-3 py-1.5 text-xs font-medium border border-input rounded-lg hover:bg-secondary transition-colors"
      >
        סגור
      </button>
    </div>
  );
}

// ── Participant Row ──

function ParticipantRow({
  participant,
  sessions,
}: {
  participant: WorkshopParticipant;
  sessions: WorkshopSession[];
}) {
  const removeParticipant = useRemoveParticipant();
  const [hovered, setHovered] = useState(false);
  const participantStatus = PARTICIPANT_STATUS_CONFIG[participant.status] || PARTICIPANT_STATUS_CONFIG.active;

  // Count attendance from session attendance arrays
  const completedSessions = sessions.filter((s) => s.status === "completed").length;
  const attendedCount = sessions.reduce((count, s) => {
    const att = s.attendance?.find((a) => a.participant_id === participant.id);
    return count + (att?.attended ? 1 : 0);
  }, 0);

  const handleRemove = async () => {
    if (!confirm("להסיר את התלמיד מהסדנה?")) return;
    await removeParticipant.mutateAsync(participant.id);
  };

  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs shrink-0">
        {participant.contact?.avatar_url ? (
          <img
            src={participant.contact.avatar_url}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <>
            {participant.contact?.first_name?.charAt(0)}
            {participant.contact?.last_name?.charAt(0)}
          </>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">
            {participant.contact?.first_name} {participant.contact?.last_name}
          </p>
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0",
              participantStatus.color
            )}
          >
            {participantStatus.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {participant.contact?.email && (
            <span className="truncate">{participant.contact.email}</span>
          )}
        </div>
        {completedSessions > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            נוכחות: {attendedCount}/{completedSessions} מפגשים
          </p>
        )}
      </div>

      {/* Remove button on hover */}
      {hovered && (
        <button
          onClick={handleRemove}
          disabled={removeParticipant.isPending}
          className="p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0"
          title="הסר תלמיד"
        >
          <X size={14} className="text-red-500" />
        </button>
      )}
    </div>
  );
}

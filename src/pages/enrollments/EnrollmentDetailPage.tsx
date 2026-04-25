import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowRight, Calendar, CheckCircle2, Clock, Circle, XCircle,
  Mail, Phone, MessageCircle, MapPin, Users, Trash2,
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useEnrollment, useUpdateSession, useUpdateEnrollment, useDeleteEnrollment } from "@/hooks/useEnrollments";
import { useContact } from "@/hooks/useContacts";
import { useTasks, useCreateTask } from "@/hooks/useTasks";
import { useMeetings } from "@/hooks/useMeetings";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/contexts/AuthContext";
import { ENROLLMENT_STATUSES, SESSION_TYPES, SESSION_STATUSES } from "@/lib/constants";
import { cn, timeAgo, formatPhone, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ActivityTimeline from "@/components/contacts/ActivityTimeline";
import WhatsAppChat from "@/components/whatsapp/WhatsAppChat";
import type { ProgramSession } from "@/types/crm";

export default function EnrollmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: enrollment, isLoading } = useEnrollment(id);
  const updateSession = useUpdateSession();
  const updateEnrollment = useUpdateEnrollment();
  const deleteEnrollment = useDeleteEnrollment();
  const confirm = useConfirm();
  const { teamMember } = useAuth();
  const { members } = useTeamMembers();

  // Fetch contact data for sidebar details
  const contactId = enrollment?.contact_id;
  const { data: contact } = useContact(contactId);
  const { data: tasks } = useTasks({ contact_id: contactId });
  const { data: meetings } = useMeetings({ contact_id: contactId });

  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "sessions">("timeline");
  const [showTaskCreate, setShowTaskCreate] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">הרשמה לא נמצאה</p>
        <button onClick={() => navigate("/enrollments")} className="text-primary mt-2 text-sm">
          חזרה לתלמידים
        </button>
      </div>
    );
  }

  const statusInfo = ENROLLMENT_STATUSES.find((s) => s.value === enrollment.status);
  const progress =
    enrollment.total_sessions > 0
      ? Math.round((enrollment.completed_sessions / enrollment.total_sessions) * 100)
      : 0;

  const sessions = (enrollment.sessions || []).sort(
    (a, b) => a.session_number - b.session_number
  );

  const handleMarkCompleted = async (session: ProgramSession) => {
    await updateSession.mutateAsync({
      id: session.id,
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    await updateEnrollment.mutateAsync({
      id: enrollment.id,
      completed_sessions: enrollment.completed_sessions + 1,
    });
    toast.success("מפגש סומן כהושלם");
  };

  const handleScheduleSession = async (session: ProgramSession) => {
    await updateSession.mutateAsync({
      id: session.id,
      status: "scheduled",
    });
    toast.success("מפגש סומן כנקבע");
  };

  const getSessionStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 size={18} className="text-green-500" />;
      case "scheduled":
        return <Clock size={18} className="text-blue-500" />;
      case "missed":
        return <XCircle size={18} className="text-red-500" />;
      case "cancelled":
        return <XCircle size={18} className="text-gray-400" />;
      default:
        return <Circle size={18} className="text-gray-300" />;
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "מחיקת הרשמה",
      description: `האם למחוק את ההרשמה של ${enrollment.contact?.first_name} ${enrollment.contact?.last_name}?`,
      confirmText: "מחק",
      cancelText: "ביטול",
      variant: "destructive",
    });
    if (!confirmed) return;
    await deleteEnrollment.mutateAsync(enrollment.id);
    navigate("/enrollments");
  };

  const upcomingMeetings = meetings?.filter(m => m.status === "scheduled" || m.status === "confirmed") || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/enrollments")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRight size={16} />
        חזרה לתלמידים
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {enrollment.contact?.first_name} {enrollment.contact?.last_name}
          </h1>
          <p className="text-muted-foreground mt-1">{enrollment.product?.name || "—"}</p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {/* Status picker */}
            <div className="relative flex">
              <button
                onClick={() => setShowStatusPicker(!showStatusPicker)}
                className={cn(
                  "inline-flex items-center py-0.5 px-2.5 rounded-full text-xs font-medium gap-1.5 transition-colors cursor-pointer",
                  statusInfo?.color
                )}
              >
                {statusInfo?.label}
              </button>
              {showStatusPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStatusPicker(false)} />
                  <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl shadow-xl py-1 w-44 z-50" dir="rtl">
                    {ENROLLMENT_STATUSES.map(s => (
                      <button
                        key={s.value}
                        onClick={() => {
                          updateEnrollment.mutate({ id: enrollment.id, status: s.value as any });
                          setShowStatusPicker(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                          s.value === enrollment.status && "bg-secondary/50 font-medium"
                        )}
                      >
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", s.color)}>
                          {s.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Assignee picker */}
            <div className="relative flex">
              <button
                onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                className="inline-flex items-center py-0.5 px-2.5 rounded-full text-xs font-medium gap-1 bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                {enrollment.assigned_member ? (
                  <>
                    {enrollment.assigned_member.avatar_url ? (
                      <img src={enrollment.assigned_member.avatar_url} alt="" className="w-[14px] h-[14px] rounded-full object-cover" />
                    ) : (
                      <span className="w-[14px] h-[14px] rounded-full bg-primary/20 inline-flex items-center justify-center text-[6px] font-bold text-primary leading-none">{enrollment.assigned_member.display_name?.charAt(0)}</span>
                    )}
                    {enrollment.assigned_member.display_name}
                  </>
                ) : "לא משויך"}
              </button>
              {showAssigneePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAssigneePicker(false)} />
                  <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl shadow-xl py-1 w-48 z-50" dir="rtl">
                    <button
                      onClick={() => { updateEnrollment.mutate({ id: enrollment.id, assigned_to: null } as any); setShowAssigneePicker(false); }}
                      className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right", !enrollment.assigned_to && "bg-secondary/50 font-medium")}
                    >
                      ללא שיוך
                    </button>
                    {members.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { updateEnrollment.mutate({ id: enrollment.id, assigned_to: m.id } as any); setShowAssigneePicker(false); }}
                        className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right", m.id === enrollment.assigned_to && "bg-secondary/50 font-medium")}
                      >
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-medium">{m.display_name?.charAt(0)}</div>
                        )}
                        {m.display_name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Mentor badge */}
            {enrollment.assigned_member?.display_name && (
              <span className="inline-flex items-center py-0.5 px-2.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                <Users size={11} className="ml-1" />
                {enrollment.assigned_member.display_name}
              </span>
            )}

            {/* Portal access badge */}
            <span className={cn(
              "inline-flex items-center py-0.5 px-2.5 rounded-full text-xs font-medium",
              enrollment.portal_access_granted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
            )}>
              {enrollment.portal_access_granted ? "גישה לפורטל" : "ללא גישה לפורטל"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {contact?.phone && (
            <button onClick={() => setShowWhatsApp(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
              <MessageCircle size={14} /> WhatsApp
            </button>
          )}
          <button onClick={() => navigate(`/contacts/${enrollment.contact_id}`)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-input rounded-lg hover:bg-secondary transition-colors">
            <ArrowRight size={14} className="rotate-180" /> כרטיס ליד
          </button>
          <button onClick={handleDelete}
            className="p-2 text-destructive border border-input rounded-lg hover:bg-destructive/10 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">התקדמות כוללת</span>
          <span className="text-muted-foreground">
            {enrollment.completed_sessions}/{enrollment.total_sessions} מפגשים ({progress}%)
          </span>
        </div>
        <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - Tabs: Timeline / Sessions */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab switcher */}
          <div className="flex items-center gap-1 border-b border-border">
            <button
              onClick={() => setActiveTab("timeline")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === "timeline"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              טיימליין
            </button>
            <button
              onClick={() => setActiveTab("sessions")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === "sessions"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              מפגשים ({sessions.length})
            </button>
          </div>

          {/* Activity Timeline (inherited from contact) */}
          {activeTab === "timeline" && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold mb-4">פעילות</h3>
              {contactId && <ActivityTimeline contactId={contactId} />}
            </div>
          )}

          {/* Session Timeline */}
          {activeTab === "sessions" && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold mb-4">מפגשים</h3>

              {sessions.length > 0 ? (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute right-[17px] top-4 bottom-4 w-0.5 bg-border" />

                  <div className="space-y-0">
                    {sessions.map((session) => {
                      const sessionType = SESSION_TYPES.find(
                        (t) => t.value === session.session_type
                      );
                      const sessionStatus = SESSION_STATUSES.find(
                        (s) => s.value === session.status
                      );

                      return (
                        <div key={session.id} className="relative flex gap-4 py-3">
                          {/* Status icon */}
                          <div className="relative z-10 bg-card">
                            {getSessionStatusIcon(session.status)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  מפגש {session.session_number}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                  {sessionType?.label}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                    sessionStatus?.color
                                  )}
                                >
                                  {sessionStatus?.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {session.status === "planned" && (
                                  <button
                                    onClick={() => handleScheduleSession(session)}
                                    disabled={updateSession.isPending}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs border border-input rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
                                  >
                                    <Calendar size={12} />
                                    קבע פגישה
                                  </button>
                                )}
                                {session.status === "scheduled" && (
                                  <button
                                    onClick={() => handleMarkCompleted(session)}
                                    disabled={updateSession.isPending}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                  >
                                    <CheckCircle2 size={12} />
                                    סמן הושלם
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Scheduled date */}
                            {session.scheduled_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(session.scheduled_at).toLocaleDateString("he-IL", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            )}

                            {/* Completed date */}
                            {session.completed_at && (
                              <p className="text-xs text-green-600 mt-1">
                                הושלם ב-{new Date(session.completed_at).toLocaleDateString("he-IL")}
                              </p>
                            )}

                            {/* Notes */}
                            {session.notes && (
                              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                {session.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">אין מפגשים</p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Enrollment Info */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">פרטי הרשמה</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">סטטוס</span>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                    statusInfo?.color
                  )}
                >
                  {statusInfo?.label}
                </span>
              </div>
              {enrollment.start_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">תאריך התחלה</span>
                  <span>{new Date(enrollment.start_date).toLocaleDateString("he-IL")}</span>
                </div>
              )}
              {enrollment.end_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">תאריך סיום</span>
                  <span>{new Date(enrollment.end_date).toLocaleDateString("he-IL")}</span>
                </div>
              )}
              {enrollment.assigned_member?.display_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">מנטור</span>
                  <span className="font-medium">{enrollment.assigned_member.display_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">גישה לפורטל</span>
                <button
                  onClick={() => updateEnrollment.mutate({
                    id: enrollment.id,
                    portal_access_granted: !enrollment.portal_access_granted,
                    portal_access_granted_at: !enrollment.portal_access_granted ? new Date().toISOString() : null,
                  } as any)}
                  className={cn("text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer transition-colors",
                    enrollment.portal_access_granted ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-600 hover:bg-red-200"
                  )}
                >
                  {enrollment.portal_access_granted ? "כן" : "לא"}
                </button>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">נוצר</span>
                <span className="text-xs">{timeAgo(enrollment.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Contact Card */}
          {contact && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
              <h3 className="font-semibold text-sm">פרטי תלמיד</h3>
              <div
                onClick={() => navigate(`/contacts/${contact.id}`)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                  {contact.first_name?.charAt(0)}
                  {contact.last_name?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {contact.first_name} {contact.last_name}
                  </p>
                  {contact.email && (
                    <p className="text-xs text-muted-foreground">{contact.email}</p>
                  )}
                </div>
              </div>
              {contact.email && (
                <div className="flex items-center gap-2 text-xs">
                  <Mail size={13} className="text-muted-foreground" />
                  <a href={`mailto:${contact.email}`} className="text-muted-foreground hover:text-primary" dir="ltr">{contact.email}</a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-xs">
                  <Phone size={13} className="text-muted-foreground" />
                  <a href={`tel:${contact.phone}`} className="text-muted-foreground hover:text-primary" dir="ltr">{formatPhone(contact.phone)}</a>
                </div>
              )}
              {(contact.address || contact.city) && (
                <div className="flex items-center gap-2 text-xs">
                  <MapPin size={13} className="text-muted-foreground" />
                  <span className="text-muted-foreground">{contact.address || contact.city}</span>
                </div>
              )}
            </div>
          )}

          {/* Product Card */}
          {enrollment.product && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3">מוצר / תכנית</h3>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{enrollment.product.name}</p>
                {enrollment.product.description && (
                  <p className="text-xs text-muted-foreground">{enrollment.product.description}</p>
                )}
                {enrollment.product.duration_description && (
                  <p className="text-xs text-muted-foreground">
                    משך: {enrollment.product.duration_description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Meetings */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">פגישות</h3>
            </div>
            {upcomingMeetings.length > 0 ? (
              <div className="space-y-2">
                {upcomingMeetings.map(meeting => (
                  <div
                    key={meeting.id}
                    onClick={() => navigate(`/meetings/${meeting.id}`)}
                    className="p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
                  >
                    <p className="text-sm font-medium">{meeting.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar size={12} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(meeting.scheduled_at).toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">אין פגישות קרובות</p>
            )}
          </div>

          {/* Tasks */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">משימות</h3>
              <button onClick={() => setShowTaskCreate(!showTaskCreate)} className="text-xs text-primary hover:underline">
                + משימה חדשה
              </button>
            </div>
            {showTaskCreate && (
              <TaskCreateWidget contactId={enrollment.contact_id} members={members}
                onClose={() => setShowTaskCreate(false)} />
            )}
            {tasks && tasks.filter(t => t.status !== "completed").length > 0 ? (
              <div className="space-y-2">
                {tasks.filter(t => t.status !== "completed").map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50">
                    <input type="checkbox" className="rounded accent-primary w-3.5 h-3.5" />
                    <span className="text-sm flex-1">{task.title}</span>
                    {task.assigned_member && (
                      <span className="text-[10px] text-muted-foreground">{task.assigned_member.display_name}</span>
                    )}
                    {task.due_date && (
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(task.due_date)}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : !showTaskCreate ? (
              <p className="text-xs text-muted-foreground">אין משימות פתוחות</p>
            ) : null}
          </div>

          {/* Notes */}
          {enrollment.notes && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-2">הערות</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {enrollment.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Chat */}
      {showWhatsApp && contact && (
        <WhatsAppChat contact={contact} onClose={() => setShowWhatsApp(false)} />
      )}
    </div>
  );
}

// ── Task Create Widget ──
function TaskCreateWidget({ contactId, members, onClose }: {
  contactId: string; members: { id: string; display_name: string }[]; onClose: () => void;
}) {
  const createTask = useCreateTask();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");

  const handleCreate = async () => {
    if (!title.trim()) return;
    await createTask.mutateAsync({
      title, contact_id: contactId, type: "task", priority: priority as any, status: "pending",
      assigned_to: assignee || null, due_date: dueDate ? new Date(dueDate).toISOString() : null,
    } as any);
    toast.success("משימה נוצרה");
    onClose();
  };

  return (
    <div className="space-y-2 mb-3 p-3 bg-muted/30 rounded-lg border border-border">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="מה צריך לעשות?"
        className="w-full px-2.5 py-1.5 text-sm border border-input rounded-lg bg-background outline-none" autoFocus />
      <div className="grid grid-cols-3 gap-2">
        <Select value={assignee || "__none__"} onValueChange={v => setAssignee(v === "__none__" ? "" : v)}>
          <SelectTrigger className="text-xs h-8"><SelectValue placeholder="אחראי" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">ללא</SelectItem>
            {members.map(m => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">נמוכה</SelectItem>
            <SelectItem value="medium">בינונית</SelectItem>
            <SelectItem value="high">גבוהה</SelectItem>
            <SelectItem value="urgent">דחוף</SelectItem>
          </SelectContent>
        </Select>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="px-2 py-1 text-xs border border-input rounded-lg bg-background outline-none h-8" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-secondary">ביטול</button>
        <button onClick={handleCreate} disabled={!title.trim()}
          className="px-3 py-1 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
          צור
        </button>
      </div>
    </div>
  );
}

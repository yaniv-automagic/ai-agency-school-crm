import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Calendar, CheckCircle2, Clock, Circle, XCircle } from "lucide-react";
import { useEnrollment, useUpdateSession, useUpdateEnrollment } from "@/hooks/useEnrollments";
import { ENROLLMENT_STATUSES, SESSION_TYPES, SESSION_STATUSES } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import type { ProgramSession } from "@/types/crm";

export default function EnrollmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: enrollment, isLoading } = useEnrollment(id);
  const updateSession = useUpdateSession();
  const updateEnrollment = useUpdateEnrollment();

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
          חזרה לתכניות לימודים
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
    // Update enrollment completed_sessions count
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

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/enrollments")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRight size={16} />
        חזרה לתכניות לימודים
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {enrollment.contact?.first_name} {enrollment.contact?.last_name}
          </h1>
          <p className="text-muted-foreground mt-1">{enrollment.product?.name || "—"}</p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                statusInfo?.color
              )}
            >
              {statusInfo?.label}
            </span>
          </div>
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
        {/* Main content - Session Timeline */}
        <div className="lg:col-span-2">
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
              {enrollment.mentor_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">מנטור</span>
                  <span className="font-medium">{enrollment.mentor_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">גישה לפורטל</span>
                <span>{enrollment.portal_access_granted ? "כן" : "לא"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">נוצר</span>
                <span className="text-xs">{timeAgo(enrollment.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Contact Card */}
          {enrollment.contact && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3">איש קשר</h3>
              <div
                onClick={() => navigate(`/contacts/${enrollment.contact!.id}`)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                  {enrollment.contact.first_name?.charAt(0)}
                  {enrollment.contact.last_name?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {enrollment.contact.first_name} {enrollment.contact.last_name}
                  </p>
                  {enrollment.contact.email && (
                    <p className="text-xs text-muted-foreground">{enrollment.contact.email}</p>
                  )}
                </div>
              </div>
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
    </div>
  );
}

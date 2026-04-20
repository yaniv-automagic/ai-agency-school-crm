import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, ExternalLink, Calendar, Clock, Video, User, FileText, CheckCircle, ChevronDown } from "lucide-react";
import { useMeeting, useUpdateMeeting } from "@/hooks/useMeetings";
import { MEETING_TYPES, MEETING_STATUSES, MEETING_OUTCOMES } from "@/lib/constants";
import { cn, formatCurrency, timeAgo } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MeetingOutcome } from "@/types/crm";

export default function MeetingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: meeting, isLoading } = useMeeting(id);
  const updateMeeting = useUpdateMeeting();

  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const [outcomeForm, setOutcomeForm] = useState<{
    outcome: MeetingOutcome | "";
    outcome_notes: string;
    outcome_deal_value: string;
  }>({
    outcome: "",
    outcome_notes: "",
    outcome_deal_value: "",
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">פגישה לא נמצאה</p>
        <button onClick={() => navigate("/meetings")} className="text-primary mt-2 text-sm">
          חזרה לפגישות
        </button>
      </div>
    );
  }

  const status = MEETING_STATUSES.find((s) => s.value === meeting.status);
  const type = MEETING_TYPES.find((t) => t.value === meeting.meeting_type);
  const outcome = meeting.outcome ? MEETING_OUTCOMES.find((o) => o.value === meeting.outcome) : null;

  const handleOutcomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcomeForm.outcome) return;
    await updateMeeting.mutateAsync({
      id: meeting.id,
      status: "completed",
      outcome: outcomeForm.outcome as MeetingOutcome,
      outcome_notes: outcomeForm.outcome_notes || null,
      outcome_deal_value: outcomeForm.outcome_deal_value
        ? parseFloat(outcomeForm.outcome_deal_value)
        : null,
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateMeeting.mutateAsync({
      id: meeting.id,
      status: newStatus as any,
    });
  };

  const showOutcomeForm = meeting.status === "completed" && !meeting.outcome;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/meetings")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRight size={16} />
        חזרה לפגישות
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{meeting.title}</h1>
          <p className="text-muted-foreground mt-1">
            {meeting.contact?.first_name} {meeting.contact?.last_name}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary", type?.color)}>
              {type?.label}
            </span>
            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", status?.color)}>
              {status?.label}
            </span>
            {outcome && (
              <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary", outcome.color)}>
                {outcome.label}
              </span>
            )}
          </div>
        </div>

        {/* Status actions */}
        {meeting.status === "scheduled" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStatusChange("confirmed")}
              className="px-3 py-2 text-sm border border-input rounded-lg hover:bg-secondary transition-colors"
            >
              אשר פגישה
            </button>
            <button
              onClick={() => handleStatusChange("completed")}
              className="px-3 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              סמן התקיימה
            </button>
            <button
              onClick={() => handleStatusChange("no_show")}
              className="px-3 py-2 text-sm text-destructive border border-input rounded-lg hover:bg-destructive/10 transition-colors"
            >
              לא הגיע
            </button>
          </div>
        )}
        {meeting.status === "confirmed" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStatusChange("completed")}
              className="px-3 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              סמן התקיימה
            </button>
            <button
              onClick={() => handleStatusChange("no_show")}
              className="px-3 py-2 text-sm text-destructive border border-input rounded-lg hover:bg-destructive/10 transition-colors"
            >
              לא הגיע
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          {meeting.description && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold mb-3">תיאור</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {meeting.description}
              </p>
            </div>
          )}

          {/* Meeting URL */}
          {meeting.meeting_url && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold mb-3">קישור לפגישה</h3>
              <a
                href={meeting.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
                dir="ltr"
              >
                <ExternalLink size={14} />
                {meeting.meeting_url}
              </a>
            </div>
          )}

          {/* Outcome Section */}
          {meeting.outcome && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold mb-3">תוצאת הפגישה</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">תוצאה:</span>
                  <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary", outcome?.color)}>
                    {outcome?.label}
                  </span>
                </div>
                {meeting.outcome_deal_value != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">ערך עסקה:</span>
                    <span className="text-sm font-medium">{formatCurrency(meeting.outcome_deal_value)}</span>
                  </div>
                )}
                {meeting.outcome_notes && (
                  <div>
                    <span className="text-sm text-muted-foreground">הערות:</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{meeting.outcome_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mini Video Player (Fireflies) */}
          {meeting.recording_url && meeting.fireflies_meeting_id && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="relative bg-black">
                <video
                  src={meeting.recording_url}
                  controls
                  preload="metadata"
                  className="w-full max-h-[400px] object-contain"
                  controlsList="nodownload"
                  playsInline
                />
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between bg-purple-50/50 border-t border-border">
                <div className="flex items-center gap-2">
                  <Video size={14} className="text-purple-500" />
                  <span className="text-xs font-medium text-purple-700">הקלטת פגישה</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">Fireflies</span>
                </div>
                <a href={meeting.recording_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-purple-600 hover:underline">
                  <ExternalLink size={11} /> פתח בחלון חדש
                </a>
              </div>
            </div>
          )}

          {/* AI Summary (Fireflies) */}
          {meeting.ai_summary && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Video size={16} className="text-purple-500" />
                <h3 className="font-semibold">סיכום AI</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">Fireflies</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {meeting.ai_summary}
              </p>
            </div>
          )}

          {/* Action Items (Fireflies) */}
          {meeting.ai_action_items && meeting.ai_action_items.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-purple-500" />
                <h3 className="font-semibold">פריטי פעולה</h3>
              </div>
              <ul className="space-y-2">
                {meeting.ai_action_items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-purple-400 mt-0.5 shrink-0">•</span>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript (Fireflies) */}
          {meeting.transcript_text && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-purple-500" />
                  <h3 className="font-semibold">תמלול פגישה</h3>
                </div>
                {meeting.transcript_url && (
                  <a href={meeting.transcript_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-purple-600 hover:underline">
                    <ExternalLink size={12} /> פתח ב-Fireflies
                  </a>
                )}
              </div>
              <div className={cn("text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed font-mono", !showFullTranscript && "max-h-64 overflow-hidden relative")}>
                {meeting.transcript_text}
                {!showFullTranscript && meeting.transcript_text.length > 500 && (
                  <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-card to-transparent" />
                )}
              </div>
              {meeting.transcript_text.length > 500 && (
                <button
                  onClick={() => setShowFullTranscript(!showFullTranscript)}
                  className="flex items-center gap-1.5 mt-3 text-xs font-medium text-purple-600 hover:text-purple-700"
                >
                  <ChevronDown size={14} className={cn("transition-transform", showFullTranscript && "rotate-180")} />
                  {showFullTranscript ? "הצג פחות" : "הצג תמלול מלא"}
                </button>
              )}
            </div>
          )}

          {/* Outcome Recording Form */}
          {showOutcomeForm && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold mb-3">תיעוד תוצאה</h3>
              <form onSubmit={handleOutcomeSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">תוצאה *</label>
                  <Select
                    value={outcomeForm.outcome || "__all__"}
                    onValueChange={(val) =>
                      setOutcomeForm((p) => ({ ...p, outcome: val === "__all__" ? "" : val as MeetingOutcome }))
                    }
                  >
                    <SelectTrigger className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background">
                      <SelectValue placeholder="בחר תוצאה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">בחר תוצאה</SelectItem>
                      {MEETING_OUTCOMES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">הערות</label>
                  <textarea
                    value={outcomeForm.outcome_notes}
                    onChange={(e) => setOutcomeForm((p) => ({ ...p, outcome_notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    placeholder="הערות לגבי תוצאת הפגישה..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">ערך עסקה</label>
                  <input
                    type="number"
                    value={outcomeForm.outcome_deal_value}
                    onChange={(e) =>
                      setOutcomeForm((p) => ({ ...p, outcome_deal_value: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0"
                    dir="ltr"
                    min={0}
                  />
                </div>

                <button
                  type="submit"
                  disabled={updateMeeting.isPending || !outcomeForm.outcome}
                  className="px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {updateMeeting.isPending ? "שומר..." : "שמור תוצאה"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Meeting Info */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">פרטי פגישה</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">תאריך:</span>
                <span>
                  {new Date(meeting.scheduled_at).toLocaleDateString("he-IL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">שעה:</span>
                <span>
                  {new Date(meeting.scheduled_at).toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">משך:</span>
                <span>{meeting.duration_minutes} דקות</span>
              </div>
              <div className="flex items-center gap-2">
                <Video size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">סוג:</span>
                <span>{type?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">נוצר</span>
                <span className="text-xs">{timeAgo(meeting.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Contact Card */}
          {meeting.contact && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3">ליד</h3>
              <div
                onClick={() => navigate(`/contacts/${meeting.contact!.id}`)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                  {meeting.contact.first_name?.charAt(0)}
                  {meeting.contact.last_name?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {meeting.contact.first_name} {meeting.contact.last_name}
                  </p>
                  {meeting.contact.email && (
                    <p className="text-xs text-muted-foreground">{meeting.contact.email}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Linked Deal Card */}
          {meeting.deal && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3">עסקה מקושרת</h3>
              <div
                onClick={() => navigate(`/pipeline/${meeting.deal!.id}`)}
                className="p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
              >
                <p className="text-sm font-medium">{meeting.deal.title}</p>
                {meeting.deal.value != null && (
                  <p className="text-xs font-medium text-primary mt-1">
                    {formatCurrency(meeting.deal.value)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Recording URL */}
          {meeting.recording_url && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3">הקלטה</h3>
              <a
                href={meeting.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
                dir="ltr"
              >
                <ExternalLink size={14} />
                צפה בהקלטה
              </a>
            </div>
          )}

          {/* Fireflies badge */}
          {meeting.fireflies_meeting_id && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Video size={14} className="text-purple-500" />
                <h3 className="font-semibold text-sm text-purple-700">Fireflies.ai</h3>
              </div>
              <p className="text-xs text-purple-600">פגישה זו תומללה אוטומטית</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

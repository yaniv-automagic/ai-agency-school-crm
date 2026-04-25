import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, ExternalLink, Calendar, Clock, Video, FileText, CheckCircle, ChevronDown, Download, Edit, Link as LinkIcon } from "lucide-react";
import { useMeeting, useUpdateMeeting } from "@/hooks/useMeetings";
import { useAuth } from "@/contexts/AuthContext";
import { MEETING_TYPES, MEETING_STATUSES, MEETING_OUTCOMES } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import type { Meeting } from "@/types/crm";

export default function MeetingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { teamMember } = useAuth();
  const { data: meeting, isLoading } = useMeeting(id);
  const updateMeeting = useUpdateMeeting();

  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showSidebarTypePicker, setShowSidebarTypePicker] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDateTime, setEditingDateTime] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationDraft, setDurationDraft] = useState("");
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

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

  const update = (patch: Partial<Meeting>) => {
    updateMeeting.mutate({ id: meeting.id, ...patch, _tenantId: teamMember?.tenant_id } as any);
  };

  const isoToLocalInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const commitTitle = () => {
    const v = titleDraft.trim();
    if (v && v !== meeting.title) update({ title: v });
    setEditingTitle(false);
  };

  const commitDuration = () => {
    const n = parseInt(durationDraft, 10);
    if (Number.isFinite(n) && n > 0 && n !== meeting.duration_minutes) update({ duration_minutes: n });
    setEditingDuration(false);
  };

  const commitUrl = () => {
    const v = urlDraft.trim();
    if (v !== (meeting.meeting_url || "")) update({ meeting_url: v || null });
    setEditingUrl(false);
  };

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
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              autoFocus
              onBlur={commitTitle}
              onKeyDown={e => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="text-2xl font-bold w-full px-2 py-1 border border-input rounded bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <h1
              onClick={() => { setTitleDraft(meeting.title); setEditingTitle(true); }}
              className="text-2xl font-bold cursor-pointer rounded px-1 -mx-1 hover:bg-secondary/40 inline-flex items-center gap-2 group"
            >
              {meeting.title}
              <Edit size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
            </h1>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Type picker */}
            <div className="relative">
              <button
                onClick={() => setShowTypePicker(!showTypePicker)}
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors",
                  type?.color
                )}
              >
                {type?.label}
              </button>
              {showTypePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTypePicker(false)} />
                  <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl shadow-xl py-1 w-48 z-50" dir="rtl">
                    {MEETING_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => { update({ meeting_type: t.value as any }); setShowTypePicker(false); }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                          t.value === meeting.meeting_type && "bg-secondary/50 font-medium"
                        )}
                      >
                        <span className={t.color}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Status picker */}
            <div className="relative">
              <button
                onClick={() => setShowStatusPicker(!showStatusPicker)}
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                  status?.color
                )}
              >
                {status?.label}
              </button>
              {showStatusPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStatusPicker(false)} />
                  <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl shadow-xl py-1 w-48 z-50" dir="rtl">
                    {MEETING_STATUSES.map(s => (
                      <button
                        key={s.value}
                        onClick={() => { update({ status: s.value as any }); setShowStatusPicker(false); }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                          s.value === meeting.status && "bg-secondary/50 font-medium"
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

            {outcome && (
              <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary", outcome.color)}>
                {outcome.label}
              </span>
            )}
          </div>
        </div>
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

        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Meeting Info */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">פרטי פגישה</h3>
            <div className="space-y-2 text-sm">
              {editingDateTime ? (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <DateTimePicker
                      value={isoToLocalInput(meeting.scheduled_at)}
                      onChange={v => {
                        if (v) {
                          const iso = new Date(v).toISOString();
                          if (iso !== meeting.scheduled_at) update({ scheduled_at: iso });
                        }
                        setEditingDateTime(false);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div
                    onClick={() => setEditingDateTime(true)}
                    className="flex items-center gap-2 group cursor-pointer rounded -mx-1 px-1 hover:bg-secondary/40"
                  >
                    <Calendar size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">תאריך:</span>
                    <span className="flex-1">
                      {new Date(meeting.scheduled_at).toLocaleDateString("he-IL", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <Edit size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                  <div
                    onClick={() => setEditingDateTime(true)}
                    className="flex items-center gap-2 group cursor-pointer rounded -mx-1 px-1 hover:bg-secondary/40"
                  >
                    <Clock size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">שעה:</span>
                    <span className="flex-1">
                      {new Date(meeting.scheduled_at).toLocaleTimeString("he-IL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Edit size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                </>
              )}

              {/* Duration */}
              <div className="flex items-center gap-2 group min-h-[24px]">
                <Clock size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">משך:</span>
                {editingDuration ? (
                  <input
                    type="number"
                    min={1}
                    value={durationDraft}
                    onChange={e => setDurationDraft(e.target.value)}
                    autoFocus
                    onBlur={commitDuration}
                    onKeyDown={e => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingDuration(false);
                    }}
                    className="flex-1 px-2 py-0.5 text-sm border border-input rounded bg-background outline-none focus:ring-1 focus:ring-ring"
                  />
                ) : (
                  <div
                    onClick={() => { setDurationDraft(String(meeting.duration_minutes)); setEditingDuration(true); }}
                    className="flex-1 flex items-center gap-1 cursor-pointer rounded -mx-1 px-1 hover:bg-secondary/40"
                  >
                    <span className="flex-1">{meeting.duration_minutes} דקות</span>
                    <Edit size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                )}
              </div>

              {/* Type */}
              <div className="flex items-center gap-2">
                <Video size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">סוג:</span>
                <div className="relative flex-1">
                  <button
                    onClick={() => setShowSidebarTypePicker(!showSidebarTypePicker)}
                    className="text-right hover:bg-secondary/40 rounded -mx-1 px-1 w-full flex items-center justify-between gap-1 group"
                  >
                    <span>{type?.label}</span>
                    <Edit size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </button>
                  {showSidebarTypePicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSidebarTypePicker(false)} />
                      <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl shadow-xl py-1 w-48 z-50" dir="rtl">
                        {MEETING_TYPES.map(t => (
                          <button
                            key={t.value}
                            onClick={() => { update({ meeting_type: t.value as any }); setShowSidebarTypePicker(false); }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                              t.value === meeting.meeting_type && "bg-secondary/50 font-medium"
                            )}
                          >
                            <span className={t.color}>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Meeting Link */}
              <div className="flex items-center gap-2 group min-h-[24px]">
                <LinkIcon size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">קישור:</span>
                {editingUrl ? (
                  <input
                    value={urlDraft}
                    onChange={e => setUrlDraft(e.target.value)}
                    placeholder="https://..."
                    autoFocus
                    onBlur={commitUrl}
                    onKeyDown={e => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingUrl(false);
                    }}
                    dir="ltr"
                    className="flex-1 px-2 py-0.5 text-sm border border-input rounded bg-background outline-none focus:ring-1 focus:ring-ring"
                  />
                ) : (
                  <div
                    onClick={() => { setUrlDraft(meeting.meeting_url || ""); setEditingUrl(true); }}
                    className="flex-1 flex items-center gap-1 min-w-0 cursor-pointer rounded -mx-1 px-1 hover:bg-secondary/40"
                  >
                    {meeting.meeting_url ? (
                      <a
                        href={meeting.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-primary hover:underline truncate min-w-0 flex-1"
                        dir="ltr"
                      >
                        <ExternalLink size={11} className="shrink-0" />
                        <span className="truncate">{meeting.meeting_url}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground/50 flex-1">—</span>
                    )}
                    <Edit size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                  </div>
                )}
              </div>

              {/* Created (read-only) */}
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">נוצר:</span>
                <span>
                  {new Date(meeting.created_at).toLocaleDateString("he-IL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  {new Date(meeting.created_at).toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Card */}
          {meeting.contact && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3">ליד / תלמיד</h3>
              <div
                onClick={() => navigate(`/contacts/${meeting.contact!.id}`)}
                className="p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
              >
                <p className="text-sm font-medium">
                  {meeting.contact.first_name} {meeting.contact.last_name}
                </p>
                {meeting.contact.email && (
                  <p className="text-xs text-muted-foreground mt-0.5">{meeting.contact.email}</p>
                )}
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

          {/* Recording Downloads */}
          {(meeting.recording_url || meeting.transcript_text) && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3">הקלטה</h3>
              <div className="space-y-2">
                {meeting.recording_url && (
                  <a
                    href={meeting.recording_url}
                    download
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-input hover:bg-secondary transition-colors"
                  >
                    <Download size={14} />
                    הורד הקלטה
                  </a>
                )}
                {meeting.transcript_text && (
                  <button
                    onClick={() => {
                      const blob = new Blob([meeting.transcript_text!], { type: "text/plain;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `transcript-${meeting.title || meeting.id}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-input hover:bg-secondary transition-colors w-full"
                  >
                    <Download size={14} />
                    הורד תמלול
                  </button>
                )}
              </div>
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

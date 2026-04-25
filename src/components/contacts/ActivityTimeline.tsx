import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Phone, Mail, MessageCircle, Calendar, StickyNote, ArrowLeftRight,
  Settings, MessageSquare, Plus, Send, ChevronDown, CheckSquare, X,
  Video, ExternalLink, FileText, Sparkles, Download, Copy, FileSignature,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useActivities, useCreateActivity } from "@/hooks/useActivities";
import { useCreateTask } from "@/hooks/useTasks";
import { useContact } from "@/hooks/useContacts";
import { useAuth } from "@/contexts/AuthContext";
import { sendEmail } from "@/lib/email-api";
import { wrapInBrandTemplate } from "@/lib/email-templates";
import { ACTIVITY_TYPES, TASK_PRIORITIES } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

interface ActivityTimelineProps {
  contactId: string;
  dealId?: string;
}

const ICON_MAP: Record<string, any> = {
  note: StickyNote, call: Phone, email: Mail, meeting: Calendar,
  whatsapp: MessageCircle, sms: MessageSquare, stage_change: ArrowLeftRight, system: Settings,
};

const COLOR_MAP: Record<string, string> = {
  note: "bg-yellow-100 text-yellow-600",
  call: "bg-green-100 text-green-600",
  email: "bg-red-100 text-red-600",
  meeting: "bg-blue-100 text-blue-600",
  whatsapp: "bg-emerald-100 text-emerald-600",
  sms: "bg-cyan-100 text-cyan-600",
  stage_change: "bg-orange-100 text-orange-600",
  system: "bg-gray-100 text-gray-400",
};

type ActionType = "note" | "call" | "email" | "task";

export default function ActivityTimeline({ contactId, dealId }: ActivityTimelineProps) {
  const { data: activities, isLoading } = useActivities({ contact_id: contactId, deal_id: dealId });
  const { data: contact } = useContact(contactId);
  const { teamMember } = useAuth();
  const createActivity = useCreateActivity();
  const createTask = useCreateTask();
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [showAll, setShowAll] = useState(false);

  // Email composer state
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // Task state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueDate, setTaskDueDate] = useState("");

  const resetForm = () => {
    setText(""); setSubject(""); setActiveAction(null);
    setEmailTo(""); setEmailSubject(""); setEmailBody("");
    setTaskTitle(""); setTaskPriority("medium"); setTaskDueDate("");
  };

  const handleSubmitNote = async () => {
    if (!text.trim()) return;
    await createActivity.mutateAsync({
      contact_id: contactId,
      deal_id: dealId || null,
      type: "note",
      body: text,
      performed_by: teamMember?.id || null,
    });
    resetForm();
  };

  const handleSubmitCall = async () => {
    if (!text.trim()) return;
    await createActivity.mutateAsync({
      contact_id: contactId,
      deal_id: dealId || null,
      type: "call",
      direction,
      subject: subject || null,
      body: text,
      performed_by: teamMember?.id || null,
    });
    resetForm();
  };

  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSubmitEmail = async () => {
    if (!emailBody.trim() || !emailSubject.trim()) return;
    const recipient = emailTo || contact?.email;
    if (!recipient) {
      toast.error("לא נמצא מייל לאיש הקשר");
      return;
    }

    setSendingEmail(true);
    try {
      // Send via Resend through the backend
      await sendEmail({
        tenantId: teamMember?.tenant_id || "",
        to: recipient,
        subject: emailSubject,
        html: wrapInBrandTemplate(emailBody, contact?.first_name),
        contactId,
        dealId: dealId || undefined,
      });
      toast.success("מייל נשלח בהצלחה");
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "שגיאה בשליחת מייל");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSubmitTask = async () => {
    if (!taskTitle.trim()) return;
    await createTask.mutateAsync({
      title: taskTitle,
      contact_id: contactId,
      deal_id: dealId || null,
      type: "task",
      priority: taskPriority as any,
      status: "pending",
      due_date: taskDueDate ? new Date(taskDueDate).toISOString() : null,
    } as any);
    toast.success("משימה נוצרה");
    resetForm();
  };

  const displayed = showAll ? activities : activities?.slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Quick action buttons */}
      <div className="flex gap-2 flex-wrap">
        {([
          { type: "note" as const, label: "הערה", icon: StickyNote },
          { type: "call" as const, label: "שיחה", icon: Phone },
          { type: "email" as const, label: "מייל", icon: Mail },
        ]).map(action => (
          <button
            key={action.type}
            onClick={() => setActiveAction(activeAction === action.type ? null : action.type)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
              activeAction === action.type
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-secondary text-muted-foreground"
            )}
          >
            <action.icon size={13} />
            {action.label}
          </button>
        ))}
      </div>

      {/* ── Note form ── */}
      {activeAction === "note" && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">הערה חדשה</h4>
            <button onClick={resetForm} className="p-1 rounded hover:bg-secondary text-muted-foreground"><X size={14} /></button>
          </div>
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            placeholder="כתוב הערה..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring/50 resize-none"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitNote(); }}
          />
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary">ביטול</button>
            <button onClick={handleSubmitNote} disabled={!text.trim() || createActivity.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
              <Send size={12} /> שמור
            </button>
          </div>
        </div>
      )}

      {/* ── Call form ── */}
      {activeAction === "call" && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">תיעוד שיחה</h4>
            <div className="flex items-center gap-2">
              <div className="flex border border-border rounded-lg overflow-hidden text-xs">
                <button onClick={() => setDirection("outbound")} className={cn("px-2.5 py-1", direction === "outbound" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}>יוצאת</button>
                <button onClick={() => setDirection("inbound")} className={cn("px-2.5 py-1", direction === "inbound" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}>נכנסת</button>
              </div>
              <button onClick={resetForm} className="p-1 rounded hover:bg-secondary text-muted-foreground"><X size={14} /></button>
            </div>
          </div>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="נושא השיחה..."
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring/50" />
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="סיכום השיחה..." rows={3}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring/50 resize-none"
            autoFocus onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitCall(); }} />
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary">ביטול</button>
            <button onClick={handleSubmitCall} disabled={!text.trim() || createActivity.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
              <Send size={12} /> שמור
            </button>
          </div>
        </div>
      )}

      {/* ── Email composer ── */}
      {activeAction === "email" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-blue-50/50">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-blue-600" />
              <h4 className="text-sm font-semibold text-blue-900">שליחת מייל</h4>
            </div>
            <button onClick={resetForm} className="p-1 rounded hover:bg-blue-100 text-blue-400"><X size={14} /></button>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">אל:</span>
              <input value={emailTo || contact?.email || ""} onChange={e => setEmailTo(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 px-3 py-1.5 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring/50" dir="ltr" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">נושא:</span>
              <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                placeholder="נושא המייל..."
                className="flex-1 px-3 py-1.5 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring/50" autoFocus />
            </div>
            <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
              placeholder="תוכן המייל..."
              rows={6}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring/50 resize-none"
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitEmail(); }} />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Ctrl+Enter לשליחה</p>
              <div className="flex gap-2">
                <button onClick={resetForm} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary">ביטול</button>
                <button onClick={handleSubmitEmail} disabled={!emailSubject.trim() || !emailBody.trim() || sendingEmail}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {sendingEmail ? <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={12} />}
                  {sendingEmail ? "שולח..." : "שלח מייל"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Task form ── */}
      {activeAction === "task" && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare size={14} className="text-primary" />
              <h4 className="text-sm font-semibold">משימה חדשה</h4>
            </div>
            <button onClick={resetForm} className="p-1 rounded hover:bg-secondary text-muted-foreground"><X size={14} /></button>
          </div>
          <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="מה צריך לעשות?"
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring/50" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">עדיפות</label>
              <Select value={taskPriority} onValueChange={setTaskPriority}>
                <SelectTrigger className="w-full px-3 py-1.5 text-sm border border-input rounded-lg bg-background outline-none">
                  <SelectValue placeholder="בחר עדיפות" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">תאריך יעד</label>
              <DatePicker value={taskDueDate} onChange={setTaskDueDate}
                className="w-full px-3 py-1.5 text-sm border border-input rounded-lg bg-background outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary">ביטול</button>
            <button onClick={handleSubmitTask} disabled={!taskTitle.trim() || createTask.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
              <Plus size={12} /> צור משימה
            </button>
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-secondary rounded w-1/3" />
                <div className="h-3 bg-secondary rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : displayed && displayed.length > 0 ? (
        <div className="relative">
          {displayed.length > 1 && (
            <div className="absolute top-4 bottom-4 right-[15px] w-[2px] bg-border" />
          )}
          <div className="space-y-4">
            {displayed.map(activity => {
              const isFireflies = activity.metadata?.source === "fireflies";
              const isContractSigned = activity.metadata?.event === "contract_signed";
              const Icon = isFireflies ? Video : isContractSigned ? FileSignature : (ICON_MAP[activity.type] || Settings);
              const colorCls = isFireflies
                ? "bg-purple-100 text-purple-600"
                : isContractSigned
                  ? "bg-green-100 text-green-600"
                  : (COLOR_MAP[activity.type] || COLOR_MAP.system);
              const actLabel = isFireflies
                ? "הקלטת פגישה"
                : isContractSigned
                  ? "חוזה"
                  : ACTIVITY_TYPES.find(t => t.value === activity.type)?.label;
              const meta = activity.metadata || {};
              return (
                <div key={activity.id} className="flex gap-3 relative">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10", colorCls)}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{actLabel}</span>
                      {isFireflies && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">
                          Fireflies
                        </span>
                      )}
                      {activity.direction && !isFireflies && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                          {activity.direction === "outbound" ? "יוצא" : "נכנס"}
                        </span>
                      )}
                      {activity.subject && (
                        <span className="text-sm text-muted-foreground">— {activity.subject}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1.5">
                        {activity.performer && activity.type !== "system" && (
                          <>
                            {activity.performer.avatar_url ? (
                              <img src={activity.performer.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">
                                {activity.performer.display_name?.charAt(0)}
                              </span>
                            )}
                            <span className="font-medium text-foreground/70">{activity.performer.display_name}</span>
                          </>
                        )}
                        {formatDateTime(activity.performed_at)}
                      </span>
                      {isContractSigned && (
                        <div className="flex items-center gap-1 shrink-0">
                          {meta.contract_id && (
                            <Link
                              to={`/contracts/${meta.contract_id}`}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-green-50 hover:bg-green-100 text-green-700 border border-green-200/60 transition-colors"
                              title="פתח רשומת חוזה"
                            >
                              <ExternalLink size={11} />
                              חוזה
                            </Link>
                          )}
                          {meta.signed_pdf_url && (
                            <a
                              href={meta.signed_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-green-50 hover:bg-green-100 text-green-700 border border-green-200/60 transition-colors"
                              title="צפייה / הורדה של החוזה החתום"
                            >
                              <Download size={11} />
                              PDF
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Fireflies — full card with mini player, summary, transcript */}
                    {isFireflies ? (
                      <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
                        {/* Mini video player */}
                        {meta.recording_url && (
                          <div className="relative bg-black rounded-t-xl overflow-hidden">
                            <video
                              src={meta.recording_url}
                              controls
                              preload="metadata"
                              className="w-full max-h-52 object-contain"
                              controlsList="nodownload"
                              playsInline
                            />
                          </div>
                        )}

                        <div className="p-4 space-y-3">
                          {/* AI Summary + Homework */}
                          {activity.body && (() => {
                            const hwIndex = activity.body.indexOf("שיעורי בית:");
                            const summaryPart = hwIndex > -1 ? activity.body.slice(0, hwIndex).trim() : activity.body;
                            const hwPart = hwIndex > -1 ? activity.body.slice(hwIndex + "שיעורי בית:".length).trim() : "";
                            return (
                              <>
                                <div>
                                  <p className="text-[11px] font-semibold text-purple-600 mb-1.5 flex items-center gap-1">
                                    <Sparkles size={11} className="text-purple-400" /> סיכום AI
                                  </p>
                                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{summaryPart}</p>
                                </div>
                                {hwPart && (
                                  <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <p className="text-[11px] font-semibold text-purple-600">שיעורי בית:</p>
                                      <button
                                        onClick={() => { navigator.clipboard.writeText("שיעורי בית:\n" + hwPart); toast.success("שיעורי בית הועתקו"); }}
                                        className="flex items-center gap-1 text-[10px] text-purple-500 hover:text-purple-700 transition-colors"
                                      >
                                        <Copy size={10} /> העתק
                                      </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{hwPart}</p>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {/* Footer links */}
                          <div className="flex items-center flex-wrap gap-3 pt-2 border-t border-border">
                            {meta.transcript_url && (
                              <a href={meta.transcript_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[11px] text-purple-600 hover:text-purple-700 hover:underline">
                                <ExternalLink size={11} /> פתח ב-Fireflies
                              </a>
                            )}
                            {meta.recording_url && (
                              <a href={meta.recording_url} download
                                className="flex items-center gap-1.5 text-[11px] text-purple-600 hover:text-purple-700 hover:underline">
                                <Download size={11} /> הורד הקלטה
                              </a>
                            )}
                            {meta.fireflies_meeting_id && teamMember?.tenant_id && (
                              <a href={`${import.meta.env.VITE_WEBHOOK_BACKEND_URL || import.meta.env.VITE_BACKEND_URL || ""}/api/webhooks/fireflies/${teamMember.tenant_id}/transcript/${meta.fireflies_meeting_id}`}
                                className="flex items-center gap-1.5 text-[11px] text-purple-600 hover:text-purple-700 hover:underline">
                                <FileText size={11} /> הורד תמלול
                              </a>
                            )}
                            {meta.duration_minutes > 0 && (
                              <span className="text-[10px] text-muted-foreground ml-auto">{meta.duration_minutes} דק׳</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Regular activity body — structured for form submissions */
                      activity.body && (
                        <ActivityBody body={activity.body} metadata={activity.metadata} />
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {activities && activities.length > 10 && !showAll && (
            <button onClick={() => setShowAll(true)}
              className="flex items-center gap-1.5 mx-auto mt-4 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg">
              <ChevronDown size={14} /> הצג עוד {activities.length - 10} פעילויות
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">
          אין פעילות עדיין. הוסף הערה או תעד שיחה.
        </p>
      )}
    </div>
  );
}

// ── Structured activity body ──
function ActivityBody({ body, metadata }: { body: string; metadata?: Record<string, any> }) {
  // Parse sections: lines starting with "פרטי הטופס:" or "שיוך:" create sections
  const lines = body.split("\n");
  const sections: { title: string | null; lines: string[] }[] = [];
  let current: { title: string | null; lines: string[] } = { title: null, lines: [] };

  for (const line of lines) {
    if (line === "פרטי הטופס:" || line === "שיוך:") {
      if (current.lines.length > 0 || current.title) sections.push(current);
      current = { title: line.replace(":", ""), lines: [] };
    } else if (line.trim()) {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0 || current.title) sections.push(current);

  // If no sections detected, just show plain text
  if (sections.length <= 1 && !sections[0]?.title) {
    return <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{body}</p>;
  }

  return (
    <div className="mt-1.5 space-y-2">
      {sections.map((section, i) => (
        <div key={i}>
          {!section.title && section.lines.map((line, j) => (
            <p key={j} className="text-xs text-muted-foreground">{line}</p>
          ))}
          {section.title && (
            <div className="bg-muted/30 rounded-lg p-2.5 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">{section.title}</p>
              {section.lines.map((line, j) => {
                const colonIdx = line.indexOf(":");
                if (colonIdx > 0 && colonIdx < 20) {
                  const label = line.substring(0, colonIdx).trim();
                  const value = line.substring(colonIdx + 1).trim();
                  return (
                    <div key={j} className="flex text-xs gap-2">
                      <span className="text-muted-foreground shrink-0 min-w-[60px]">{label}</span>
                      <span className="font-medium text-foreground break-all" dir={/^[a-zA-Z0-9]/.test(value) ? "ltr" : undefined}>{value}</span>
                    </div>
                  );
                }
                return <p key={j} className="text-xs text-muted-foreground">{line}</p>;
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

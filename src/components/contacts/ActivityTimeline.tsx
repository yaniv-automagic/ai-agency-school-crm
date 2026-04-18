import { useState } from "react";
import {
  Phone, Mail, MessageCircle, Calendar, StickyNote, ArrowLeftRight,
  Settings, MessageSquare, Plus, Send, ChevronDown, CheckSquare, X,
} from "lucide-react";
import { useActivities, useCreateActivity } from "@/hooks/useActivities";
import { useCreateTask } from "@/hooks/useTasks";
import { useContact } from "@/hooks/useContacts";
import { ACTIVITY_TYPES, TASK_PRIORITIES } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
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
  note: "bg-gray-100 text-gray-500",
  call: "bg-green-100 text-green-600",
  email: "bg-blue-100 text-blue-600",
  meeting: "bg-purple-100 text-purple-600",
  whatsapp: "bg-emerald-100 text-emerald-600",
  sms: "bg-cyan-100 text-cyan-600",
  stage_change: "bg-orange-100 text-orange-600",
  system: "bg-gray-100 text-gray-400",
};

type ActionType = "note" | "call" | "email" | "task";

export default function ActivityTimeline({ contactId, dealId }: ActivityTimelineProps) {
  const { data: activities, isLoading } = useActivities({ contact_id: contactId, deal_id: dealId });
  const { data: contact } = useContact(contactId);
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
    });
    resetForm();
  };

  const handleSubmitEmail = async () => {
    if (!emailBody.trim() || !emailSubject.trim()) return;
    // Log the email as activity
    await createActivity.mutateAsync({
      contact_id: contactId,
      deal_id: dealId || null,
      type: "email",
      direction: "outbound",
      subject: emailSubject,
      body: emailBody,
      metadata: { to: emailTo || contact?.email, sent_via: "crm" },
    });
    // TODO: Actually send email via Resend when backend is configured
    toast.success("מייל נשמר בטיימליין");
    resetForm();
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
          { type: "task" as const, label: "משימה", icon: CheckSquare },
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
                <button onClick={handleSubmitEmail} disabled={!emailSubject.trim() || !emailBody.trim() || createActivity.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Send size={12} /> שלח מייל
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
              <select value={taskPriority} onChange={e => setTaskPriority(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-input rounded-lg bg-background outline-none">
                {TASK_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">תאריך יעד</label>
              <input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)}
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
          <div className="absolute top-0 bottom-0 right-[15px] w-[2px] bg-border" />
          <div className="space-y-4">
            {displayed.map(activity => {
              const Icon = ICON_MAP[activity.type] || Settings;
              const colorCls = COLOR_MAP[activity.type] || COLOR_MAP.system;
              const actLabel = ACTIVITY_TYPES.find(t => t.value === activity.type)?.label;
              return (
                <div key={activity.id} className="flex gap-3 relative">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10", colorCls)}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{actLabel}</span>
                      {activity.direction && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                          {activity.direction === "outbound" ? "יוצא" : "נכנס"}
                        </span>
                      )}
                      {activity.subject && (
                        <span className="text-sm text-muted-foreground">— {activity.subject}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground mr-auto">{timeAgo(activity.performed_at)}</span>
                    </div>
                    {activity.body && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{activity.body}</p>
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

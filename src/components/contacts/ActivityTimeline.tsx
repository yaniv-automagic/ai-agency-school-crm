import { useState } from "react";
import {
  Phone, Mail, MessageCircle, Calendar, StickyNote, ArrowLeftRight,
  Settings, MessageSquare, Plus, Send, ChevronDown,
} from "lucide-react";
import { useActivities, useCreateActivity } from "@/hooks/useActivities";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";

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

const QUICK_ACTIONS = [
  { type: "note", label: "הערה", icon: StickyNote, placeholder: "כתוב הערה..." },
  { type: "call", label: "שיחה", icon: Phone, placeholder: "סיכום השיחה..." },
  { type: "email", label: "מייל", icon: Mail, placeholder: "סיכום המייל..." },
  { type: "meeting", label: "פגישה", icon: Calendar, placeholder: "סיכום הפגישה..." },
] as const;

export default function ActivityTimeline({ contactId, dealId }: ActivityTimelineProps) {
  const { data: activities, isLoading } = useActivities({ contact_id: contactId, deal_id: dealId });
  const createActivity = useCreateActivity();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [showAll, setShowAll] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || !activeAction) return;
    await createActivity.mutateAsync({
      contact_id: contactId,
      deal_id: dealId || null,
      type: activeAction as any,
      direction: ["call", "email", "whatsapp", "sms"].includes(activeAction) ? direction : null,
      subject: subject || null,
      body: text,
    });
    setText("");
    setSubject("");
    setActiveAction(null);
  };

  const displayed = showAll ? activities : activities?.slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Quick action buttons */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_ACTIONS.map(action => (
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

      {/* Quick input form */}
      {activeAction && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-semibold flex-1">
              {QUICK_ACTIONS.find(a => a.type === activeAction)?.label} חדשה
            </h4>
            {["call", "email", "whatsapp", "sms"].includes(activeAction) && (
              <div className="flex border border-border rounded-lg overflow-hidden text-xs">
                <button
                  onClick={() => setDirection("outbound")}
                  className={cn("px-2.5 py-1", direction === "outbound" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
                >
                  יוצא
                </button>
                <button
                  onClick={() => setDirection("inbound")}
                  className={cn("px-2.5 py-1", direction === "inbound" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
                >
                  נכנס
                </button>
              </div>
            )}
          </div>

          {["call", "email", "meeting"].includes(activeAction) && (
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="נושא..."
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring/50"
            />
          )}

          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={QUICK_ACTIONS.find(a => a.type === activeAction)?.placeholder}
              rows={2}
              className="flex-1 px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring/50 resize-none"
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">Ctrl+Enter לשליחה</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setActiveAction(null); setText(""); setSubject(""); }}
                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary"
              >
                ביטול
              </button>
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || createActivity.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                <Send size={12} />
                שמור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
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
          {/* Vertical line */}
          <div className="absolute top-0 bottom-0 right-[15px] w-[2px] bg-border" />

          <div className="space-y-4">
            {displayed.map((activity, idx) => {
              const Icon = ICON_MAP[activity.type] || Settings;
              const colorCls = COLOR_MAP[activity.type] || COLOR_MAP.system;
              const actLabel = ACTIVITY_TYPES.find(t => t.value === activity.type)?.label;

              return (
                <div key={activity.id} className="flex gap-3 relative">
                  {/* Icon */}
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10", colorCls)}>
                    <Icon size={14} />
                  </div>

                  {/* Content */}
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

          {/* Show more */}
          {activities && activities.length > 10 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="flex items-center gap-1.5 mx-auto mt-4 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg"
            >
              <ChevronDown size={14} />
              הצג עוד {activities.length - 10} פעילויות
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

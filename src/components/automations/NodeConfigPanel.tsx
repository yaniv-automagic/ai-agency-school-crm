import { useState } from "react";
import { X, Save } from "lucide-react";
import type { WorkflowNode } from "@/components/ui/workflow-canvas";

interface Props {
  node: WorkflowNode;
  onSave: (config: Record<string, any>, title?: string, description?: string) => void;
  onClose: () => void;
}

export default function NodeConfigPanel({ node, onSave, onClose }: Props) {
  const [config, setConfig] = useState<Record<string, any>>(node.config || {});
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description);

  const set = (k: string, v: any) => setConfig(p => ({ ...p, [k]: v }));

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all";

  return (
    <div className="absolute bottom-0 inset-x-0 z-40" dir="rtl">
      {/* Scrim */}
      <div className="absolute inset-0 -top-20 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />

      {/* Panel */}
      <div className="relative bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] rounded-t-3xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              node.color === "emerald" ? "bg-emerald-100 text-emerald-600" :
              node.color === "blue" ? "bg-blue-100 text-blue-600" :
              node.color === "green" ? "bg-green-100 text-green-600" :
              node.color === "violet" || node.color === "purple" ? "bg-violet-100 text-violet-600" :
              node.color === "amber" ? "bg-amber-100 text-amber-600" :
              node.color === "indigo" ? "bg-indigo-100 text-indigo-600" :
              node.color === "pink" ? "bg-pink-100 text-pink-600" :
              "bg-gray-100 text-gray-600"
            }`}>
              <node.icon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">הגדרות: {node.title}</h3>
              <p className="text-[11px] text-gray-400">לחץ שמור לאישור השינויים</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSave(config, title, description)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Save size={13} />
              שמור
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 max-h-[250px] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Basic */}
            <div className="space-y-2.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">כותרת</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">תיאור</label>
              <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
            </div>

            {/* Type-specific */}
            <div className="sm:col-span-1 lg:col-span-2 space-y-2.5">
              {/* Trigger */}
              {node.type === "trigger" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">אובייקט</label>
                    <select value={config.object_type || "contacts"} onChange={e => set("object_type", e.target.value)} className={inputCls}>
                      <option value="contacts">לידים</option>
                      <option value="deals">עסקאות</option>
                      <option value="tasks">משימות</option>
                    </select>
                  </div>
                  {node.title.includes("מתוזמן") && (
                    <>
                      <div>
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">תדירות</label>
                        <select value={config.frequency || "daily"} onChange={e => set("frequency", e.target.value)} className={inputCls}>
                          <option value="daily">כל יום</option>
                          <option value="weekly">כל שבוע</option>
                          <option value="monthly">כל חודש</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">שעה</label>
                        <input type="time" value={config.time || "09:00"} onChange={e => set("time", e.target.value)} className={inputCls} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Email */}
              {node.type === "action" && node.title.includes("מייל") && (
                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">נושא המייל</label>
                    <input value={config.subject || ""} onChange={e => set("subject", e.target.value)} className={inputCls} placeholder="שלום {{first_name}}..." />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">תוכן</label>
                    <textarea value={config.body || ""} onChange={e => set("body", e.target.value)} rows={2} className={inputCls + " resize-none"} placeholder="תוכן המייל..." />
                  </div>
                </div>
              )}

              {/* WhatsApp */}
              {node.type === "action" && node.title.includes("WhatsApp") && (
                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Template</label>
                    <input value={config.template_name || ""} onChange={e => set("template_name", e.target.value)} className={inputCls} dir="ltr" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">הודעה</label>
                    <textarea value={config.message || ""} onChange={e => set("message", e.target.value)} rows={2} className={inputCls + " resize-none"} placeholder="שלום {{שם}}..." />
                  </div>
                </div>
              )}

              {/* Update record */}
              {node.type === "action" && node.title.includes("עדכן") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">שדה</label>
                    <input value={config.field || ""} onChange={e => set("field", e.target.value)} className={inputCls} placeholder="status" dir="ltr" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">ערך</label>
                    <input value={config.value || ""} onChange={e => set("value", e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}

              {/* Tag */}
              {node.type === "action" && node.title.includes("תגית") && (
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">תגית</label>
                  <input value={config.tag || ""} onChange={e => set("tag", e.target.value)} className={inputCls} placeholder="lead-hot" />
                </div>
              )}

              {/* Task */}
              {node.type === "action" && node.title.includes("משימה") && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">כותרת</label>
                    <input value={config.task_title || ""} onChange={e => set("task_title", e.target.value)} className={inputCls} placeholder="לחזור ל-{{first_name}}" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">עדיפות</label>
                    <select value={config.priority || "medium"} onChange={e => set("priority", e.target.value)} className={inputCls}>
                      <option value="low">נמוכה</option><option value="medium">בינונית</option><option value="high">גבוהה</option><option value="urgent">דחוף</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">יעד (ימים)</label>
                    <input type="number" value={config.due_days || 1} onChange={e => set("due_days", +e.target.value)} className={inputCls} min={0} />
                  </div>
                </div>
              )}

              {/* Webhook */}
              {node.type === "action" && node.title.includes("Webhook") && (
                <div className="flex gap-3">
                  <div className="w-24 shrink-0">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Method</label>
                    <select value={config.method || "POST"} onChange={e => set("method", e.target.value)} className={inputCls}>
                      <option>POST</option><option>GET</option><option>PUT</option><option>PATCH</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">URL</label>
                    <input value={config.url || ""} onChange={e => set("url", e.target.value)} className={inputCls} dir="ltr" placeholder="https://..." />
                  </div>
                </div>
              )}

              {/* Notification */}
              {node.type === "action" && node.title.includes("התראה") && (
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">הודעה</label>
                  <input value={config.message || ""} onChange={e => set("message", e.target.value)} className={inputCls} placeholder="ליד חדש: {{first_name}}" />
                </div>
              )}

              {/* Condition */}
              {node.type === "condition" && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">שדה</label>
                    <input value={config.field || ""} onChange={e => set("field", e.target.value)} className={inputCls} dir="ltr" placeholder="status" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">אופרטור</label>
                    <select value={config.operator || "eq"} onChange={e => set("operator", e.target.value)} className={inputCls}>
                      <option value="eq">שווה</option><option value="ne">שונה</option><option value="contains">מכיל</option><option value="gt">גדול מ</option><option value="lt">קטן מ</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">ערך</label>
                    <input value={config.value || ""} onChange={e => set("value", e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}

              {/* Delay */}
              {node.type === "delay" && (
                <div className="flex gap-3 items-end">
                  <div className="w-20">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">משך</label>
                    <input type="number" value={config.duration || 1} onChange={e => set("duration", +e.target.value)} className={inputCls} min={1} />
                  </div>
                  <div className="w-28">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">יחידה</label>
                    <select value={config.unit || "hours"} onChange={e => set("unit", e.target.value)} className={inputCls}>
                      <option value="minutes">דקות</option><option value="hours">שעות</option><option value="days">ימים</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

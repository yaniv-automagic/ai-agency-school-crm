import { useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { X, Tag, UserCheck, Trash2, Download, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePipelines } from "@/hooks/useDeals";

interface BulkActionsProps {
  selectedIds: string[];
  onClear: () => void;
  totalCount: number;
}

export default function BulkActions({ selectedIds, onClear, totalCount }: BulkActionsProps) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: pipelines } = usePipelines();
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagValue, setTagValue] = useState("");
  const [loading, setLoading] = useState(false);

  const allStages = pipelines?.flatMap(p => p.stages || []) || [];

  const count = selectedIds.length;

  const updateStage = async (stageId: string) => {
    setLoading(true);
    const stageName = allStages.find(s => s.id === stageId)?.name;
    const { error } = await supabase
      .from("crm_contacts")
      .update({ stage_id: stageId, updated_at: new Date().toISOString() })
      .in("id", selectedIds);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${count} לידים עודכנו ל-"${stageName}"`);
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    setShowStatusPicker(false);
    onClear();
  };

  const addTag = async () => {
    if (!tagValue.trim()) return;
    setLoading(true);
    const { data: contacts } = await supabase
      .from("crm_contacts")
      .select("id, tags")
      .in("id", selectedIds);

    if (contacts) {
      for (const c of contacts) {
        const currentTags = c.tags || [];
        if (!currentTags.includes(tagValue.trim())) {
          await supabase.from("crm_contacts")
            .update({ tags: [...currentTags, tagValue.trim()], updated_at: new Date().toISOString() })
            .eq("id", c.id);
        }
      }
    }

    setLoading(false);
    toast.success(`תגית "${tagValue}" נוספה ל-${count} לידים`);
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    setTagValue("");
    setShowTagInput(false);
    onClear();
  };

  const deleteSelected = async () => {
    const confirmed = await confirm({
      title: "מחיקה המונית",
      description: `למחוק ${count} לידים? פעולה זו לא ניתנת לביטול.`,
      confirmText: "מחק",
      cancelText: "ביטול",
      variant: "destructive",
    });
    if (!confirmed) return;
    setLoading(true);
    const { error } = await supabase.from("crm_contacts").delete().in("id", selectedIds);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${count} לידים נמחקו`);
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    onClear();
  };

  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-2xl shadow-2xl">
        {/* Count */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/20">
          <Users size={15} />
          <span className="text-sm font-semibold">{count}</span>
          <span className="text-xs text-white/60">נבחרו</span>
        </div>

        {/* Stage */}
        <div className="relative">
          <button
            onClick={() => { setShowStatusPicker(!showStatusPicker); setShowTagInput(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-white/10 transition-colors"
          >
            <UserCheck size={13} />
            שנה שלב
          </button>
          {showStatusPicker && (
            <div className="absolute bottom-full mb-2 right-0 bg-white text-gray-900 rounded-xl shadow-xl border border-gray-200 py-1 w-48 max-h-72 overflow-y-auto" dir="rtl">
              {pipelines?.map(pipeline => (
                <div key={pipeline.id}>
                  {pipelines.length > 1 && (
                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">
                      {pipeline.name}
                    </div>
                  )}
                  {pipeline.stages?.map(s => (
                    <button
                      key={s.id}
                      onClick={() => updateStage(s.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-right"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || "#6b7280" }} />
                      {s.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tag */}
        <div className="relative">
          <button
            onClick={() => { setShowTagInput(!showTagInput); setShowStatusPicker(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-white/10 transition-colors"
          >
            <Tag size={13} />
            הוסף תגית
          </button>
          {showTagInput && (
            <div className="absolute bottom-full mb-2 right-0 bg-white text-gray-900 rounded-xl shadow-xl border border-gray-200 p-3 w-52" dir="rtl">
              <div className="flex gap-2">
                <input
                  value={tagValue}
                  onChange={e => setTagValue(e.target.value)}
                  placeholder="שם התגית..."
                  className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && addTag()}
                />
                <button onClick={addTag} disabled={!tagValue.trim()} className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg disabled:opacity-50">
                  הוסף
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={deleteSelected}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-red-500/20 text-red-300 transition-colors"
        >
          <Trash2 size={13} />
          מחק
        </button>

        {/* Close */}
        <button onClick={onClear} className="p-1.5 rounded-full hover:bg-white/10 transition-colors mr-1">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

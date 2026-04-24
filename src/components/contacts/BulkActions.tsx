import { useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { X, Tag, Kanban, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePipelines } from "@/hooks/useDeals";
import { cn } from "@/lib/utils";

interface BulkActionsProps {
  selectedIds: string[];
  onClear: () => void;
  totalCount: number;
}

export default function BulkActions({ selectedIds, onClear }: BulkActionsProps) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: pipelines } = usePipelines();
  const [openMenu, setOpenMenu] = useState<"stage" | "tag" | null>(null);
  const [tagValue, setTagValue] = useState("");
  const [loading, setLoading] = useState(false);

  const allStages = pipelines?.flatMap((p) => p.stages || []) || [];
  const count = selectedIds.length;

  const closeMenus = () => setOpenMenu(null);

  const updateStage = async (stageId: string) => {
    setLoading(true);
    const stageName = allStages.find((s) => s.id === stageId)?.name;
    const { error } = await supabase
      .from("crm_contacts")
      .update({ stage_id: stageId, updated_at: new Date().toISOString() })
      .in("id", selectedIds);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${count} לידים עודכנו ל-"${stageName}"`);
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    closeMenus();
    onClear();
  };

  const addTag = async () => {
    if (!tagValue.trim()) return;
    setLoading(true);
    const { data: contacts } = await supabase.from("crm_contacts").select("id, tags").in("id", selectedIds);

    if (contacts) {
      for (const c of contacts) {
        const currentTags = c.tags || [];
        if (!currentTags.includes(tagValue.trim())) {
          await supabase
            .from("crm_contacts")
            .update({ tags: [...currentTags, tagValue.trim()], updated_at: new Date().toISOString() })
            .eq("id", c.id);
        }
      }
    }

    setLoading(false);
    toast.success(`תגית "${tagValue}" נוספה ל-${count} לידים`);
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    setTagValue("");
    closeMenus();
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
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${count} לידים נמחקו`);
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    onClear();
  };

  if (count === 0) return null;

  return (
    <>
      {/* Backdrop to close open menus */}
      {openMenu && <div className="fixed inset-0 z-40" onClick={closeMenus} />}

      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        style={{ animation: "bulkBarIn 200ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        dir="rtl"
      >
        <style>{`
          @keyframes bulkBarIn {
            from { opacity: 0; transform: translate(-50%, 12px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
        `}</style>

        <div className="flex items-center gap-1 p-1.5 bg-card border border-border rounded-2xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.18)]">
          {/* Count */}
          <div className="flex items-center gap-2 pr-3 pl-2 h-9">
            <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {count}
            </span>
            <span className="text-sm text-muted-foreground">נבחרו</span>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Stage action */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === "stage" ? null : "stage")}
              disabled={loading}
              className={cn(
                "flex items-center gap-1.5 px-3 h-9 text-sm font-medium rounded-xl transition-colors text-foreground",
                openMenu === "stage" ? "bg-secondary" : "hover:bg-secondary/70",
              )}
            >
              <Kanban size={14} />
              שנה שלב
            </button>
            {openMenu === "stage" && (
              <div className="absolute bottom-full mb-2 right-0 bg-card border border-border rounded-xl shadow-xl py-1 w-52 max-h-72 overflow-y-auto z-50">
                {pipelines?.map((p) => (
                  <div key={p.id}>
                    {pipelines.length > 1 && (
                      <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40">
                        {p.name}
                      </div>
                    )}
                    {p.stages?.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => updateStage(s.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/70 text-right"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color || "#6b7280" }} />
                        <span className="truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tag action */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === "tag" ? null : "tag")}
              disabled={loading}
              className={cn(
                "flex items-center gap-1.5 px-3 h-9 text-sm font-medium rounded-xl transition-colors text-foreground",
                openMenu === "tag" ? "bg-secondary" : "hover:bg-secondary/70",
              )}
            >
              <Tag size={14} />
              הוסף תגית
            </button>
            {openMenu === "tag" && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-xl p-2 w-80 z-50" dir="rtl">
                <div className="flex items-center gap-1.5 bg-background border border-input rounded-lg focus-within:ring-2 focus-within:ring-ring transition-shadow overflow-hidden">
                  <Tag size={14} className="text-muted-foreground mr-3 shrink-0" />
                  <input
                    value={tagValue}
                    onChange={(e) => setTagValue(e.target.value)}
                    placeholder="שם התגית..."
                    className="flex-1 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && addTag()}
                  />
                  <button
                    onClick={addTag}
                    disabled={!tagValue.trim() || loading}
                    className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    הוסף
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Delete */}
          <button
            onClick={deleteSelected}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 h-9 text-sm font-medium rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={14} />
            מחק
          </button>

          {/* Close */}
          <button
            onClick={onClear}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-colors"
            aria-label="בטל בחירה"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  );
}

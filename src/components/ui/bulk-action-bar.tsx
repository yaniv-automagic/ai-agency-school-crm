import { useState } from "react";
import { X, Tag, Trash2, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
  /** Label for count: "X לידים נבחרו" */
  entityLabel: string;
  /** Custom buttons / dropdowns */
  children?: React.ReactNode;
}

// Floating bottom bar shell. Renders only when selection is non-empty.
export function BulkActionBar({ selectedIds, onClear, entityLabel, children }: BulkActionBarProps) {
  if (selectedIds.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200" dir="rtl">
      <div className="bg-card border border-border rounded-2xl shadow-2xl shadow-black/10 px-2 py-1.5 flex items-center gap-1">
        <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-xl text-sm font-medium text-primary">
          <span className="text-base font-bold">{selectedIds.length}</span>
          <span className="text-xs">{entityLabel} נבחרו</span>
        </div>

        <div className="w-px h-6 bg-border" />

        {children}

        <button
          onClick={onClear}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-colors"
          aria-label="בטל בחירה"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Reusable action buttons (used inside BulkActionBar children) ──

interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}

export function BulkActionButton({ icon: Icon, label, onClick, active, disabled, destructive }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 px-3 h-9 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : active
            ? "bg-secondary text-foreground"
            : "text-foreground hover:bg-secondary/70",
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

// ── Pre-built common actions ──

interface DeleteActionProps {
  selectedIds: string[];
  onCleared: () => void;
  tableName: string;
  /** React Query keys to invalidate after delete */
  invalidateKeys?: string[][];
  entityLabel: string;
}

export function BulkDeleteButton({ selectedIds, onCleared, tableName, invalidateKeys = [], entityLabel }: DeleteActionProps) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    const ok = await confirm({
      title: `מחיקת ${selectedIds.length} ${entityLabel}`,
      description: "פעולה זו לא ניתנת לביטול.",
      confirmText: "מחק",
      variant: "destructive",
    });
    if (!ok) return;
    setLoading(true);
    const { error } = await supabase.from(tableName).delete().in("id", selectedIds);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${selectedIds.length} ${entityLabel} נמחקו`);
    for (const k of invalidateKeys) queryClient.invalidateQueries({ queryKey: k });
    onCleared();
  };

  return <BulkActionButton icon={Trash2} label="מחק" onClick={handle} disabled={loading} destructive />;
}

interface TagActionProps {
  selectedIds: string[];
  onCleared: () => void;
  tableName: string; // table that has a `tags` text[] column
  invalidateKeys?: string[][];
  entityLabel: string;
}

export function BulkTagButton({ selectedIds, onCleared, tableName, invalidateKeys = [], entityLabel }: TagActionProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!tag.trim()) return;
    setLoading(true);
    const { data: rows } = await supabase.from(tableName).select("id, tags").in("id", selectedIds);
    if (rows) {
      await Promise.all(rows.map((r: any) => {
        const next = Array.from(new Set([...(r.tags || []), tag.trim()]));
        return supabase.from(tableName).update({ tags: next }).eq("id", r.id);
      }));
    }
    setLoading(false);
    toast.success(`התגית '${tag.trim()}' נוספה ל-${selectedIds.length} ${entityLabel}`);
    for (const k of invalidateKeys) queryClient.invalidateQueries({ queryKey: k });
    setTag(""); setOpen(false);
    onCleared();
  };

  return (
    <div className="relative">
      <BulkActionButton icon={Tag} label="הוסף תגית" onClick={() => setOpen(o => !o)} active={open} disabled={loading} />
      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-xl p-2 w-80 z-50" dir="rtl">
          <div className="flex items-center gap-1.5 bg-background border border-input rounded-lg focus-within:ring-2 focus-within:ring-ring transition-shadow overflow-hidden">
            <Tag size={14} className="text-muted-foreground mr-3 shrink-0" />
            <input
              value={tag}
              onChange={e => setTag(e.target.value)}
              placeholder="שם התגית..."
              className="flex-1 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              autoFocus
              onKeyDown={e => e.key === "Enter" && handle()}
            />
            <button
              onClick={handle}
              disabled={!tag.trim() || loading}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              הוסף
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

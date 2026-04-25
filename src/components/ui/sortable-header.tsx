import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/hooks/useSortable";

interface Props {
  /** Column id used for sort state */
  sortKey: string;
  /** Returns current sort direction for this key, or null if not active */
  isSorted: (key: string) => SortDir | null;
  /** Toggle handler */
  onSort: (key: string) => void;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

export function SortableHeader({ sortKey, isSorted, onSort, children, className, align = "center" }: Props) {
  const dir = isSorted(sortKey);
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 select-none cursor-pointer hover:text-foreground transition-colors w-full",
        align === "right" ? "justify-end" : align === "left" ? "justify-start" : "justify-center",
        dir && "text-foreground font-semibold",
        className,
      )}
    >
      <span>{children}</span>
      {dir === "asc" && <ChevronUp size={12} />}
      {dir === "desc" && <ChevronDown size={12} />}
      {!dir && <ChevronsUpDown size={11} className="opacity-30" />}
    </button>
  );
}

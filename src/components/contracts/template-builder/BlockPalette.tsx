import { useDraggable } from "@dnd-kit/core";
import { Heading, Type, Table, ImageIcon, Minus, Space, PenLine, Variable, Columns2, Code2 } from "lucide-react";
import type { BlockType } from "./types";

const PALETTE_ITEMS: { type: BlockType; label: string; icon: typeof Heading }[] = [
  { type: "heading", label: "כותרת", icon: Heading },
  { type: "paragraph", label: "טקסט", icon: Type },
  { type: "table", label: "טבלה", icon: Table },
  { type: "image", label: "תמונה", icon: ImageIcon },
  { type: "divider", label: "קו מפריד", icon: Minus },
  { type: "spacer", label: "רווח", icon: Space },
  { type: "signature", label: "שדה חתימה", icon: PenLine },
  { type: "variable", label: "משתנה", icon: Variable },
  { type: "columns", label: "שתי עמודות", icon: Columns2 },
  { type: "html", label: "HTML מותאם", icon: Code2 },
];

interface BlockPaletteProps {
  onAdd: (type: BlockType) => void;
}

function DraggablePaletteItem({ type, label, icon: Icon, onAdd }: { type: BlockType; label: string; icon: typeof Heading; onAdd: (t: BlockType) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { fromPalette: true, blockType: type },
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onAdd(type)}
      className={`flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card cursor-grab hover:border-primary/40 hover:shadow-sm transition-all text-right w-full select-none ${isDragging ? "opacity-40 scale-95" : ""}`}
    >
      <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
        <Icon size={16} />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export default function BlockPalette({ onAdd }: BlockPaletteProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground px-1">רכיבים</h3>
      <p className="text-[10px] text-muted-foreground px-1">לחץ או גרור להוספה</p>
      <div className="grid grid-cols-1 gap-1.5">
        {PALETTE_ITEMS.map((item) => (
          <DraggablePaletteItem key={item.type} {...item} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}

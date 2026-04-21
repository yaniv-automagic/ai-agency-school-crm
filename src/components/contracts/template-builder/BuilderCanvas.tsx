import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { useDndMonitor, useDroppable } from "@dnd-kit/core";
import { GripVertical, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateBlock, CanvasSettings, BlockGrid } from "./types";
import { DEFAULT_CANVAS_SETTINGS, defaultGridForType } from "./types";
import BlockContent from "./BlockContent";

const COLS = 12;
const ROW_HEIGHT = 60;
const MARGIN = 14;

interface BuilderCanvasProps {
  blocks: TemplateBlock[];
  selectedBlockId: string | null;
  canvasSettings: CanvasSettings;
  isPaletteDragging: boolean;
  onSelectBlock: (id: string | null) => void;
  onChangeBlock: (block: TemplateBlock) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onInsertAtIndex: (index: number) => void;
}

export default function BuilderCanvas({
  blocks, selectedBlockId, canvasSettings, isPaletteDragging,
  onSelectBlock, onChangeBlock, onDeleteBlock, onDuplicateBlock, onInsertAtIndex,
}: BuilderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const [indicatorY, setIndicatorY] = useState(0);
  const cs = canvasSettings || DEFAULT_CANVAS_SETTINGS;

  const { isOver: isOverCanvas, setNodeRef: setDropRef } = useDroppable({ id: "canvas-drop" });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(containerRef.current);
    setContainerWidth(containerRef.current.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const sortedBlocks = useMemo(() => {
    return [...blocks].sort((a, b) => {
      const ga = a.grid || defaultGridForType(a.type);
      const gb = b.grid || defaultGridForType(b.type);
      return ga.y - gb.y;
    });
  }, [blocks]);

  /** Read actual rendered block positions from DOM */
  const getSlotPositions = useCallback(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return [MARGIN];

    // Get all react-grid-layout items sorted by their rendered top position
    const items = Array.from(gridEl.querySelectorAll<HTMLElement>(".react-grid-item:not(.react-grid-placeholder)"));
    const rects = items
      .map((el) => {
        const style = el.style;
        // react-grid-layout uses transform: translate(Xpx, Ypx) with useCSSTransforms
        const match = style.transform?.match(/translate\((\d+)px,\s*(\d+)px\)/);
        const top = match ? Number(match[2]) : el.offsetTop;
        const height = el.offsetHeight;
        return { top, bottom: top + height };
      })
      .sort((a, b) => a.top - b.top);

    if (rects.length === 0) return [MARGIN];

    // Slots: before first, between each pair, after last
    const slots: { y: number; index: number }[] = [];
    slots.push({ y: Math.max(0, rects[0].top - MARGIN / 2), index: 0 });
    for (let i = 0; i < rects.length; i++) {
      const midY = i < rects.length - 1
        ? (rects[i].bottom + rects[i + 1].top) / 2
        : rects[i].bottom + MARGIN / 2;
      slots.push({ y: midY, index: i + 1 });
    }
    return slots;
  }, []);

  useDndMonitor({
    onDragMove(event) {
      if (!event.active.data.current?.fromPalette || !containerRef.current) {
        setDropIndex(null);
        return;
      }

      const canvasRect = containerRef.current.getBoundingClientRect();
      const mouseY = (event.activatorEvent as MouseEvent).clientY
        + (event.delta?.y || 0)
        - canvasRect.top
        + containerRef.current.scrollTop;

      const slots = getSlotPositions();
      if (!slots.length || typeof slots[0] === "number") {
        setDropIndex(0);
        setIndicatorY(MARGIN);
        return;
      }

      // Find nearest slot to mouse
      let nearest = slots[0] as { y: number; index: number };
      let minDist = Infinity;
      for (const slot of slots as { y: number; index: number }[]) {
        const dist = Math.abs(mouseY - slot.y);
        if (dist < minDist) {
          minDist = dist;
          nearest = slot;
        }
      }

      setDropIndex(nearest.index);
      dropIndexRef.current = nearest.index;
      setIndicatorY(nearest.y);
    },
    onDragEnd() {
      if (dropIndexRef.current !== null) {
        onInsertAtIndex(dropIndexRef.current);
      }
      setDropIndex(null);
      dropIndexRef.current = null;
    },
    onDragCancel() {
      setDropIndex(null);
      dropIndexRef.current = null;
    },
  });

  useEffect(() => {
    if (!isPaletteDragging) setDropIndex(null);
  }, [isPaletteDragging]);

  const layout = useMemo(() => {
    return blocks.map((b, i) => {
      const g = b.grid || defaultGridForType(b.type);
      return {
        i: b.id,
        x: COLS - g.x - g.w,
        y: g.y === 999 ? i * 2 : g.y,
        w: g.w,
        h: g.h,
        minW: 2,
        minH: 1,
      };
    });
  }, [blocks]);

  const handleLayoutChange = useCallback((newLayout: ReactGridLayout.Layout[]) => {
    for (const l of newLayout) {
      const block = blocks.find((b) => b.id === l.i);
      if (!block) continue;
      const newGrid: BlockGrid = { x: COLS - l.x - l.w, y: l.y, w: l.w, h: l.h };
      const oldGrid = block.grid || defaultGridForType(block.type);
      if (oldGrid.x !== newGrid.x || oldGrid.y !== newGrid.y || oldGrid.w !== newGrid.w || oldGrid.h !== newGrid.h) {
        onChangeBlock({ ...block, grid: newGrid });
      }
    }
  }, [blocks, onChangeBlock]);

  const canvasStyle: React.CSSProperties = {
    backgroundColor: cs.backgroundColor,
    backgroundImage: cs.backgroundImage ? `url(${cs.backgroundImage})` : undefined,
    backgroundSize: cs.backgroundSize,
    backgroundPosition: cs.backgroundPosition,
    backgroundRepeat: "no-repeat",
  };

  const setRefs = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    setDropRef(el);
  }, [setDropRef]);

  if (blocks.length === 0) {
    return (
      <div
        ref={setRefs}
        className={cn(
          "min-h-[600px] rounded-xl border-2 border-dashed p-6 transition-all",
          isOverCanvas || isPaletteDragging ? "border-primary/50 bg-primary/5 shadow-inner" : "border-border"
        )}
        style={canvasStyle}
        dir="rtl"
      >
        <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-muted/80 flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
          </div>
          <p className="text-lg font-medium mb-1">גרור רכיבים לכאן</p>
          <p className="text-sm">בחר רכיב מהרשימה בצד ימין וגרור אותו לאזור זה</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setRefs}
      className={cn(
        "rounded-xl border-2 overflow-hidden transition-all relative",
        isPaletteDragging ? "border-primary/40 shadow-inner" : isOverCanvas ? "border-primary/50" : "border-border"
      )}
      style={canvasStyle}
    >
      {/* Drop indicator line */}
      {isPaletteDragging && dropIndex !== null && (
        <div
          className="absolute left-3 right-3 z-30 pointer-events-none transition-[top] duration-75 ease-out"
          style={{ top: indicatorY - 2 }}
        >
          <div className="h-1 bg-primary rounded-full shadow-[0_0_12px_hsl(var(--primary)/0.6)]" />
          <div className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-primary text-primary-foreground text-[9px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shadow-md">
            שחרר כאן
          </div>
        </div>
      )}

      <div dir="ltr" ref={gridRef}>
        <GridLayout
          layout={layout}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          width={containerWidth}
          isDraggable={!isPaletteDragging}
          isResizable={!isPaletteDragging}
          draggableHandle=".block-drag-handle"
          draggableCancel=".block-content-area, input, textarea, [contenteditable], button, a, select"
          resizeHandles={["se", "e", "s"]}
          compactType="vertical"
          margin={[MARGIN, MARGIN]}
          containerPadding={[MARGIN, MARGIN]}
          onDragStop={handleLayoutChange}
          onResizeStop={handleLayoutChange}
          useCSSTransforms
        >
          {sortedBlocks.map((block) => (
            <div key={block.id} dir="rtl">
              <div
                className={cn(
                  "h-full bg-card border rounded-xl overflow-hidden transition-shadow",
                  isPaletteDragging && "opacity-60",
                  block.id === selectedBlockId
                    ? "border-primary shadow-md ring-1 ring-primary/20"
                    : "border-border hover:shadow-sm hover:border-primary/20"
                )}
                onClick={(e) => { e.stopPropagation(); onSelectBlock(block.id); }}
              >
                <div className="flex items-center justify-between px-2 py-1 border-b border-border block-drag-handle cursor-grab active:cursor-grabbing bg-muted/30">
                  <div className="flex items-center gap-1.5">
                    <GripVertical size={12} className="text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{blockTypeLabel(block.type)}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); onDuplicateBlock(block.id); }} className="p-0.5 rounded hover:bg-muted transition-colors" title="שכפל">
                      <Copy size={11} className="text-muted-foreground" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteBlock(block.id); }} className="p-0.5 rounded hover:bg-destructive/10 transition-colors" title="מחק">
                      <Trash2 size={11} className="text-destructive" />
                    </button>
                  </div>
                </div>
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                <div
                  className="p-2 h-[calc(100%-28px)] overflow-auto block-content-area"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <BlockContent block={block} onChange={onChangeBlock} isSelected={block.id === selectedBlockId} />
                </div>
              </div>
            </div>
          ))}
        </GridLayout>
      </div>
    </div>
  );
}

function blockTypeLabel(type: TemplateBlock["type"]): string {
  const labels: Record<string, string> = {
    heading: "כותרת", paragraph: "טקסט", table: "טבלה", image: "תמונה",
    divider: "מפריד", spacer: "רווח", signature: "חתימה", variable: "משתנה",
    columns: "עמודות", html: "HTML",
  };
  return labels[type] || type;
}

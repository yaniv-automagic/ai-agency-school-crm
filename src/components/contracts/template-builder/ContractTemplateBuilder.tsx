import { useState, useCallback, useRef } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core";
import { Eye, Save, ArrowRight, Settings2, FileCode2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { TemplateBlock, BlockType, CanvasSettings } from "./types";
import { createDefaultBlock, defaultGridForType, DEFAULT_CANVAS_SETTINGS } from "./types";
import { blocksToHtml, extractVariables } from "./blocks-to-html";
import { htmlToBlocks } from "./html-to-blocks";
import BlockPalette from "./BlockPalette";
import BuilderCanvas from "./BuilderCanvas";
import PropertiesPanel from "./PropertiesPanel";

interface ContractTemplateBuilderProps {
  initialBlocks?: TemplateBlock[];
  initialCanvasSettings?: CanvasSettings;
  templateName: string;
  onSave: (data: { blocks: TemplateBlock[]; bodyHtml: string; variables: string[]; name: string; canvasSettings: CanvasSettings }) => void;
  onBack: () => void;
  saving?: boolean;
}

export default function ContractTemplateBuilder({ initialBlocks = [], initialCanvasSettings, templateName, onSave, onBack, saving }: ContractTemplateBuilderProps) {
  const [blocks, setBlocks] = useState<TemplateBlock[]>(initialBlocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [name, setName] = useState(templateName);
  const [showPreview, setShowPreview] = useState(false);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);
  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>(initialCanvasSettings || DEFAULT_CANVAS_SETTINGS);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importHtml, setImportHtml] = useState("");
  const [isPaletteDragging, setIsPaletteDragging] = useState(false);
  const draggedTypeRef = useRef<BlockType | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (event.active.data.current?.fromPalette) {
      setIsPaletteDragging(true);
      draggedTypeRef.current = event.active.data.current.blockType as BlockType;
    }
  }, []);

  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    // Don't clear draggedTypeRef here — onInsertAtIndex needs it and fires after this
    setIsPaletteDragging(false);
    // Clear ref after a tick so onInsertAtIndex can read it first
    setTimeout(() => { draggedTypeRef.current = null; }, 0);
  }, []);

  // Called by BuilderCanvas when it detects a drop at a specific slot
  const handleInsertAtIndex = useCallback((insertIndex: number) => {
    const type = draggedTypeRef.current;
    if (!type) return;

    const newBlock = createDefaultBlock(type);

    setBlocks((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const ga = a.grid || defaultGridForType(a.type);
        const gb = b.grid || defaultGridForType(b.type);
        return ga.y - gb.y;
      });

      let insertY = 0;
      if (insertIndex > 0 && sorted[insertIndex - 1]) {
        const prevBlock = sorted[insertIndex - 1];
        const pg = prevBlock.grid || defaultGridForType(prevBlock.type);
        insertY = pg.y + pg.h;
      }

      const newBlockGrid = { ...defaultGridForType(type), y: insertY };
      const shifted = sorted.map((b) => {
        const g = b.grid || defaultGridForType(b.type);
        if (g.y >= insertY) {
          return { ...b, grid: { ...g, y: g.y + newBlockGrid.h } };
        }
        return b;
      });

      return [...shifted, { ...newBlock, grid: newBlockGrid }];
    });

    setSelectedBlockId(newBlock.id);
  }, []);

  const handleAddBlock = useCallback((type: BlockType) => {
    const newBlock = createDefaultBlock(type);
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, []);

  const handleChangeBlock = useCallback((updated: TemplateBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }, []);

  const handleDeleteBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  }, [selectedBlockId]);

  const handleDuplicateBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      const original = prev.find((b) => b.id === id);
      if (!original) return prev;
      const clone: TemplateBlock = { ...JSON.parse(JSON.stringify(original)), id: crypto.randomUUID() };
      const og = original.grid || defaultGridForType(original.type);

      // Place clone right below original, push everything else down
      const insertY = og.y + og.h;
      clone.grid = { ...og, y: insertY };

      const shifted = prev.map((b) => {
        if (b.id === id) return b;
        const g = b.grid || defaultGridForType(b.type);
        if (g.y >= insertY) {
          return { ...b, grid: { ...g, y: g.y + og.h } };
        }
        return b;
      });

      return [...shifted, clone];
    });
  }, []);

  const handleSelectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
    if (id) setShowCanvasSettings(false);
  }, []);

  const handleSave = () => {
    if (!name.trim()) { toast.error("יש להזין שם לתבנית"); return; }
    if (blocks.length === 0) { toast.error("יש להוסיף לפחות רכיב אחד"); return; }
    const bodyHtml = blocksToHtml(blocks, canvasSettings);
    const variables = extractVariables(blocks);
    onSave({ blocks, bodyHtml, variables, name: name.trim(), canvasSettings });
  };

  const handleImportHtml = () => {
    if (!importHtml.trim()) { toast.error("יש להדביק קוד HTML"); return; }
    const imported = htmlToBlocks(importHtml);
    if (imported.length === 0) { toast.error("לא נמצאו רכיבים ב-HTML"); return; }
    setBlocks((prev) => [...prev, ...imported]);
    setShowImportDialog(false);
    setImportHtml("");
    toast.success(`${imported.length} רכיבים יובאו בהצלחה`);
  };

  const previewHtml = showPreview ? blocksToHtml(blocks, canvasSettings) : "";

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-muted rounded-lg transition-colors"><ArrowRight size={20} /></button>
          <input value={name} onChange={(e) => setName(e.target.value)} className="text-xl font-bold bg-transparent outline-none min-w-[200px] border-b-2 border-transparent hover:border-border focus:border-primary transition-colors px-1 py-0.5 rounded-none" placeholder="שם התבנית..." dir="rtl" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImportDialog(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border hover:bg-muted transition-colors" title="ייבוא מ-HTML">
            <FileCode2 size={16} /> ייבוא HTML
          </button>
          <button onClick={() => { setShowCanvasSettings(!showCanvasSettings); setSelectedBlockId(null); }} className={cn("flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors", showCanvasSettings ? "bg-muted border-primary/30" : "hover:bg-muted")} title="הגדרות קנבס">
            <Settings2 size={16} /> קנבס
          </button>
          <button onClick={() => setShowPreview(!showPreview)} className={cn("flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors", showPreview ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            <Eye size={16} /> {showPreview ? "עורך" : "תצוגה מקדימה"}
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <Save size={16} /> {saving ? "שומר..." : "שמור תבנית"}
          </button>
        </div>
      </div>

      {/* Body */}
      {showPreview ? (
        <div className="flex-1 overflow-auto bg-muted/30 rounded-xl border p-8">
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-hidden">
          <div className="w-52 shrink-0 overflow-y-auto">
            <BlockPalette onAdd={handleAddBlock} />
          </div>
          <div className="flex-1 overflow-y-auto bg-muted/20 rounded-xl p-2">
            <BuilderCanvas
              blocks={blocks}
              selectedBlockId={selectedBlockId}
              canvasSettings={canvasSettings}
              isPaletteDragging={isPaletteDragging}
              onSelectBlock={handleSelectBlock}
              onChangeBlock={handleChangeBlock}
              onDeleteBlock={handleDeleteBlock}
              onDuplicateBlock={handleDuplicateBlock}
              onInsertAtIndex={handleInsertAtIndex}
            />
          </div>
          <div className="w-56 shrink-0 overflow-y-auto">
            <PropertiesPanel
              block={selectedBlock}
              canvasSettings={canvasSettings}
              onBlockChange={handleChangeBlock}
              onCanvasChange={(s) => { setCanvasSettings(s); setShowCanvasSettings(true); }}
              showCanvas={showCanvasSettings}
            />
          </div>
        </div>
      )}

      {/* Import HTML Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ייבוא הסכם מ-HTML</DialogTitle>
            <DialogDescription>הדבק קוד HTML של הסכם קיים והמערכת תמיר אותו אוטומטית לרכיבי תבנית</DialogDescription>
          </DialogHeader>
          <textarea value={importHtml} onChange={(e) => setImportHtml(e.target.value)} placeholder="<div>הדבק כאן קוד HTML...</div>" className="w-full min-h-[300px] p-4 font-mono text-sm bg-muted/30 border border-border rounded-lg outline-none resize-y" dir="ltr" spellCheck={false} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">כותרות, טבלאות, תמונות וטקסט יזוהו אוטומטית</span>
            <div className="flex gap-2">
              <button onClick={() => { setShowImportDialog(false); setImportHtml(""); }} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors">ביטול</button>
              <button onClick={handleImportHtml} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">ייבא לתבנית</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DragOverlay>
        {isPaletteDragging ? (
          <div className="px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg text-sm font-medium opacity-90 pointer-events-none">
            שחרר במיקום הרצוי
          </div>
        ) : null}
      </DragOverlay>
    </div>
    </DndContext>
  );
}

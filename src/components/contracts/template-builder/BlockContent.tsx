import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { TemplateBlock } from "./types";
import RichTextToolbar from "./RichTextToolbar";
import VariableInserter from "./VariableInserter";

interface BlockContentProps {
  block: TemplateBlock;
  onChange: (block: TemplateBlock) => void;
  isSelected: boolean;
}

export default function BlockContent({ block, onChange, isSelected }: BlockContentProps) {
  switch (block.type) {
    case "heading":
      return <HeadingContent block={block} onChange={onChange} isSelected={isSelected} />;
    case "paragraph":
      return <ParagraphContent block={block} onChange={onChange} isSelected={isSelected} />;
    case "table":
      return <TableContent block={block} onChange={onChange} isSelected={isSelected} />;
    case "image":
      return <ImageContent block={block} onChange={onChange} />;
    case "divider":
      return <DividerContent block={block} />;
    case "spacer":
      return <SpacerContent block={block} />;
    case "signature":
      return <SignatureContent block={block} onChange={onChange} isSelected={isSelected} />;
    case "variable":
      return <VariableContent block={block} />;
    case "columns":
      return <ColumnsContent block={block} />;
    case "html":
      return <HtmlContent block={block} onChange={onChange} isSelected={isSelected} />;
  }
}

// ── Heading (with variable insertion) ──

function HeadingContent({ block, onChange, isSelected }: { block: Extract<TemplateBlock, { type: "heading" }>; onChange: (b: TemplateBlock) => void; isSelected: boolean }) {
  const sizes = { 1: "text-2xl", 2: "text-xl", 3: "text-lg" };
  const inputRef = useRef<HTMLInputElement>(null);

  const insertVar = (_key: string, tpl: string) => {
    const el = inputRef.current;
    if (!el) { onChange({ ...block, text: block.text + tpl }); return; }
    const start = el.selectionStart ?? block.text.length;
    const end = el.selectionEnd ?? start;
    const newText = block.text.slice(0, start) + tpl + block.text.slice(end);
    onChange({ ...block, text: newText });
    requestAnimationFrame(() => { el.setSelectionRange(start + tpl.length, start + tpl.length); el.focus(); });
  };

  return (
    <div className="h-full flex flex-col">
      {isSelected && (
        <div className="flex items-center justify-end pb-1">
          <VariableInserter onInsert={insertVar} compact />
        </div>
      )}
      <input
        ref={inputRef}
        value={block.text}
        onChange={(e) => onChange({ ...block, text: e.target.value })}
        className={cn("w-full bg-transparent border-none outline-none font-bold flex-1", sizes[block.level])}
        style={{ textAlign: block.align }}
        dir="rtl"
        placeholder="הכנס כותרת..."
      />
    </div>
  );
}

// ── Paragraph (with rich text toolbar + variables) ──

function ParagraphContent({ block, onChange, isSelected }: { block: Extract<TemplateBlock, { type: "paragraph" }>; onChange: (b: TemplateBlock) => void; isSelected: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (ref.current && !initialized) {
      ref.current.innerHTML = block.html;
      setInitialized(true);
    }
  }, [initialized, block.html]);

  const handleHtmlChange = useCallback(() => {
    if (ref.current) onChange({ ...block, html: ref.current.innerHTML });
  }, [block, onChange]);

  const handleDirectionChange = useCallback((dir: "rtl" | "ltr") => {
    onChange({ ...block, direction: dir });
  }, [block, onChange]);

  return (
    <div className="h-full flex flex-col">
      {isSelected && (
        <RichTextToolbar editorRef={ref} direction={block.direction || "rtl"} onDirectionChange={handleDirectionChange} onHtmlChange={handleHtmlChange} />
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleHtmlChange}
        className={cn(
          "w-full flex-1 min-h-[1.5em] outline-none max-w-none p-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pr-5 [&_ol]:pr-5 [&_li]:mb-0.5",
          isSelected && "border border-border rounded-b-lg"
        )}
        style={{ textAlign: block.align, fontSize: block.fontSize, direction: block.direction || "rtl" }}
        dir={block.direction || "rtl"}
      />
    </div>
  );
}

// ── Table (with variable insertion per cell) ──

function TableContent({ block, onChange, isSelected }: { block: Extract<TemplateBlock, { type: "table" }>; onChange: (b: TemplateBlock) => void; isSelected: boolean }) {
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null);
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const updateCell = (ri: number, ci: number, value: string) => {
    const rows = block.rows.map((row, r) => row.map((cell, c) => (r === ri && c === ci ? value : cell)));
    onChange({ ...block, rows });
  };

  const insertVarToCell = (ri: number, ci: number, _key: string, tpl: string) => {
    const el = cellRefs.current[`${ri}-${ci}`];
    const cell = block.rows[ri]?.[ci] || "";
    const start = el?.selectionStart ?? cell.length;
    const end = el?.selectionEnd ?? start;
    const newVal = cell.slice(0, start) + tpl + cell.slice(end);
    updateCell(ri, ci, newVal);
    requestAnimationFrame(() => { el?.setSelectionRange(start + tpl.length, start + tpl.length); el?.focus(); });
  };

  return (
    <div className="overflow-auto h-full">
      {isSelected && activeCell && (
        <div className="flex items-center justify-end pb-1">
          <VariableInserter onInsert={(k, t) => insertVarToCell(activeCell.r, activeCell.c, k, t)} compact />
        </div>
      )}
      <table className="w-full border-collapse text-sm" dir="rtl">
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className={cn("border border-border p-1.5", block.headerRow && ri === 0 && "bg-muted font-semibold")}>
                  <input
                    ref={(el) => { cellRefs.current[`${ri}-${ci}`] = el; }}
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                    onFocus={() => setActiveCell({ r: ri, c: ci })}
                    className="w-full bg-transparent border-none outline-none text-sm text-right"
                    placeholder={block.headerRow && ri === 0 ? "כותרת" : "תוכן"}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Image ──

function ImageContent({ block, onChange }: { block: Extract<TemplateBlock, { type: "image" }>; onChange: (b: TemplateBlock) => void }) {
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("גודל התמונה מוגבל ל-5MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `contract-templates/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("crm-files").upload(fileName, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("crm-files").getPublicUrl(fileName);
      onChange({ ...block, src: urlData.publicUrl });
    } catch (err: unknown) {
      toast.error((err as Error).message || "שגיאה בהעלאת התמונה");
    } finally { setUploading(false); }
  };

  if (!block.src) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full border-2 border-dashed border-border rounded-lg p-3">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button onClick={() => setMode("upload")} className={cn("flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md transition-colors", mode === "upload" ? "bg-background shadow-sm" : "text-muted-foreground")}>
            <Upload size={10} /> העלאה
          </button>
          <button onClick={() => setMode("url")} className={cn("flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md transition-colors", mode === "url" ? "bg-background shadow-sm" : "text-muted-foreground")}>
            <Link size={10} /> קישור
          </button>
        </div>
        {mode === "upload" ? (
          <>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-50">
              {uploading ? "מעלה..." : "בחר תמונה"}
            </button>
          </>
        ) : (
          <input type="url" placeholder="https://..." className="w-48 px-2 py-1 text-xs border rounded-md text-center" onKeyDown={(e) => { if (e.key === "Enter") onChange({ ...block, src: (e.target as HTMLInputElement).value }); }} dir="ltr" />
        )}
      </div>
    );
  }

  return (
    <div style={{ textAlign: block.align }} className="h-full relative group/img flex items-center justify-center">
      <img src={block.src} alt={block.alt} style={{ width: `${block.width}%`, maxHeight: "100%", objectFit: "contain" }} className="inline-block rounded" />
      <button onClick={() => onChange({ ...block, src: "" })} className="absolute top-1 left-1 p-1 bg-destructive text-destructive-foreground rounded-md opacity-0 group-hover/img:opacity-100 transition-opacity text-[10px]">החלף</button>
    </div>
  );
}

// ── Divider ──

function DividerContent({ block }: { block: Extract<TemplateBlock, { type: "divider" }> }) {
  return <div className="flex items-center h-full"><hr style={{ borderTop: `2px ${block.style} ${block.color}` }} className="w-full" /></div>;
}

// ── Spacer ──

function SpacerContent({ block }: { block: Extract<TemplateBlock, { type: "spacer" }> }) {
  return (
    <div className="h-full bg-muted/30 rounded border border-dashed border-border flex items-center justify-center">
      <span className="text-xs text-muted-foreground">רווח</span>
    </div>
  );
}

// ── Signature (with variable insertion) ──

function SignatureContent({ block, onChange, isSelected }: { block: Extract<TemplateBlock, { type: "signature" }>; onChange: (b: TemplateBlock) => void; isSelected: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const insertVar = (_key: string, tpl: string) => {
    const el = inputRef.current;
    if (!el) { onChange({ ...block, label: block.label + tpl }); return; }
    const start = el.selectionStart ?? block.label.length;
    const end = el.selectionEnd ?? start;
    const newLabel = block.label.slice(0, start) + tpl + block.label.slice(end);
    onChange({ ...block, label: newLabel });
    requestAnimationFrame(() => { el.setSelectionRange(start + tpl.length, start + tpl.length); el.focus(); });
  };

  return (
    <div className="h-full border-2 border-dashed border-border rounded-lg p-3 flex flex-col items-center justify-center">
      {isSelected && (
        <div className="flex items-center justify-end w-full pb-1">
          <VariableInserter onInsert={insertVar} compact />
        </div>
      )}
      <input ref={inputRef} value={block.label} onChange={(e) => onChange({ ...block, label: e.target.value })} className="text-center bg-transparent border-none outline-none text-sm text-muted-foreground mb-2 w-full" dir="rtl" />
      <div className="border-b-2 border-muted-foreground/30 w-32" />
    </div>
  );
}

// ── Variable ──

function VariableContent({ block }: { block: Extract<TemplateBlock, { type: "variable" }> }) {
  return (
    <div className="h-full flex items-center">
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-md border border-primary/20">
        <span className="text-xs text-muted-foreground">{block.label}:</span>
        <code className="text-sm font-mono text-primary">{`{{${block.variableName}}}`}</code>
      </div>
    </div>
  );
}

// ── Columns ──

function ColumnsContent({ block }: { block: Extract<TemplateBlock, { type: "columns" }> }) {
  const [l, r] = block.ratio.split("-").map(Number);
  return (
    <div className="grid gap-2 h-full border border-dashed border-border rounded-lg p-2" style={{ gridTemplateColumns: `${l}fr ${r}fr` }}>
      <div className="bg-muted/30 rounded p-2 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">ימין ({l}%)</span>
      </div>
      <div className="bg-muted/30 rounded p-2 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">שמאל ({r}%)</span>
      </div>
    </div>
  );
}

// ── HTML ──

function HtmlContent({ block, onChange, isSelected }: { block: Extract<TemplateBlock, { type: "html" }>; onChange: (b: TemplateBlock) => void; isSelected: boolean }) {
  const [editMode, setEditMode] = useState(false);

  if (editMode && isSelected) {
    return (
      <div className="h-full flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground">עריכת HTML</span>
          <button onClick={() => setEditMode(false)} className="text-[10px] text-primary hover:underline">תצוגה מקדימה</button>
        </div>
        <textarea value={block.code} onChange={(e) => onChange({ ...block, code: e.target.value })} className="flex-1 w-full p-2 font-mono text-xs bg-muted/50 border border-border rounded-lg outline-none resize-none" dir="ltr" spellCheck={false} />
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {isSelected && (
        <button onClick={() => setEditMode(true)} className="absolute top-0 left-0 text-[10px] text-primary bg-background/80 px-1.5 py-0.5 rounded border border-border hover:bg-muted z-10">ערוך קוד</button>
      )}
      <div className="h-full border border-dashed border-border rounded-lg p-2 overflow-auto">
        {block.code.trim() && !block.code.startsWith("<!--") ? (
          <div dangerouslySetInnerHTML={{ __html: block.code }} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">בלוק HTML — לחץ &quot;ערוך קוד&quot;</div>
        )}
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEMPLATE_VARIABLES, type TemplateBlock, type CanvasSettings } from "./types";
import { Plus, Trash2, Upload, ImageIcon } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface PropertiesPanelProps {
  block: TemplateBlock | null;
  canvasSettings: CanvasSettings;
  onBlockChange: (block: TemplateBlock) => void;
  onCanvasChange: (settings: CanvasSettings) => void;
  showCanvas: boolean;
}

export default function PropertiesPanel({ block, canvasSettings, onBlockChange, onCanvasChange, showCanvas }: PropertiesPanelProps) {
  if (showCanvas && !block) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">הגדרות קנבס</h3>
        <CanvasProps settings={canvasSettings} onChange={onCanvasChange} />
      </div>
    );
  }

  if (!block) {
    return (
      <div className="space-y-4">
        <div className="text-center text-sm text-muted-foreground pt-8">
          <p>בחר רכיב כדי לערוך</p>
          <p className="mt-1">את ההגדרות שלו</p>
          <div className="mt-6 pt-4 border-t">
            <button
              onClick={() => onCanvasChange(canvasSettings)}
              className="text-xs text-primary hover:underline"
            >
              הגדרות קנבס
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">הגדרות רכיב</h3>
      <div className="space-y-3">
        {block.type === "heading" && <HeadingProps block={block} onChange={onBlockChange} />}
        {block.type === "paragraph" && <ParagraphProps block={block} onChange={onBlockChange} />}
        {block.type === "table" && <TableProps block={block} onChange={onBlockChange} />}
        {block.type === "image" && <ImageProps block={block} onChange={onBlockChange} />}
        {block.type === "divider" && <DividerProps block={block} onChange={onBlockChange} />}
        {block.type === "spacer" && <SpacerProps block={block} onChange={onBlockChange} />}
        {block.type === "signature" && <SignatureProps block={block} onChange={onBlockChange} />}
        {block.type === "variable" && <VariableProps block={block} onChange={onBlockChange} />}
        {block.type === "columns" && <ColumnsProps block={block} onChange={onBlockChange} />}
        {block.type === "html" && <HtmlProps block={block} onChange={onBlockChange} />}

        {/* Min height for all blocks */}
        <Field label="גובה מינימלי (px)">
          <Input
            type="number"
            min={0}
            max={800}
            value={block.minHeight || ""}
            placeholder="אוטומטי"
            onChange={(e) => onBlockChange({ ...block, minHeight: e.target.value ? Number(e.target.value) : undefined })}
            className="h-8 text-xs"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function AlignSelect({ value, onChange }: { value: string; onChange: (v: "right" | "center" | "left") => void }) {
  return (
    <Field label="יישור">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="right">ימין</SelectItem>
          <SelectItem value="center">מרכז</SelectItem>
          <SelectItem value="left">שמאל</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

// ── Canvas Settings ──

function CanvasProps({ settings, onChange }: { settings: CanvasSettings; onChange: (s: CanvasSettings) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleBgUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("גודל התמונה מוגבל ל-5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `contract-templates/bg-${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("crm-files")
        .upload(fileName, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage
        .from("crm-files")
        .getPublicUrl(fileName);
      onChange({ ...settings, backgroundImage: urlData.publicUrl });
    } catch (err: unknown) {
      toast.error((err as Error).message || "שגיאה בהעלאת התמונה");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="צבע רקע">
        <ColorPicker value={settings.backgroundColor} onChange={(c) => onChange({ ...settings, backgroundColor: c })} />
      </Field>

      <Field label="תמונת רקע">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleBgUpload(e.target.files[0]); }} />
        {settings.backgroundImage ? (
          <div className="space-y-2">
            <div className="relative rounded-md overflow-hidden border border-border h-20">
              <img src={settings.backgroundImage} alt="bg" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex-1 text-xs py-1.5 bg-muted rounded hover:bg-muted/80"
              >
                {uploading ? "מעלה..." : "החלף"}
              </button>
              <button
                onClick={() => onChange({ ...settings, backgroundImage: "" })}
                className="flex-1 text-xs py-1.5 bg-destructive/10 text-destructive rounded hover:bg-destructive/20"
              >
                הסר
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-1.5 py-3 border-2 border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary/40 transition-colors"
          >
            <ImageIcon size={14} />
            {uploading ? "מעלה..." : "העלה תמונת רקע"}
          </button>
        )}
      </Field>

      {settings.backgroundImage && (
        <>
          <Field label="גודל רקע">
            <Select value={settings.backgroundSize} onValueChange={(v) => onChange({ ...settings, backgroundSize: v as CanvasSettings["backgroundSize"] })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">כיסוי מלא</SelectItem>
                <SelectItem value="contain">התאמה</SelectItem>
                <SelectItem value="auto">אוטומטי</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="מיקום רקע">
            <Select value={settings.backgroundPosition} onValueChange={(v) => onChange({ ...settings, backgroundPosition: v as CanvasSettings["backgroundPosition"] })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="center">מרכז</SelectItem>
                <SelectItem value="top">למעלה</SelectItem>
                <SelectItem value="bottom">למטה</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}

      <Field label="ריפוד פנימי (px)">
        <Input type="number" min={0} max={100} value={settings.padding} onChange={(e) => onChange({ ...settings, padding: Number(e.target.value) })} className="h-8 text-xs" />
      </Field>

      <Field label="רוחב מקסימלי (px)">
        <Input type="number" min={400} max={1200} value={settings.maxWidth} onChange={(e) => onChange({ ...settings, maxWidth: Number(e.target.value) })} className="h-8 text-xs" />
      </Field>
    </div>
  );
}

// ── Block-specific Props ──

function HeadingProps({ block, onChange }: { block: Extract<TemplateBlock, { type: "heading" }>; onChange: (b: TemplateBlock) => void }) {
  return (
    <>
      <Field label="רמת כותרת">
        <Select value={String(block.level)} onValueChange={(v) => onChange({ ...block, level: Number(v) as 1 | 2 | 3 })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">H1 - ראשי</SelectItem>
            <SelectItem value="2">H2 - משני</SelectItem>
            <SelectItem value="3">H3 - שלישי</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <AlignSelect value={block.align} onChange={(v) => onChange({ ...block, align: v })} />
    </>
  );
}

function ParagraphProps({ block, onChange }: { block: Extract<TemplateBlock, { type: "paragraph" }>; onChange: (b: TemplateBlock) => void }) {
  return (
    <>
      <Field label="גודל גופן">
        <Input type="number" min={10} max={32} value={block.fontSize} onChange={(e) => onChange({ ...block, fontSize: Number(e.target.value) })} className="h-8 text-xs" />
      </Field>
      <AlignSelect value={block.align} onChange={(v) => onChange({ ...block, align: v })} />
      <Field label="כיוון טקסט">
        <Select value={block.direction || "rtl"} onValueChange={(v) => onChange({ ...block, direction: v as "rtl" | "ltr" })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rtl">ימין לשמאל (RTL)</SelectItem>
            <SelectItem value="ltr">שמאל לימין (LTR)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <p className="text-[10px] text-muted-foreground">
        סרגל עיצוב מלא מופיע כשלוחצים על בלוק הטקסט
      </p>
    </>
  );
}

function TableProps({ block, onChange }: { block: Extract<TemplateBlock, { type: "table" }>; onChange: (b: TemplateBlock) => void }) {
  const addRow = () => {
    const cols = block.rows[0]?.length || 2;
    onChange({ ...block, rows: [...block.rows, Array(cols).fill("")] });
  };
  const addCol = () => {
    onChange({ ...block, rows: block.rows.map((row) => [...row, ""]) });
  };
  const removeRow = () => {
    if (block.rows.length > 1) onChange({ ...block, rows: block.rows.slice(0, -1) });
  };
  const removeCol = () => {
    if ((block.rows[0]?.length || 0) > 1) onChange({ ...block, rows: block.rows.map((row) => row.slice(0, -1)) });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{block.rows.length} שורות x {block.rows[0]?.length || 0} עמודות</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={addRow} className="flex items-center justify-center gap-1 text-xs px-2 py-1.5 bg-muted rounded-md hover:bg-muted/80"><Plus size={12} /> שורה</button>
        <button onClick={addCol} className="flex items-center justify-center gap-1 text-xs px-2 py-1.5 bg-muted rounded-md hover:bg-muted/80"><Plus size={12} /> עמודה</button>
        <button onClick={removeRow} className="flex items-center justify-center gap-1 text-xs px-2 py-1.5 bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20"><Trash2 size={12} /> שורה</button>
        <button onClick={removeCol} className="flex items-center justify-center gap-1 text-xs px-2 py-1.5 bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20"><Trash2 size={12} /> עמודה</button>
      </div>
      <Field label="שורת כותרת">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={block.headerRow} onChange={(e) => onChange({ ...block, headerRow: e.target.checked })} className="rounded" />
          שורה ראשונה כשורת כותרת
        </label>
      </Field>
    </>
  );
}

function ImageProps({ block, onChange }: { block: Extract<TemplateBlock, { type: "image" }>; onChange: (b: TemplateBlock) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("גודל התמונה מוגבל ל-5MB");
      return;
    }
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
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Field label="תמונה">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-1.5 py-2 border border-border rounded-lg text-xs hover:bg-muted transition-colors"
        >
          <Upload size={12} />
          {uploading ? "מעלה..." : block.src ? "החלף תמונה" : "העלה מהמחשב"}
        </button>
      </Field>
      <Field label="קישור תמונה">
        <Input value={block.src} onChange={(e) => onChange({ ...block, src: e.target.value })} className="h-8 text-xs" dir="ltr" placeholder="https://..." />
      </Field>
      <Field label="טקסט חלופי">
        <Input value={block.alt} onChange={(e) => onChange({ ...block, alt: e.target.value })} className="h-8 text-xs" />
      </Field>
      <Field label="רוחב (%)">
        <Input type="number" min={10} max={100} value={block.width} onChange={(e) => onChange({ ...block, width: Number(e.target.value) })} className="h-8 text-xs" />
      </Field>
      <AlignSelect value={block.align} onChange={(v) => onChange({ ...block, align: v })} />
    </>
  );
}

function DividerProps({ block, onChange }: { block: Extract<TemplateBlock, { type: "divider" }>; onChange: (b: TemplateBlock) => void }) {
  return (
    <>
      <Field label="סגנון קו">
        <Select value={block.style} onValueChange={(v) => onChange({ ...block, style: v as "solid" | "dashed" | "dotted" })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">רציף</SelectItem>
            <SelectItem value="dashed">מקווקו</SelectItem>
            <SelectItem value="dotted">מנוקד</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="צבע">
        <ColorPicker value={block.color} onChange={(c) => onChange({ ...block, color: c })} />
      </Field>
    </>
  );
}

function SpacerProps({ block, onChange }: { block: Extract<TemplateBlock, { type: "spacer" }>; onChange: (b: TemplateBlock) => void }) {
  return (
    <Field label="גובה (px)">
      <Input type="number" min={4} max={200} value={block.height} onChange={(e) => onChange({ ...block, height: Number(e.target.value) })} className="h-8 text-xs" />
    </Field>
  );
}

function SignatureProps({ block, onChange }: { block: Extract<TemplateBlock, { type: "signature" }>; onChange: (b: TemplateBlock) => void }) {
  return (
    <Field label="תווית">
      <Input value={block.label} onChange={(e) => onChange({ ...block, label: e.target.value })} className="h-8 text-xs" />
    </Field>
  );
}

function VariableProps({ block, onChange }: { block: Extract<TemplateBlock, { type: "variable" }>; onChange: (b: TemplateBlock) => void }) {
  return (
    <>
      <Field label="משתנה">
        <Select value={block.variableName} onValueChange={(v) => {
          const tpl = TEMPLATE_VARIABLES.find((t) => t.key === v);
          onChange({ ...block, variableName: v, label: tpl?.label || v });
        }}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TEMPLATE_VARIABLES.map((v) => (
              <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="גודל גופן">
        <Input type="number" min={10} max={32} value={block.fontSize} onChange={(e) => onChange({ ...block, fontSize: Number(e.target.value) })} className="h-8 text-xs" />
      </Field>
      <Field label="מודגש">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={block.bold} onChange={(e) => onChange({ ...block, bold: e.target.checked })} className="rounded" />
          הצג בהדגשה
        </label>
      </Field>
    </>
  );
}

function ColumnsProps({ block, onChange }: { block: Extract<TemplateBlock, { type: "columns" }>; onChange: (b: TemplateBlock) => void }) {
  return (
    <Field label="יחס עמודות">
      <Select value={block.ratio} onValueChange={(v) => onChange({ ...block, ratio: v as "50-50" | "33-67" | "67-33" })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="50-50">50% / 50%</SelectItem>
          <SelectItem value="33-67">33% / 67%</SelectItem>
          <SelectItem value="67-33">67% / 33%</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function HtmlProps({ block, onChange }: { block: Extract<TemplateBlock, { type: "html" }>; onChange: (b: TemplateBlock) => void }) {
  return (
    <Field label="קוד HTML">
      <textarea
        value={block.code}
        onChange={(e) => onChange({ ...block, code: e.target.value })}
        className="w-full min-h-[150px] p-2 font-mono text-xs bg-muted/50 border border-border rounded-lg outline-none resize-y"
        dir="ltr"
        spellCheck={false}
        placeholder="<div>...</div>"
      />
    </Field>
  );
}

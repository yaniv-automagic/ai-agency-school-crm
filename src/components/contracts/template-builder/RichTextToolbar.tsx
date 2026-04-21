import { useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough,
  AlignRight, AlignCenter, AlignLeft,
  List, ListOrdered,
  Undo2, Redo2, RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/ui/color-picker";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEMPLATE_VARIABLE_GROUPS } from "./types";

interface RichTextToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  direction: "rtl" | "ltr";
  onDirectionChange: (dir: "rtl" | "ltr") => void;
  onHtmlChange: () => void;
}

export default function RichTextToolbar({ editorRef, direction, onDirectionChange, onHtmlChange }: RichTextToolbarProps) {
  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    onHtmlChange();
  }, [editorRef, onHtmlChange]);

  const isActive = useCallback((command: string) => {
    try { return document.queryCommandState(command); } catch { return false; }
  }, []);

  const insertVariable = useCallback((key: string) => {
    const sel = window.getSelection();
    if (!sel || !editorRef.current?.contains(sel.anchorNode)) {
      editorRef.current?.focus();
    }
    document.execCommand("insertText", false, `{{${key}}}`);
    onHtmlChange();
  }, [editorRef, onHtmlChange]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 bg-muted/50 rounded-t-lg border border-b-0 border-border" dir="ltr">
      {/* Text formatting */}
      <ToolbarGroup>
        <ToolBtn icon={Bold} title="מודגש (Ctrl+B)" onClick={() => exec("bold")} active={isActive("bold")} />
        <ToolBtn icon={Italic} title="נטוי (Ctrl+I)" onClick={() => exec("italic")} active={isActive("italic")} />
        <ToolBtn icon={Underline} title="קו תחתון (Ctrl+U)" onClick={() => exec("underline")} active={isActive("underline")} />
        <ToolBtn icon={Strikethrough} title="קו חוצה" onClick={() => exec("strikeThrough")} active={isActive("strikeThrough")} />
      </ToolbarGroup>

      <ToolbarSep />

      {/* Font size */}
      <ToolbarGroup>
        <Select dir="ltr" onValueChange={(v) => exec("fontSize", v)}>
          <SelectTrigger className="h-7 w-[70px] text-xs px-1.5 gap-0.5"><SelectValue placeholder="גודל" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">קטן</SelectItem>
            <SelectItem value="2">קטן+</SelectItem>
            <SelectItem value="3">רגיל</SelectItem>
            <SelectItem value="4">בינוני</SelectItem>
            <SelectItem value="5">גדול</SelectItem>
            <SelectItem value="6">גדול+</SelectItem>
            <SelectItem value="7">ענק</SelectItem>
          </SelectContent>
        </Select>
      </ToolbarGroup>

      <ToolbarSep />

      {/* Colors */}
      <ToolbarGroup>
        <ColorPicker value="#1f2937" onChange={(c) => exec("foreColor", c)} className="w-7 h-7" align="center" />
        <ColorPicker value="#ffff00" onChange={(c) => exec("hiliteColor", c)} className="w-7 h-7" align="center" />
      </ToolbarGroup>

      <ToolbarSep />

      {/* Alignment */}
      <ToolbarGroup>
        <ToolBtn icon={AlignRight} title="יישור לימין" onClick={() => exec("justifyRight")} />
        <ToolBtn icon={AlignCenter} title="מרכוז" onClick={() => exec("justifyCenter")} />
        <ToolBtn icon={AlignLeft} title="יישור לשמאל" onClick={() => exec("justifyLeft")} />
      </ToolbarGroup>

      <ToolbarSep />

      {/* Direction */}
      <ToolbarGroup>
        <button
          onClick={() => onDirectionChange("rtl")}
          className={cn("px-1.5 h-7 text-[10px] font-bold rounded transition-colors", direction === "rtl" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          title="ימין לשמאל"
        >
          RTL
        </button>
        <button
          onClick={() => onDirectionChange("ltr")}
          className={cn("px-1.5 h-7 text-[10px] font-bold rounded transition-colors", direction === "ltr" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          title="שמאל לימין"
        >
          LTR
        </button>
      </ToolbarGroup>

      <ToolbarSep />

      {/* Lists */}
      <ToolbarGroup>
        <ToolBtn icon={List} title="רשימה" onClick={() => exec("insertUnorderedList")} />
        <ToolBtn icon={ListOrdered} title="רשימה ממוספרת" onClick={() => exec("insertOrderedList")} />
      </ToolbarGroup>

      <ToolbarSep />

      {/* Undo/Redo/Clear */}
      <ToolbarGroup>
        <ToolBtn icon={Undo2} title="בטל" onClick={() => exec("undo")} />
        <ToolBtn icon={Redo2} title="בצע שוב" onClick={() => exec("redo")} />
        <ToolBtn icon={RemoveFormatting} title="נקה עיצוב" onClick={() => exec("removeFormat")} />
      </ToolbarGroup>

      <ToolbarSep />

      {/* Variables dropdown */}
      <Select dir="rtl" onValueChange={(v) => { if (v) insertVariable(v); }}>
        <SelectTrigger className="h-7 w-[90px] text-xs px-1.5 gap-0.5"><SelectValue placeholder="+ משתנה" /></SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {TEMPLATE_VARIABLE_GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel className="text-[10px] font-bold text-muted-foreground">{group.label}</SelectLabel>
              {group.variables.map((v) => (
                <SelectItem key={v.key} value={v.key} className="text-xs">{v.label}</SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToolBtn({ icon: Icon, title, onClick, active }: { icon: typeof Bold; title: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn("w-7 h-7 flex items-center justify-center rounded transition-colors", active ? "bg-primary/15 text-primary" : "hover:bg-muted text-foreground")}
      title={title}
    >
      <Icon size={14} />
    </button>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarSep() {
  return <div className="w-px h-5 bg-border mx-0.5" />;
}

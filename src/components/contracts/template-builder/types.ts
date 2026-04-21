export type BlockType =
  | "heading"
  | "paragraph"
  | "table"
  | "image"
  | "divider"
  | "spacer"
  | "signature"
  | "variable"
  | "columns"
  | "html";

export interface BlockGrid {
  x: number;  // column position (0-11)
  y: number;  // row position
  w: number;  // width in columns (1-12)
  h: number;  // height in row units
}

export interface BlockBase {
  id: string;
  type: BlockType;
  minHeight?: number;
  grid?: BlockGrid; // grid position & size
}

export interface HeadingBlock extends BlockBase {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
  align: "right" | "center" | "left";
}

export interface ParagraphBlock extends BlockBase {
  type: "paragraph";
  html: string;
  align: "right" | "center" | "left";
  direction: "rtl" | "ltr";
  fontSize: number;
}

export interface TableBlock extends BlockBase {
  type: "table";
  rows: string[][];
  headerRow: boolean;
}

export interface ImageBlock extends BlockBase {
  type: "image";
  src: string;
  alt: string;
  width: number; // percentage
  align: "right" | "center" | "left";
}

export interface DividerBlock extends BlockBase {
  type: "divider";
  style: "solid" | "dashed" | "dotted";
  color: string;
}

export interface SpacerBlock extends BlockBase {
  type: "spacer";
  height: number;
}

export interface SignatureBlock extends BlockBase {
  type: "signature";
  label: string;
}

export interface VariableBlock extends BlockBase {
  type: "variable";
  variableName: string;
  label: string;
  fontSize: number;
  bold: boolean;
}

export interface ColumnsBlock extends BlockBase {
  type: "columns";
  columns: TemplateBlock[][];
  ratio: "50-50" | "33-67" | "67-33";
}

export interface HtmlBlock extends BlockBase {
  type: "html";
  code: string;
}

export type TemplateBlock =
  | HeadingBlock
  | ParagraphBlock
  | TableBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | SignatureBlock
  | VariableBlock
  | ColumnsBlock
  | HtmlBlock;

export interface CanvasSettings {
  backgroundColor: string;
  backgroundImage: string;
  backgroundSize: "cover" | "contain" | "auto";
  backgroundPosition: "center" | "top" | "bottom";
  padding: number;
  maxWidth: number;
}

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  backgroundColor: "#ffffff",
  backgroundImage: "",
  backgroundSize: "cover",
  backgroundPosition: "center",
  padding: 24,
  maxWidth: 800,
};

export interface BlockPaletteItem {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
}

export const TEMPLATE_VARIABLE_GROUPS = [
  {
    label: "פרטי לקוח",
    variables: [
      { key: "firstName", label: "שם פרטי" },
      { key: "lastName", label: "שם משפחה" },
      { key: "fullName", label: "שם מלא" },
      { key: "email", label: "אימייל" },
      { key: "phone", label: "טלפון" },
      { key: "idNumber", label: "תעודת זהות" },
      { key: "address", label: "כתובת" },
      { key: "city", label: "עיר" },
      { key: "company", label: "חברה" },
      { key: "jobTitle", label: "תפקיד" },
    ],
  },
  {
    label: "עסקה ומוצר",
    variables: [
      { key: "dealTitle", label: "שם העסקה" },
      { key: "dealValue", label: "סכום העסקה" },
      { key: "dealCurrency", label: "מטבע" },
      { key: "productName", label: "שם המוצר" },
      { key: "productPrice", label: "מחיר המוצר" },
    ],
  },
  {
    label: "תאריכים",
    variables: [
      { key: "todayDate", label: "תאריך היום" },
      { key: "todayDateHebrew", label: "תאריך עברי" },
      { key: "todayDay", label: "יום בשבוע" },
      { key: "contractDate", label: "תאריך החוזה" },
      { key: "expiryDate", label: "תאריך תפוגה" },
    ],
  },
  {
    label: "עסק",
    variables: [
      { key: "companyName", label: "שם החברה" },
      { key: "companyAddress", label: "כתובת החברה" },
      { key: "companyPhone", label: "טלפון החברה" },
      { key: "companyEmail", label: "אימייל החברה" },
      { key: "companyId", label: 'ח.פ / ע.מ' },
    ],
  },
  {
    label: "חוזה",
    variables: [
      { key: "contractNumber", label: "מספר חוזה" },
      { key: "contractTitle", label: "כותרת החוזה" },
      { key: "paymentTerms", label: "תנאי תשלום" },
      { key: "numberOfPayments", label: "מספר תשלומים" },
    ],
  },
] as const;

/** Flat list for backward compat */
export const TEMPLATE_VARIABLES = TEMPLATE_VARIABLE_GROUPS.flatMap((g) => g.variables);

const COLS = 12;

/** Default grid size per block type */
export function defaultGridForType(type: BlockType): BlockGrid {
  switch (type) {
    case "heading":    return { x: 0, y: 999, w: COLS, h: 1 };
    case "paragraph":  return { x: 0, y: 999, w: COLS, h: 2 };
    case "table":      return { x: 0, y: 999, w: COLS, h: 3 };
    case "image":      return { x: 0, y: 999, w: 6, h: 3 };
    case "divider":    return { x: 0, y: 999, w: COLS, h: 1 };
    case "spacer":     return { x: 0, y: 999, w: COLS, h: 1 };
    case "signature":  return { x: 0, y: 999, w: 6, h: 2 };
    case "variable":   return { x: 0, y: 999, w: 4, h: 1 };
    case "columns":    return { x: 0, y: 999, w: COLS, h: 3 };
    case "html":       return { x: 0, y: 999, w: COLS, h: 3 };
  }
}

export function createDefaultBlock(type: BlockType): TemplateBlock {
  const id = crypto.randomUUID();
  const grid = defaultGridForType(type);
  switch (type) {
    case "heading":
      return { id, type, grid, level: 2, text: "כותרת חדשה", align: "right" };
    case "paragraph":
      return { id, type, grid, html: "<p>טקסט חדש...</p>", align: "right", direction: "rtl", fontSize: 14 };
    case "table":
      return { id, type, grid, rows: [["עמודה 1", "עמודה 2"], ["", ""]], headerRow: true };
    case "image":
      return { id, type, grid, src: "", alt: "", width: 100, align: "center" };
    case "divider":
      return { id, type, grid, style: "solid", color: "#e5e7eb" };
    case "spacer":
      return { id, type, grid, height: 24 };
    case "signature":
      return { id, type, grid, label: "חתימת הלקוח" };
    case "variable":
      return { id, type, grid, variableName: "firstName", label: "שם פרטי", fontSize: 14, bold: false };
    case "columns":
      return { id, type, grid, columns: [[], []], ratio: "50-50" };
    case "html":
      return { id, type, grid, code: "<!-- הכנס קוד HTML כאן -->" };
  }
}

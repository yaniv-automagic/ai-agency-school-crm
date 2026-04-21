import type { TemplateBlock, ColumnsBlock, CanvasSettings, BlockGrid } from "./types";
import { DEFAULT_CANVAS_SETTINGS, defaultGridForType } from "./types";

const GRID_COLS = 12;
const GRID_ROW_H = 60; // must match BuilderCanvas ROW_HEIGHT
const GRID_GAP = 14;   // must match BuilderCanvas margin

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert grid w units to percentage width - only for non-full-width blocks */
function gridStyles(block: TemplateBlock): string {
  const g = block.grid || defaultGridForType(block.type);
  const wPct = Math.round((g.w / GRID_COLS) * 100);
  // Full-width blocks don't need explicit width — content flows naturally
  if (wPct >= 100) return "";
  return `width:${wPct}%;display:inline-block;vertical-align:top;`;
}

function blockToHtml(block: TemplateBlock): string {
  const gs = gridStyles(block);

  switch (block.type) {
    case "heading": {
      const tag = `h${block.level}`;
      const sizes = { 1: "28px", 2: "22px", 3: "18px" };
      return `<${tag} style="text-align:${block.align};margin:0 0 8px 0;font-size:${sizes[block.level]};font-weight:bold;${gs}">${escapeHtml(block.text)}</${tag}>`;
    }

    case "paragraph": {
      const dir = block.direction || "rtl";
      return `<div style="text-align:${block.align};font-size:${block.fontSize}px;margin:0 0 8px 0;direction:${dir};${gs}" dir="${dir}">${block.html}</div>`;
    }

    case "table": {
      let html = `<table style="width:100%;border-collapse:collapse;margin:8px 0;${gs}" dir="rtl">`;
      block.rows.forEach((row, ri) => {
        html += "<tr>";
        const cellTag = block.headerRow && ri === 0 ? "th" : "td";
        const cellStyle =
          block.headerRow && ri === 0
            ? "border:1px solid #d1d5db;padding:8px;background:#f3f4f6;font-weight:bold;text-align:right;"
            : "border:1px solid #d1d5db;padding:8px;text-align:right;";
        row.forEach((cell) => {
          html += `<${cellTag} style="${cellStyle}">${escapeHtml(cell)}</${cellTag}>`;
        });
        html += "</tr>";
      });
      html += "</table>";
      return html;
    }

    case "image": {
      if (!block.src) return "";
      const g = block.grid || defaultGridForType(block.type);
      const wPct = Math.round((g.w / GRID_COLS) * 100);
      const marginMap = { center: "8px auto", right: "8px 0 8px auto", left: "8px auto 8px 0" };
      const containerStyle = wPct < 100
        ? `width:${wPct}%;margin:${marginMap[block.align]};display:block;text-align:${block.align};`
        : `text-align:${block.align};margin:8px 0;`;
      return `<div style="${containerStyle}"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="width:${block.width}%;max-width:100%;" /></div>`;
    }

    case "divider":
      return `<hr style="border:none;border-top:2px ${block.style} ${block.color};margin:16px 0;${gs}" />`;

    case "spacer":
      return `<div style="height:${block.height}px;${gs}"></div>`;

    case "signature":
      return `<div style="margin:24px 0;padding:16px;border:2px dashed #d1d5db;text-align:center;color:#9ca3af;${gs}">${escapeHtml(block.label)}: _______________</div>`;

    case "variable":
      return `<span style="font-size:${block.fontSize}px;${block.bold ? "font-weight:bold;" : ""}${gs}">{{${block.variableName}}}</span>`;

    case "html":
      return block.code;

    case "columns": {
      const col = block as ColumnsBlock;
      const [l, r] = col.ratio.split("-").map(Number);
      return `<table style="width:100%;border-collapse:collapse;margin:8px 0;${gs}" dir="rtl"><tr>
        <td style="width:${l}%;vertical-align:top;padding:0 8px 0 0;">${col.columns[0].map(blockToHtml).join("\n")}</td>
        <td style="width:${r}%;vertical-align:top;padding:0 0 0 8px;">${col.columns[1].map(blockToHtml).join("\n")}</td>
      </tr></table>`;
    }
  }
}

export function blocksToHtml(blocks: TemplateBlock[], canvasSettings?: CanvasSettings): string {
  const cs = canvasSettings || DEFAULT_CANVAS_SETTINGS;

  // Sort blocks by grid position (top to bottom, right to left for RTL)
  const sorted = [...blocks].sort((a, b) => {
    const ga = a.grid || defaultGridForType(a.type);
    const gb = b.grid || defaultGridForType(b.type);
    if (ga.y !== gb.y) return ga.y - gb.y;
    return gb.x - ga.x; // RTL: higher x = more right = first
  });

  const bodyHtml = sorted.map(blockToHtml).join("\n");

  let bgStyle = `background-color:${cs.backgroundColor};`;
  if (cs.backgroundImage) {
    bgStyle += `background-image:url('${cs.backgroundImage}');background-size:${cs.backgroundSize};background-position:${cs.backgroundPosition};background-repeat:no-repeat;`;
  }

  return `<div dir="rtl" style="font-family:'Heebo','Arial',sans-serif;line-height:1.6;color:#1f2937;max-width:${cs.maxWidth}px;margin:0 auto;padding:${cs.padding}px;${bgStyle}">\n${bodyHtml}\n</div>`;
}

export function extractVariables(blocks: TemplateBlock[]): string[] {
  const vars = new Set<string>();

  function scan(bl: TemplateBlock) {
    if (bl.type === "variable") {
      vars.add(bl.variableName);
    }
    if (bl.type === "paragraph") {
      const matches = bl.html.matchAll(/\{\{(\w+)\}\}/g);
      for (const m of matches) vars.add(m[1]);
    }
    if (bl.type === "columns") {
      bl.columns.flat().forEach(scan);
    }
  }

  blocks.forEach(scan);
  return Array.from(vars);
}

import type { TemplateBlock } from "./types";
import { TEMPLATE_VARIABLES } from "./types";

/**
 * Deep HTML-to-blocks converter.
 * Recursively walks the DOM tree and maps every element
 * to the matching block type from our architecture.
 */
export function htmlToBlocks(html: string): TemplateBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const blocks: TemplateBlock[] = [];

  // Unwrap nested wrapper divs to get to actual content
  let root: Element = doc.body;
  while (
    root.children.length === 1 &&
    root.children[0].tagName === "DIV" &&
    !hasDirectContent(root)
  ) {
    root = root.children[0];
  }

  walkChildren(root, blocks);

  // Merge consecutive tiny text-only paragraphs that are really one paragraph
  return mergeConsecutiveParagraphs(blocks);
}

/** Recursively process child nodes and extract blocks */
function walkChildren(parent: Element, blocks: TemplateBlock[]) {
  const children = Array.from(parent.childNodes);

  for (const node of children) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (!text) continue;

      // Check if it's a template variable like {{firstName}}
      const varMatch = text.match(/^\{\{(\w+)\}\}$/);
      if (varMatch) {
        pushVariableBlock(blocks, varMatch[1]);
        continue;
      }

      blocks.push(makeParagraph(text));
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // ── Headings ──
    if (/^h[1-6]$/.test(tag)) {
      const level = Math.min(Number(tag[1]), 3) as 1 | 2 | 3;
      blocks.push({
        id: crypto.randomUUID(),
        type: "heading",
        level,
        text: el.textContent?.trim() || "",
        align: parseAlign(el),
      });
      continue;
    }

    // ── HR → divider ──
    if (tag === "hr") {
      const borderStyle = el.style.borderTopStyle || el.style.borderStyle || "solid";
      const borderColor = el.style.borderTopColor || el.style.borderColor || "#e5e7eb";
      blocks.push({
        id: crypto.randomUUID(),
        type: "divider",
        style: parseBorderStyle(borderStyle),
        color: normalizeColor(borderColor),
      });
      continue;
    }

    // ── BR → spacer ──
    if (tag === "br") {
      blocks.push({ id: crypto.randomUUID(), type: "spacer", height: 16 });
      continue;
    }

    // ── IMG (standalone or inside <a>, <p>, <span>, <figure>) ──
    if (tag === "img") {
      blocks.push(makeImageBlock(el as HTMLImageElement, parent as HTMLElement));
      continue;
    }

    // Any element that only contains an image (p, a, span, figure, div)
    if (isWrapperWithSingleImage(el)) {
      const img = el.querySelector("img") as HTMLImageElement;
      blocks.push(makeImageBlock(img, el));
      continue;
    }

    // ── TABLE ──
    if (tag === "table") {
      const tableBlock = parseTable(el);
      if (tableBlock) {
        blocks.push(tableBlock);
      }
      continue;
    }

    // ── Lists (UL / OL) → paragraph with inline list styles ──
    if (tag === "ul" || tag === "ol") {
      blocks.push({
        id: crypto.randomUUID(),
        type: "paragraph",
        html: injectListStyles(el),
        align: parseAlign(el),
        direction: parseDirection(el),
        fontSize: parseFontSize(el) || 14,
      });
      continue;
    }

    // ── Standalone variable {{...}} ──
    const fullText = el.textContent?.trim() || "";
    const standaloneVar = fullText.match(/^\{\{(\w+)\}\}$/);
    if (standaloneVar && !el.querySelector("*:not(span):not(b):not(strong):not(i):not(em)")) {
      pushVariableBlock(blocks, standaloneVar[1]);
      continue;
    }

    // ── Signature-like blocks (dashed border with "חתימה" or "___") ──
    if (isSignatureBlock(el)) {
      const label = fullText.replace(/[_─—\-]+/g, "").replace(/:?\s*$/, "").trim() || "חתימה";
      blocks.push({ id: crypto.randomUUID(), type: "signature", label });
      continue;
    }

    // ── Empty div with explicit height → spacer ──
    if (isSpacerElement(el)) {
      const h = parseInt(el.style.height || el.style.minHeight || "24", 10);
      blocks.push({ id: crypto.randomUUID(), type: "spacer", height: isNaN(h) ? 24 : h });
      continue;
    }

    // ── Container divs (div, section, article, main, header, footer, span wrapping blocks) ──
    // Check if it contains block-level children → recurse into it
    if (isContainerElement(el) && hasBlockChildren(el)) {
      walkChildren(el, blocks);
      continue;
    }

    // ── Inline text with mixed content → paragraph ──
    const innerHTML = el.innerHTML?.trim();
    if (!innerHTML) continue;

    // Check for variables inside the content and preserve them
    const processedHtml = highlightVariables(innerHTML);

    blocks.push({
      id: crypto.randomUUID(),
      type: "paragraph",
      html: processedHtml,
      align: parseAlign(el),
      direction: parseDirection(el),
      fontSize: parseFontSize(el) || 14,
      minHeight: parseMinHeight(el),
    });
  }
}

// ── Block Factories ──

function makeParagraph(text: string): TemplateBlock {
  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    html: `<p>${text}</p>`,
    align: "right",
    direction: "rtl",
    fontSize: 14,
  };
}

function makeImageBlock(img: HTMLImageElement, wrapper: HTMLElement): TemplateBlock {
  return {
    id: crypto.randomUUID(),
    type: "image",
    src: img.getAttribute("src") || img.src || "",
    alt: img.getAttribute("alt") || "",
    width: parsePercent(img.style.width) || parsePercent(img.getAttribute("width")) || 100,
    align: parseAlign(wrapper),
  };
}

function pushVariableBlock(blocks: TemplateBlock[], varName: string) {
  const known = TEMPLATE_VARIABLES.find((v) => v.key === varName);
  blocks.push({
    id: crypto.randomUUID(),
    type: "variable",
    variableName: varName,
    label: known?.label || varName,
    fontSize: 14,
    bold: false,
  });
}

// ── Table Parser ──

function parseTable(el: HTMLElement): TemplateBlock | null {
  const trs = el.querySelectorAll("tr");
  if (trs.length === 0) return null;

  // Check if this is a layout table (2 columns, no borders, used for columns layout)
  if (isLayoutTable(el, trs)) {
    return parseLayoutTable(el, trs);
  }

  // Regular data table
  const rows: string[][] = [];
  let headerRow = false;

  trs.forEach((tr, ri) => {
    const cells: string[] = [];
    tr.querySelectorAll("th, td").forEach((cell) => {
      cells.push(cell.textContent?.trim() || "");
      if (cell.tagName === "TH" && ri === 0) headerRow = true;
    });
    if (cells.length) rows.push(cells);
  });

  if (rows.length === 0) return null;

  return {
    id: crypto.randomUUID(),
    type: "table",
    rows,
    headerRow,
  };
}

function isLayoutTable(el: HTMLElement, trs: NodeListOf<HTMLTableRowElement>): boolean {
  // Layout table: 1 row, 2-3 cells, no visible borders, cells contain block content
  if (trs.length !== 1) return false;
  const cells = trs[0].querySelectorAll("td");
  if (cells.length < 2 || cells.length > 3) return false;
  const hasBorder = el.style.border || el.getAttribute("border");
  if (hasBorder && hasBorder !== "0" && hasBorder !== "none") return false;
  // Check if cells contain block elements
  for (const cell of cells) {
    if (cell.querySelector("p, div, h1, h2, h3, h4, h5, h6, table, ul, ol, img")) return true;
  }
  return false;
}

function parseLayoutTable(_el: HTMLElement, trs: NodeListOf<HTMLTableRowElement>): TemplateBlock {
  const cells = trs[0].querySelectorAll("td");
  const columns: TemplateBlock[][] = [[], []];

  // Parse content of each column
  cells.forEach((cell, ci) => {
    if (ci > 1) return; // max 2 columns
    walkChildren(cell, columns[ci]);
  });

  // Determine ratio from widths
  let ratio: "50-50" | "33-67" | "67-33" = "50-50";
  const w0 = cells[0]?.style.width || cells[0]?.getAttribute("width") || "";
  const pct = parsePercent(w0);
  if (pct) {
    if (pct <= 40) ratio = "33-67";
    else if (pct >= 60) ratio = "67-33";
  }

  return {
    id: crypto.randomUUID(),
    type: "columns",
    columns,
    ratio,
  };
}

// ── Detection Helpers ──

function isSignatureBlock(el: HTMLElement): boolean {
  const style = el.style;
  const text = el.textContent || "";
  const hasDashedBorder = style.border?.includes("dashed") || style.borderStyle === "dashed";
  const hasSignatureText = /חתימ|signature|___/i.test(text);
  return hasDashedBorder || hasSignatureText;
}

function isSpacerElement(el: HTMLElement): boolean {
  const text = el.textContent?.trim();
  if (text) return false;
  const hasHeight = el.style.height || el.style.minHeight;
  const isEmptyDiv = el.tagName === "DIV" && el.children.length === 0;
  return !!(hasHeight || isEmptyDiv);
}

function isWrapperWithSingleImage(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  // Quick check: common image wrappers
  if (["a", "p", "figure", "picture", "span", "div", "center", "td"].includes(tag)) {
    const imgs = el.querySelectorAll("img");
    if (imgs.length !== 1) return false;
    // Check that there's no meaningful text besides the image
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("img, figcaption, source").forEach((i) => i.remove());
    return !clone.textContent?.trim();
  }
  return false;
}

function isContainerElement(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  return ["div", "section", "article", "main", "header", "footer", "aside", "nav", "fieldset", "details", "summary", "blockquote"].includes(tag);
}

function hasBlockChildren(el: HTMLElement): boolean {
  for (const child of el.children) {
    const tag = child.tagName.toLowerCase();
    if (["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "table", "ul", "ol", "hr", "img", "section", "article", "blockquote", "header", "footer"].includes(tag)) {
      return true;
    }
  }
  return false;
}

function hasDirectContent(el: Element): boolean {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true;
  }
  return false;
}

/** Inject inline styles onto UL/OL so bullets/numbers show even with Tailwind prose reset */
function injectListStyles(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const listType = tag === "ol" ? "decimal" : "disc";
  const dir = el.getAttribute("dir") || "rtl";
  const paddingDir = dir === "rtl" ? "padding-right" : "padding-left";

  // Clone to avoid mutating the parsed DOM
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.listStyleType = listType;
  clone.style.setProperty(paddingDir, "24px");
  clone.style.margin = "4px 0";

  clone.querySelectorAll("li").forEach((li) => {
    li.style.listStyleType = "inherit";
    li.style.display = "list-item";
    li.style.marginBottom = "2px";
  });

  // Handle nested lists
  clone.querySelectorAll("ul").forEach((ul) => {
    ul.style.listStyleType = "circle";
    ul.style.setProperty(paddingDir, "20px");
    ul.style.margin = "2px 0";
  });
  clone.querySelectorAll("ol ol").forEach((ol) => {
    ol.style.listStyleType = "lower-alpha";
    ol.style.setProperty(paddingDir, "20px");
    ol.style.margin = "2px 0";
  });

  return clone.outerHTML;
}

// ── Parsing Utilities ──

function parseAlign(el: HTMLElement): "right" | "center" | "left" {
  const v = el.style.textAlign || el.getAttribute("align") || "";
  if (v.includes("center")) return "center";
  if (v.includes("left")) return "left";
  return "right";
}

function parseDirection(el: HTMLElement): "rtl" | "ltr" {
  const dir = el.getAttribute("dir") || el.style.direction || "";
  return dir === "ltr" ? "ltr" : "rtl";
}

function parseFontSize(el: HTMLElement): number | null {
  const fs = el.style.fontSize;
  if (!fs) return null;
  const match = fs.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseMinHeight(el: HTMLElement): number | undefined {
  const mh = el.style.minHeight;
  if (!mh) return undefined;
  const match = mh.match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function parsePercent(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseBorderStyle(value: string): "solid" | "dashed" | "dotted" {
  if (value.includes("dashed")) return "dashed";
  if (value.includes("dotted")) return "dotted";
  return "solid";
}

function normalizeColor(value: string): string {
  if (!value || value === "initial" || value === "inherit") return "#e5e7eb";
  // If already hex, return as-is
  if (value.startsWith("#")) return value;
  // Try to parse rgb()
  const rgb = value.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgb) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }
  return "#e5e7eb";
}

/** Wrap {{variable}} patterns in styled spans for visibility */
function highlightVariables(html: string): string {
  return html.replace(
    /\{\{(\w+)\}\}/g,
    '<span style="background:#e0e7ff;padding:1px 4px;border-radius:3px;font-family:monospace;color:#4338ca;">{{$1}}</span>'
  );
}

/** Merge consecutive small paragraphs that are really one block of text */
function mergeConsecutiveParagraphs(blocks: TemplateBlock[]): TemplateBlock[] {
  const result: TemplateBlock[] = [];

  for (const block of blocks) {
    if (block.type !== "paragraph") {
      result.push(block);
      continue;
    }

    const prev = result[result.length - 1];
    // Merge if previous is also a short paragraph with same direction/align/fontSize
    if (
      prev?.type === "paragraph" &&
      prev.direction === block.direction &&
      prev.align === block.align &&
      prev.fontSize === block.fontSize &&
      isShortHtml(prev.html) &&
      isShortHtml(block.html)
    ) {
      prev.html = prev.html + "\n" + block.html;
      continue;
    }

    result.push(block);
  }

  return result;
}

function isShortHtml(html: string): boolean {
  // Consider "short" if under 200 chars of text content
  const text = html.replace(/<[^>]+>/g, "");
  return text.length < 200;
}

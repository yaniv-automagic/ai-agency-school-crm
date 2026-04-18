import type React from "react";
import { useRef, useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import {
  Clock, Database, Mail, MessageCircle, Plus, Tag, Trash2,
  UserPlus, Webhook, Zap, Bell, Filter, GitBranch, X,
  ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";

// ── Types ──

export interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "delay";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  position: { x: number; y: number };
  config?: Record<string, any>;
}

export interface WorkflowConnection { from: string; to: string; }

// ── Constants ──

const NODE_W = 240;
const NODE_H = 84;

export const TRIGGER_TEMPLATES: Omit<WorkflowNode, "id" | "position">[] = [
  { type: "trigger", title: "ליד נוצר", description: "כשנוצר ליד חדש במערכת", icon: UserPlus, color: "emerald" },
  { type: "trigger", title: "עסקה עודכנה", description: "כששלב עסקה משתנה בצנרת", icon: Database, color: "emerald" },
  { type: "trigger", title: "טופס נשלח", description: "כשמישהו ממלא טופס ליד", icon: Webhook, color: "emerald" },
  { type: "trigger", title: "מתוזמן", description: "הרצה בזמן קבוע (יומי/שבועי)", icon: Clock, color: "emerald" },
];

export const ACTION_TEMPLATES: Omit<WorkflowNode, "id" | "position">[] = [
  { type: "action", title: "שלח מייל", description: "שליחת מייל אוטומטי", icon: Mail, color: "blue" },
  { type: "action", title: "שלח WhatsApp", description: "שליחת הודעת WhatsApp", icon: MessageCircle, color: "green" },
  { type: "action", title: "עדכן רשומה", description: "שינוי שדה ברשומה", icon: Database, color: "violet" },
  { type: "action", title: "צור משימה", description: "יצירת משימה לאיש צוות", icon: Zap, color: "indigo" },
  { type: "action", title: "הוסף תגית", description: "הוספת תגית לליד", icon: Tag, color: "pink" },
  { type: "action", title: "Webhook", description: "שליחת HTTP request", icon: Webhook, color: "gray" },
  { type: "action", title: "התראה", description: "שליחת התראה לאיש צוות", icon: Bell, color: "amber" },
];

export const CONDITION_TEMPLATES: Omit<WorkflowNode, "id" | "position">[] = [
  { type: "condition", title: "תנאי", description: "בדוק ערך שדה", icon: GitBranch, color: "amber" },
  { type: "condition", title: "פילטר", description: "סנן רשומות", icon: Filter, color: "amber" },
];

export const DELAY_TEMPLATES: Omit<WorkflowNode, "id" | "position">[] = [
  { type: "delay", title: "המתן", description: "השהייה לפני הפעולה הבאה", icon: Clock, color: "gray" },
];

const CL: Record<string, { bg: string; border: string; text: string; iconBg: string; port: string }> = {
  emerald: { bg: "#ecfdf5", border: "#86efac", text: "#047857", iconBg: "#d1fae5", port: "#10b981" },
  blue:    { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8", iconBg: "#dbeafe", port: "#3b82f6" },
  green:   { bg: "#f0fdf4", border: "#86efac", text: "#15803d", iconBg: "#dcfce7", port: "#22c55e" },
  violet:  { bg: "#f5f3ff", border: "#a78bfa", text: "#6d28d9", iconBg: "#ede9fe", port: "#8b5cf6" },
  indigo:  { bg: "#eef2ff", border: "#818cf8", text: "#4338ca", iconBg: "#e0e7ff", port: "#6366f1" },
  pink:    { bg: "#fdf2f8", border: "#f9a8d4", text: "#be185d", iconBg: "#fce7f3", port: "#ec4899" },
  amber:   { bg: "#fffbeb", border: "#fbbf24", text: "#b45309", iconBg: "#fef3c7", port: "#f59e0b" },
  gray:    { bg: "#f9fafb", border: "#d1d5db", text: "#4b5563", iconBg: "#f3f4f6", port: "#6b7280" },
};

const TYPE_LABELS: Record<string, string> = { trigger: "טריגר", action: "פעולה", condition: "תנאי", delay: "המתנה" };

function bezierPath(x1: number, y1: number, x2: number, y2: number) {
  const cp = Math.max(Math.abs(x2 - x1) * 0.45, 60);
  return `M${x1},${y1} C${x1 + cp},${y1} ${x2 - cp},${y2} ${x2},${y2}`;
}

// ── Gallery ──

function Gallery({ onAdd, onClose, hasTrigger }: {
  onAdd: (t: Omit<WorkflowNode, "id" | "position">) => void; onClose: () => void; hasTrigger: boolean;
}) {
  const sections = [
    ...(!hasTrigger ? [{ label: "טריגרים — מתי להפעיל?", items: TRIGGER_TEMPLATES }] : []),
    { label: "פעולות — מה לעשות?", items: ACTION_TEMPLATES },
    { label: "תנאים ובקרה", items: [...CONDITION_TEMPLATES, ...DELAY_TEMPLATES] },
  ];
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-bold text-gray-900">הוסף צומת</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-4 max-h-[65vh] overflow-y-auto space-y-5">
          {sections.map(({ label, items }) => (
            <div key={label}>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</h3>
              <div className="space-y-1">
                {items.map((t, i) => {
                  const Icon = t.icon; const c = CL[t.color] || CL.gray;
                  return (
                    <button key={i} onClick={() => { onAdd(t); onClose(); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-right group">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform" style={{ background: c.iconBg }}>
                        <Icon size={18} style={{ color: c.text }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                        <p className="text-xs text-gray-500">{t.description}</p>
                      </div>
                      <Plus size={14} className="text-gray-300 group-hover:text-primary shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Context Menu ──

function CtxMenu({ x, y, onAdd, onClose, hasTrigger }: {
  x: number; y: number; onAdd: (t: Omit<WorkflowNode, "id" | "position">) => void; onClose: () => void; hasTrigger: boolean;
}) {
  const sections = [
    ...(!hasTrigger ? [{ label: "טריגרים", items: TRIGGER_TEMPLATES }] : []),
    { label: "פעולות", items: ACTION_TEMPLATES },
    { label: "תנאים", items: CONDITION_TEMPLATES },
    { label: "המתנה", items: DELAY_TEMPLATES },
  ];
  // Position: keep menu in viewport
  const menuStyle: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 400),
  };
  return (
    <>
      <div className="fixed inset-0 z-[55]" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }} />
      <div className="fixed z-[56] bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-56 max-h-[70vh] overflow-y-auto" style={menuStyle} dir="rtl">
        {sections.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
            {items.map((t, i) => {
              const Icon = t.icon; const c = CL[t.color] || CL.gray;
              return (
                <button key={i} onClick={() => { onAdd(t); onClose(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 text-right text-[13px]">
                  <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: c.iconBg }}>
                    <Icon size={13} style={{ color: c.text }} />
                  </div>
                  <span className="text-gray-700 font-medium">{t.title}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Main ──

interface WorkflowCanvasProps {
  initialNodes?: WorkflowNode[];
  initialConnections?: WorkflowConnection[];
  onNodesChange?: (nodes: WorkflowNode[]) => void;
  onConnectionsChange?: (connections: WorkflowConnection[]) => void;
  onNodeClick?: (node: WorkflowNode) => void;
  readOnly?: boolean;
}

export function WorkflowCanvas({ initialNodes, initialConnections, onNodesChange, onConnectionsChange, onNodeClick, readOnly = false }: WorkflowCanvasProps) {
  const [nodes, setNodes] = useState<WorkflowNode[]>(
    initialNodes || [{ id: "node-1", type: "trigger", title: "ליד נוצר", description: "כשנוצר ליד חדש", icon: UserPlus, color: "emerald", position: { x: 60, y: 100 } }]
  );
  const [conns, setConns] = useState<WorkflowConnection[]>(initialConnections || []);
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySrc, setGallerySrc] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [wireDrag, setWireDrag] = useState<{ fromId: string; mx: number; my: number } | null>(null);
  const [hoveredConn, setHoveredConn] = useState<string | null>(null);

  const hasTrigger = nodes.some(n => n.type === "trigger");
  const emit = useCallback((ns: WorkflowNode[]) => { setNodes(ns); onNodesChange?.(ns); }, [onNodesChange]);
  const emitC = useCallback((cs: WorkflowConnection[]) => { setConns(cs); onConnectionsChange?.(cs); }, [onConnectionsChange]);

  const contentW = Math.max(...nodes.map(n => n.position.x + NODE_W + 160), 900);
  const contentH = Math.max(...nodes.map(n => n.position.y + NODE_H + 100), 420);

  // ── Zoom (wheel) ──
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.min(2, Math.max(0.4, z - e.deltaY * 0.001)));
    }
  }, []);

  const zoomIn = () => setZoom(z => Math.min(2, z + 0.15));
  const zoomOut = () => setZoom(z => Math.max(0.4, z - 0.15));
  const zoomReset = () => setZoom(1);

  // ── Pointer-based node drag ──
  const onNodePointerDown = (e: React.PointerEvent, id: string) => {
    if (readOnly || e.button !== 0) return;
    // Don't start drag if clicking a button inside the node
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    const n = nodes.find(n => n.id === id);
    if (!n) return;
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, ox: n.position.x, oy: n.position.y };
  };

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      const dx = (e.clientX - dragRef.current.sx) / zoom;
      const dy = (e.clientY - dragRef.current.sy) / zoom;
      emit(nodes.map(n => n.id === dragRef.current!.id
        ? { ...n, position: { x: Math.max(0, dragRef.current!.ox + dx), y: Math.max(0, dragRef.current!.oy + dy) } }
        : n
      ));
    }
    if (wireDrag && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setWireDrag(p => p ? { ...p, mx: (e.clientX - rect.left + canvasRef.current!.scrollLeft) / zoom, my: (e.clientY - rect.top + canvasRef.current!.scrollTop) / zoom } : null);
    }
  }, [nodes, emit, wireDrag, zoom]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    if (wireDrag && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = (e.clientX - rect.left + canvasRef.current.scrollLeft) / zoom;
      const my = (e.clientY - rect.top + canvasRef.current.scrollTop) / zoom;
      for (const n of nodes) {
        if (n.id === wireDrag.fromId) continue;
        if (Math.abs(mx - n.position.x) < 30 && Math.abs(my - (n.position.y + NODE_H / 2)) < 30) {
          if (!conns.find(c => c.from === wireDrag.fromId && c.to === n.id)) {
            emitC([...conns, { from: wireDrag.fromId, to: n.id }]);
          }
          break;
        }
      }
      setWireDrag(null);
    }
  }, [wireDrag, nodes, conns, emitC, zoom]);

  const startWire = (fromId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const n = nodes.find(n => n.id === fromId);
    if (!n) return;
    setWireDrag({ fromId, mx: n.position.x + NODE_W + 20, my: n.position.y + NODE_H / 2 });
  };

  // ── Add node helpers ──
  const addNodeAt = useCallback((tpl: Omit<WorkflowNode, "id" | "position">, pos: { x: number; y: number }, connectFrom?: string) => {
    const id = `node-${Date.now()}`;
    const nn = [...nodes, { id, ...tpl, position: pos }];
    emit(nn);
    if (connectFrom) emitC([...conns, { from: connectFrom, to: id }]);
    setTimeout(() => canvasRef.current?.scrollTo({ left: pos.x * zoom - 100, behavior: "smooth" }), 50);
  }, [nodes, conns, emit, emitC, zoom]);

  const addFromGallery = useCallback((tpl: Omit<WorkflowNode, "id" | "position">) => {
    const src = gallerySrc ? nodes.find(n => n.id === gallerySrc) : nodes[nodes.length - 1];
    const pos = src ? { x: src.position.x + NODE_W + 80, y: src.position.y } : { x: 60, y: 100 };
    addNodeAt(tpl, pos, src?.id);
    setGallerySrc(null);
  }, [nodes, gallerySrc, addNodeAt]);

  const removeNode = useCallback((id: string) => {
    emit(nodes.filter(n => n.id !== id));
    emitC(conns.filter(c => c.from !== id && c.to !== id));
    if (selectedId === id) setSelectedId(null);
  }, [nodes, conns, emit, emitC, selectedId]);

  const onCtx = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    setCtxMenu({ x: e.clientX, y: e.clientY, cx: (e.clientX - r.left + canvasRef.current.scrollLeft) / zoom, cy: (e.clientY - r.top + canvasRef.current.scrollTop) / zoom });
  };

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden rounded-xl border border-gray-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/80 shrink-0" dir="rtl">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {nodes.length} צמתים
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-[11px] font-semibold text-violet-700">
            {conns.length} חיבורים
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={zoomOut} className="px-1.5 py-1 hover:bg-gray-100 text-gray-500"><ZoomOut size={14} /></button>
            <span className="px-2 text-[11px] font-mono text-gray-500 border-x border-gray-200 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} className="px-1.5 py-1 hover:bg-gray-100 text-gray-500"><ZoomIn size={14} /></button>
            <button onClick={zoomReset} className="px-1.5 py-1 hover:bg-gray-100 text-gray-500 border-r border-gray-200"><Maximize2 size={12} /></button>
          </div>
          {!readOnly && (
            <Button size="sm" onClick={() => { setGallerySrc(null); setShowGallery(true); }} className="h-7 gap-1 rounded-lg text-xs font-semibold">
              <Plus size={13} /> הוסף צומת
            </Button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        dir="ltr"
        className="flex-1 overflow-auto relative select-none"
        style={{
          backgroundColor: "#fafafb",
          backgroundImage: "linear-gradient(to right, #ebebeb 1px, transparent 1px), linear-gradient(to bottom, #ebebeb 1px, transparent 1px)",
          backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={onCtx}
        onWheel={onWheel}
      >
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "0 0", minWidth: contentW, minHeight: contentH, position: "relative" }}>

          {/* SVG */}
          <svg className="absolute inset-0 pointer-events-none" width={contentW} height={contentH} style={{ overflow: "visible" }}>
            {conns.map(c => {
              const a = nodes.find(n => n.id === c.from), b = nodes.find(n => n.id === c.to);
              if (!a || !b) return null;
              const connKey = `${c.from}-${c.to}`;
              const isHovered = hoveredConn === connKey;
              const p = bezierPath(a.position.x + NODE_W, a.position.y + NODE_H / 2, b.position.x, b.position.y + NODE_H / 2);
              // Midpoint for delete button
              const mx = (a.position.x + NODE_W + b.position.x) / 2;
              const my = (a.position.y + NODE_H / 2 + b.position.y + NODE_H / 2) / 2;
              return (
                <g key={connKey}>
                  {/* Wide invisible hover area */}
                  <path d={p} fill="none" stroke="transparent" strokeWidth={20}
                    className="pointer-events-auto cursor-pointer"
                    onMouseEnter={() => setHoveredConn(connKey)}
                    onMouseLeave={() => setHoveredConn(null)} />
                  {/* Visible line */}
                  <path d={p} fill="none" stroke={isHovered ? "#ef4444" : "#c4b5fd"} strokeWidth={isHovered ? 3 : 2} strokeLinecap="round"
                    style={{ transition: "stroke 0.15s, stroke-width 0.15s" }} />
                  {/* End dot */}
                  <circle cx={b.position.x} cy={b.position.y + NODE_H / 2} r={3.5} fill={isHovered ? "#ef4444" : "#8b5cf6"} />
                  {/* Animated pulse (hidden when hovered) */}
                  {!isHovered && (
                    <circle r="2.5" fill="#8b5cf6" opacity="0.5"><animateMotion dur="2.5s" repeatCount="indefinite" path={p} /></circle>
                  )}
                  {/* Delete button at midpoint */}
                  {isHovered && !readOnly && (
                    <g className="pointer-events-auto cursor-pointer"
                      onClick={() => { emitC(conns.filter(cc => !(cc.from === c.from && cc.to === c.to))); setHoveredConn(null); }}
                      onMouseEnter={() => setHoveredConn(connKey)}>
                      <circle cx={mx} cy={my} r={12} fill="white" stroke="#fca5a5" strokeWidth={1.5} />
                      <line x1={mx - 4} y1={my - 4} x2={mx + 4} y2={my + 4} stroke="#ef4444" strokeWidth={2} strokeLinecap="round" />
                      <line x1={mx + 4} y1={my - 4} x2={mx - 4} y2={my + 4} stroke="#ef4444" strokeWidth={2} strokeLinecap="round" />
                    </g>
                  )}
                </g>
              );
            })}
            {wireDrag && (() => {
              const fn = nodes.find(n => n.id === wireDrag.fromId);
              if (!fn) return null;
              return <path d={bezierPath(fn.position.x + NODE_W, fn.position.y + NODE_H / 2, wireDrag.mx, wireDrag.my)} fill="none" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6,4" opacity={0.6} />;
            })()}
          </svg>

          {/* Nodes */}
          {nodes.map(node => {
            const Icon = node.icon;
            const c = CL[node.color] || CL.gray;
            const isSel = selectedId === node.id;

            return (
              <div
                key={node.id}
                className="workflow-node absolute group/node"
                style={{ left: node.position.x, top: node.position.y, width: NODE_W, height: NODE_H, zIndex: isSel ? 10 : 1 }}
                onPointerDown={e => onNodePointerDown(e, node.id)}
                onClick={() => { setSelectedId(node.id); onNodeClick?.(node); }}
              >
                <div className={`w-full h-full rounded-2xl border-2 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-lg ${isSel ? "shadow-lg" : "shadow-sm"}`}
                  style={{ background: c.bg, borderColor: isSel ? c.port : c.border }}>
                  <div className="flex items-center gap-3 px-4 h-full" dir="rtl">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.iconBg }}>
                      <Icon size={20} style={{ color: c.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c.text, opacity: 0.6 }}>{TYPE_LABELS[node.type]}</span>
                      <h4 className="text-[13px] font-bold text-gray-900 truncate leading-tight">{node.title}</h4>
                      <p className="text-[11px] text-gray-400 truncate">{node.description}</p>
                    </div>
                  </div>
                </div>

                {/* Delete ✕ */}
                {!readOnly && (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); removeNode(node.id); }}
                    className="absolute -top-2.5 -right-2.5 z-20 w-6 h-6 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center opacity-0 group-hover/node:opacity-100 transition-opacity hover:bg-red-50 hover:border-red-300"
                  >
                    <X size={11} className="text-red-500" />
                  </button>
                )}

                {/* Output port (right) — drag to connect */}
                <div className="absolute top-1/2 -translate-y-1/2 -right-[6px] z-10 cursor-crosshair" onPointerDown={e => startWire(node.id, e)}>
                  <div className="w-[12px] h-[12px] rounded-full border-[2.5px] border-white shadow" style={{ background: c.port }} />
                </div>

                {/* Input port (left) — hidden on trigger nodes */}
                {node.type !== "trigger" && (
                  <div className="absolute top-1/2 -translate-y-1/2 -left-[6px] z-10">
                    <div className="w-[12px] h-[12px] rounded-full border-[2.5px] border-white shadow" style={{ background: c.port }} />
                  </div>
                )}

                {/* ＋ button right of node */}
                {!readOnly && (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); setGallerySrc(node.id); setShowGallery(true); }}
                    className="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/node:opacity-100 transition-all z-20 w-7 h-7 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:scale-110 active:scale-95"
                    style={{ right: -34 }}
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Empty */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center" dir="rtl">
              <div className="text-center">
                <Zap size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm font-medium text-gray-400 mb-1">אין צמתים בתהליך</p>
                <p className="text-xs text-gray-300 mb-4">לחץ "הוסף צומת" או קליק ימני על הקנבס</p>
                <Button size="sm" onClick={() => setShowGallery(true)} className="rounded-lg"><Plus size={14} className="ml-1" /> הוסף צומת ראשון</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!readOnly && nodes.length > 0 && (
        <div className="px-3 py-1 border-t border-gray-100 bg-gray-50/50 shrink-0 text-center">
          <p className="text-[10px] text-gray-400" dir="rtl">גרור צמתים • גרור מנקודה ליצירת חיבור • קליק ימני להוספה • Ctrl+גלגלת לזום • לחץ על קו למחיקתו</p>
        </div>
      )}

      {showGallery && <Gallery hasTrigger={hasTrigger} onAdd={addFromGallery} onClose={() => { setShowGallery(false); setGallerySrc(null); }} />}
      {ctxMenu && <CtxMenu x={ctxMenu.x} y={ctxMenu.y} hasTrigger={hasTrigger} onAdd={tpl => { addNodeAt(tpl, { x: ctxMenu.cx, y: ctxMenu.cy }); setCtxMenu(null); }} onClose={() => setCtxMenu(null)} />}
    </div>
  );
}

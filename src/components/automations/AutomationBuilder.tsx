import { useState, useEffect } from "react";
import { X, Save, Loader2, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  WorkflowCanvas,
  type WorkflowNode,
  type WorkflowConnection,
  TRIGGER_TEMPLATES,
  ACTION_TEMPLATES,
  CONDITION_TEMPLATES,
  DELAY_TEMPLATES,
} from "@/components/ui/workflow-canvas";
import NodeConfigPanel from "./NodeConfigPanel";

interface AutomationBuilderProps {
  automationId?: string | null;
  onClose: () => void;
}

const ALL_TEMPLATES = [...TRIGGER_TEMPLATES, ...ACTION_TEMPLATES, ...CONDITION_TEMPLATES, ...DELAY_TEMPLATES];

function serializeNodes(nodes: WorkflowNode[]): any[] {
  return nodes.map(n => ({
    id: n.id, type: n.type, title: n.title, description: n.description,
    color: n.color, position: n.position, config: n.config || {},
  }));
}

function deserializeNodes(stored: any[]): WorkflowNode[] {
  return stored.map(s => {
    const tpl = ALL_TEMPLATES.find(t => t.title === s.title);
    return { ...s, icon: tpl?.icon || Zap, color: s.color || tpl?.color || "gray" };
  });
}

export default function AutomationBuilder({ automationId, onClose }: AutomationBuilderProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [connections, setConnections] = useState<WorkflowConnection[]>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [loaded, setLoaded] = useState(!automationId);

  useEffect(() => {
    if (!automationId) return;
    supabase.from("crm_automations").select("*").eq("id", automationId).single().then(({ data }) => {
      if (data) {
        setName(data.name);
        setDescription(data.description || "");
        if (data.trigger_config?.workflow_nodes) {
          setNodes(deserializeNodes(data.trigger_config.workflow_nodes));
          setConnections(data.trigger_config.workflow_connections || []);
        }
      }
      setLoaded(true);
    });
  }, [automationId]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("יש להזין שם לאוטומציה"); return; }
    if (nodes.length === 0) { toast.error("יש להוסיף לפחות צומת אחד"); return; }
    setSaving(true);

    const trigger = nodes.find(n => n.type === "trigger");
    let triggerType = "record_created";
    if (trigger?.title.includes("עודכנ")) triggerType = "record_updated";
    else if (trigger?.title.includes("טופס")) triggerType = "form_submitted";
    else if (trigger?.title.includes("מתוזמן")) triggerType = "scheduled";

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      trigger_type: triggerType,
      trigger_config: {
        workflow_nodes: serializeNodes(nodes),
        workflow_connections: connections,
        ...(trigger?.config || {}),
      },
      conditions: [],
      actions: nodes.filter(n => n.type === "action").map(n => ({
        type: n.config?.actionType || "update_record", config: n.config || {},
      })),
      is_active: false,
    };

    const { error } = automationId
      ? await supabase.from("crm_automations").update(payload).eq("id", automationId)
      : await supabase.from("crm_automations").insert(payload);

    setSaving(false);
    if (error) { toast.error(`שגיאה: ${error.message}`); return; }
    toast.success(automationId ? "אוטומציה עודכנה" : "אוטומציה נוצרה");
    qc.invalidateQueries({ queryKey: ["automations"] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="absolute inset-4 md:inset-8 lg:inset-12 bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 shrink-0" dir="rtl">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Zap size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="שם האוטומציה..."
              className="text-lg font-bold bg-transparent outline-none w-full text-gray-900 placeholder:text-gray-300"
            />
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="תיאור קצר (אופציונלי)"
              className="text-sm bg-transparent outline-none w-full text-gray-500 placeholder:text-gray-300 mt-0.5"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "שומר..." : "שמור אוטומציה"}
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Canvas ── */}
        <div className="flex-1 overflow-hidden relative">
          {loaded ? (
            <WorkflowCanvas
              initialNodes={nodes.length > 0 ? nodes : undefined}
              initialConnections={connections.length > 0 ? connections : undefined}
              onNodesChange={setNodes}
              onConnectionsChange={setConnections}
              onNodeClick={setSelectedNode}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          )}

          {/* Config Panel */}
          {selectedNode && (
            <NodeConfigPanel
              node={selectedNode}
              onSave={(config, title, desc) => {
                setNodes(prev => prev.map(n =>
                  n.id === selectedNode.id
                    ? { ...n, config, title: title || n.title, description: desc || n.description }
                    : n
                ));
                setSelectedNode(null);
              }}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Save, ArrowRight, Pencil, Check, X } from "lucide-react";
import { usePipelines } from "@/hooks/useDeals";
import { supabaseAdmin } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Pipeline, PipelineStage } from "@/types/crm";
import { useNavigate } from "react-router-dom";

const STAGE_COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4",
];

export default function PipelineSettingsPage() {
  const { data: pipelines, isLoading } = usePipelines();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [pipelineName, setPipelineName] = useState("");
  const [defaultStageId, setDefaultStageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const selectedPipeline = pipelines?.find(p => p.id === selectedId);

  useEffect(() => {
    if (pipelines?.length && !selectedId) {
      setSelectedId(pipelines[0].id);
    }
  }, [pipelines, selectedId]);

  useEffect(() => {
    if (selectedPipeline) {
      setStages(selectedPipeline.stages || []);
      setPipelineName(selectedPipeline.name);
      setDefaultStageId(selectedPipeline.default_stage_id);
    }
  }, [selectedPipeline]);

  const addStage = () => {
    const newStage: PipelineStage = {
      id: `new-${Date.now()}`,
      pipeline_id: selectedId!,
      name: "",
      order_index: stages.length,
      color: STAGE_COLORS[stages.length % STAGE_COLORS.length],
      probability: 0,
      is_won: false,
      is_lost: false,
      created_at: new Date().toISOString(),
    };
    setStages([...stages, newStage]);
  };

  const updateStage = (index: number, updates: Partial<PipelineStage>) => {
    setStages(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const removeStage = (index: number) => {
    setStages(prev => prev.filter((_, i) => i !== index));
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const newStages = [...stages];
    [newStages[index], newStages[target]] = [newStages[target], newStages[index]];
    setStages(newStages.map((s, i) => ({ ...s, order_index: i })));
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);

    // Update pipeline name and default stage
    const pipelineUpdates: Record<string, any> = {};
    if (pipelineName !== selectedPipeline?.name) pipelineUpdates.name = pipelineName;
    if (defaultStageId !== selectedPipeline?.default_stage_id) pipelineUpdates.default_stage_id = defaultStageId;
    if (Object.keys(pipelineUpdates).length > 0) {
      await supabaseAdmin.from("crm_pipelines").update(pipelineUpdates).eq("id", selectedId);
    }

    // Delete removed stages
    const existingIds = selectedPipeline?.stages?.map(s => s.id) || [];
    const currentIds = stages.filter(s => !s.id.startsWith("new-")).map(s => s.id);
    const deletedIds = existingIds.filter(id => !currentIds.includes(id));
    for (const id of deletedIds) {
      await supabaseAdmin.from("crm_pipeline_stages").delete().eq("id", id);
    }

    // Upsert stages
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const data = {
        pipeline_id: selectedId,
        name: stage.name,
        order_index: i,
        color: stage.color,
        probability: stage.probability,
        is_won: stage.is_won,
        is_lost: stage.is_lost,
      };

      if (stage.id.startsWith("new-")) {
        await supabaseAdmin.from("crm_pipeline_stages").insert(data);
      } else {
        await supabaseAdmin.from("crm_pipeline_stages").update(data).eq("id", stage.id);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    toast.success("צנרת עודכנה בהצלחה");
    setSaving(false);
  };

  const createPipeline = async () => {
    if (!newPipelineName.trim()) return;
    const { data, error } = await supabase
      .from("crm_pipelines")
      .insert({ name: newPipelineName.trim(), is_default: false })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }

    // Create default stages
    await supabaseAdmin.from("crm_pipeline_stages").insert([
      { pipeline_id: data.id, name: "חדש", order_index: 0, color: "#3b82f6", probability: 10 },
      { pipeline_id: data.id, name: "בתהליך", order_index: 1, color: "#f97316", probability: 50 },
      { pipeline_id: data.id, name: "סגירה", order_index: 2, color: "#22c55e", probability: 100, is_won: true },
      { pipeline_id: data.id, name: "אבוד", order_index: 3, color: "#ef4444", probability: 0, is_lost: true },
    ]);

    queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    setSelectedId(data.id);
    setShowNewPipeline(false);
    setNewPipelineName("");
    toast.success("צנרת חדשה נוצרה");
  };

  const deletePipeline = async () => {
    if (!selectedId || pipelines?.length === 1) {
      toast.error("חייב להישאר לפחות צנרת אחת");
      return;
    }
    if (!confirm("למחוק את הצנרת? כל העסקאות המשויכות ימחקו!")) return;

    await supabaseAdmin.from("crm_pipelines").delete().eq("id", selectedId);
    queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    setSelectedId(null);
    toast.success("צנרת נמחקה");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground">
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">ניהול צנרות מכירות</h1>
          <p className="text-muted-foreground text-sm">הגדרת שלבים, צבעים והסתברויות</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Pipeline list */}
          <div className="space-y-2">
            {pipelines?.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full text-right px-4 py-3 rounded-xl border transition-all text-sm",
                  selectedId === p.id
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <span>{p.name}</span>
                  {p.is_default && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">ברירת מחדל</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.stages?.length || 0} שלבים
                </p>
              </button>
            ))}

            {showNewPipeline ? (
              <div className="flex gap-2">
                <input
                  value={newPipelineName}
                  onChange={e => setNewPipelineName(e.target.value)}
                  placeholder="שם הצנרת"
                  className="flex-1 px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && createPipeline()}
                />
                <button onClick={createPipeline} className="p-2 text-primary hover:bg-primary/10 rounded-lg">
                  <Check size={16} />
                </button>
                <button onClick={() => setShowNewPipeline(false)} className="p-2 text-muted-foreground hover:bg-secondary rounded-lg">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewPipeline(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-primary border border-dashed border-primary/30 rounded-xl hover:bg-primary/5"
              >
                <Plus size={14} />
                צנרת חדשה
              </button>
            )}
          </div>

          {/* Stage editor */}
          {selectedPipeline && (
            <div className="lg:col-span-3 space-y-4">
              {/* Pipeline name */}
              <div className="flex items-center gap-3">
                {editingName ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={pipelineName}
                      onChange={e => setPipelineName(e.target.value)}
                      className="text-lg font-bold px-3 py-1 border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring flex-1"
                      autoFocus
                    />
                    <button onClick={() => setEditingName(false)} className="p-1 text-primary">
                      <Check size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <h2 className="text-lg font-bold">{pipelineName}</h2>
                    <button onClick={() => setEditingName(true)} className="p-1 text-muted-foreground hover:text-foreground">
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
                <button
                  onClick={deletePipeline}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-lg text-sm"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Default stage selector */}
              <div className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3">
                <label className="text-sm font-medium whitespace-nowrap">שלב ברירת מחדל ללידים חדשים</label>
                <select
                  value={defaultStageId || ""}
                  onChange={e => setDefaultStageId(e.target.value || null)}
                  className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-input rounded-lg bg-background"
                >
                  <option value="">שלב ראשון (אוטומטי)</option>
                  {stages.filter(s => !s.id.startsWith("new-")).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Stages table */}
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="w-8 px-2 py-2.5"></th>
                      <th className="w-10 px-2 py-2.5 text-right font-medium text-muted-foreground">צבע</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">שם השלב</th>
                      <th className="w-24 px-3 py-2.5 text-right font-medium text-muted-foreground">הסתברות</th>
                      <th className="w-20 px-3 py-2.5 text-center font-medium text-muted-foreground">נסגר</th>
                      <th className="w-20 px-3 py-2.5 text-center font-medium text-muted-foreground">אבוד</th>
                      <th className="w-16 px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stages.map((stage, idx) => (
                      <tr key={stage.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        {/* Drag / reorder */}
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveStage(idx, -1)}
                              disabled={idx === 0}
                              className="text-[10px] text-muted-foreground disabled:opacity-20 hover:text-foreground"
                            >▲</button>
                            <button
                              onClick={() => moveStage(idx, 1)}
                              disabled={idx === stages.length - 1}
                              className="text-[10px] text-muted-foreground disabled:opacity-20 hover:text-foreground"
                            >▼</button>
                          </div>
                        </td>

                        {/* Color */}
                        <td className="px-2 py-2">
                          <div className="relative">
                            <input
                              type="color"
                              value={stage.color || "#6366f1"}
                              onChange={e => updateStage(idx, { color: e.target.value })}
                              className="w-7 h-7 rounded-lg border-0 cursor-pointer"
                            />
                          </div>
                        </td>

                        {/* Name */}
                        <td className="px-3 py-2">
                          <input
                            value={stage.name}
                            onChange={e => updateStage(idx, { name: e.target.value })}
                            className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-input focus:border-input bg-transparent outline-none focus:bg-background"
                            placeholder="שם השלב"
                          />
                        </td>

                        {/* Probability */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={stage.probability}
                              onChange={e => updateStage(idx, { probability: Number(e.target.value) })}
                              min={0}
                              max={100}
                              className="w-16 px-2 py-1 text-sm border border-transparent rounded hover:border-input focus:border-input bg-transparent outline-none focus:bg-background text-center"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </td>

                        {/* Is Won */}
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={stage.is_won}
                            onChange={e => updateStage(idx, { is_won: e.target.checked, is_lost: e.target.checked ? false : stage.is_lost })}
                            className="w-4 h-4 rounded accent-green-500"
                          />
                        </td>

                        {/* Is Lost */}
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={stage.is_lost}
                            onChange={e => updateStage(idx, { is_lost: e.target.checked, is_won: e.target.checked ? false : stage.is_won })}
                            className="w-4 h-4 rounded accent-red-500"
                          />
                        </td>

                        {/* Delete */}
                        <td className="px-2 py-2">
                          <button
                            onClick={() => removeStage(idx)}
                            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={addStage}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-dashed border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <Plus size={14} />
                  הוסף שלב
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 mr-auto"
                >
                  <Save size={14} />
                  {saving ? "שומר..." : "שמור שינויים"}
                </button>
              </div>

              {/* Visual preview */}
              <div>
                <h3 className="text-sm font-medium mb-3 text-muted-foreground">תצוגה מקדימה</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {stages.filter(s => !s.is_lost).map(stage => (
                    <div
                      key={stage.id}
                      className="flex-shrink-0 w-32 p-3 rounded-xl border border-border bg-card text-center"
                    >
                      <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: stage.color || "#6366f1" }} />
                      <p className="text-xs font-medium truncate">{stage.name || "..."}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stage.probability}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

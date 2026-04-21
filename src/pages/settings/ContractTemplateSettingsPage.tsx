import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowRight, FileSignature, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { useContractTemplates, useCreateContractTemplate, useUpdateContractTemplate, useDeleteContractTemplate } from "@/hooks/useContracts";
import { useConfirm } from "@/components/ui/confirm-dialog";
import ContractTemplateBuilder from "@/components/contracts/template-builder/ContractTemplateBuilder";
import type { TemplateBlock, CanvasSettings } from "@/components/contracts/template-builder/types";

type View = "list" | "create" | "edit";

export default function ContractTemplateSettingsPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data: templates, isLoading } = useContractTemplates();
  const createTemplate = useCreateContractTemplate();
  const updateTemplate = useUpdateContractTemplate();
  const deleteTemplate = useDeleteContractTemplate();

  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBlocks, setEditBlocks] = useState<TemplateBlock[]>([]);
  const [editCanvasSettings, setEditCanvasSettings] = useState<CanvasSettings | undefined>();
  const [editName, setEditName] = useState("");

  const handleCreate = () => {
    setEditingId(null);
    setEditBlocks([]);
    setEditCanvasSettings(undefined);
    setEditName("תבנית חדשה");
    setView("create");
  };

  const handleEdit = (template: { id: string; name: string; blocks_json?: TemplateBlock[]; canvas_settings?: CanvasSettings }) => {
    setEditingId(template.id);
    setEditBlocks(template.blocks_json || []);
    setEditCanvasSettings(template.canvas_settings);
    setEditName(template.name);
    setView("edit");
  };

  const handleSave = async (data: { blocks: TemplateBlock[]; bodyHtml: string; variables: string[]; name: string; canvasSettings: CanvasSettings }) => {
    if (view === "create") {
      await createTemplate.mutateAsync({
        name: data.name,
        body_html: data.bodyHtml,
        variables: data.variables,
        blocks_json: data.blocks as unknown as Record<string, unknown>[],
        canvas_settings: data.canvasSettings as unknown as Record<string, unknown>,
        is_active: true,
      });
      toast.success("תבנית נוצרה בהצלחה");
    } else if (editingId) {
      await updateTemplate.mutateAsync({
        id: editingId,
        name: data.name,
        body_html: data.bodyHtml,
        variables: data.variables,
        blocks_json: data.blocks as unknown as Record<string, unknown>[],
        canvas_settings: data.canvasSettings as unknown as Record<string, unknown>,
      });
      toast.success("תבנית עודכנה בהצלחה");
    }
    setView("list");
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: "מחיקת תבנית",
      description: `האם למחוק את התבנית "${name}"? פעולה זו אינה הפיכה.`,
      confirmText: "מחק",
      variant: "destructive",
    });
    if (ok) {
      await deleteTemplate.mutateAsync(id);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await updateTemplate.mutateAsync({ id, is_active: !isActive });
    toast.success(isActive ? "תבנית הושבתה" : "תבנית הופעלה");
  };

  if (view !== "list") {
    return (
      <ContractTemplateBuilder
        initialBlocks={editBlocks}
        initialCanvasSettings={editCanvasSettings}
        templateName={editName}
        onSave={handleSave}
        onBack={() => setView("list")}
        saving={createTemplate.isPending || updateTemplate.isPending}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/settings")} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">תבניות חוזים</h1>
            <p className="text-muted-foreground text-sm">בנה ונהל תבניות חוזים עם עורך ויזואלי</p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm transition-colors"
        >
          <Plus size={16} />
          תבנית חדשה
        </button>
      </div>

      {/* Template List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : !templates?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-card border rounded-xl">
          <FileSignature size={48} className="mb-4 opacity-40" />
          <p className="text-lg font-medium mb-1">אין תבניות חוזים</p>
          <p className="text-sm mb-4">צור תבנית ראשונה כדי להתחיל</p>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
          >
            <Plus size={16} />
            צור תבנית
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map((tpl) => {
            const extra = tpl as Record<string, unknown>;
            return (
              <div key={tpl.id} className="flex items-center justify-between p-4 bg-card border rounded-xl hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-500">
                    <FileSignature size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{tpl.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{tpl.variables?.length || 0} משתנים</span>
                      <span>·</span>
                      <span>{tpl.is_active ? "פעיל" : "מושבת"}</span>
                      <span>·</span>
                      <span>{new Date(tpl.created_at).toLocaleDateString("he-IL")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleActive(tpl.id, tpl.is_active)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title={tpl.is_active ? "השבת" : "הפעל"}
                  >
                    {tpl.is_active ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
                  </button>
                  <button
                    onClick={() => handleEdit({
                      id: tpl.id,
                      name: tpl.name,
                      blocks_json: extra.blocks_json as TemplateBlock[] | undefined,
                      canvas_settings: extra.canvas_settings as CanvasSettings | undefined,
                    })}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="ערוך"
                  >
                    <Pencil size={16} className="text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(tpl.id, tpl.name)}
                    className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                    title="מחק"
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

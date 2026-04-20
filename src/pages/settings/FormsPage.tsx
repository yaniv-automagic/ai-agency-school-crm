import { useState } from "react";
import { Plus, FileText, Copy, ExternalLink, Trash2, Eye, Code, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Form {
  id: string;
  name: string;
  slug: string;
  fields: FormField[];
  settings: Record<string, any>;
  pipeline_id: string | null;
  source_tag: string | null;
  submission_count: number;
  is_active: boolean;
  created_at: string;
}

interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "select" | "textarea" | "checkbox";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // for select
  mapTo?: string; // CRM field mapping: first_name, last_name, email, phone, company, etc.
}

const FIELD_TYPES = [
  { value: "text", label: "טקסט" },
  { value: "email", label: "מייל" },
  { value: "phone", label: "טלפון" },
  { value: "select", label: "בחירה" },
  { value: "textarea", label: "טקסט ארוך" },
  { value: "checkbox", label: "תיבת סימון" },
];

const CRM_FIELD_MAPPINGS = [
  { value: "", label: "-- ללא מיפוי --" },
  { value: "first_name", label: "שם פרטי" },
  { value: "last_name", label: "שם משפחה" },
  { value: "email", label: "מייל" },
  { value: "phone", label: "טלפון" },
  { value: "company", label: "חברה" },
  { value: "job_title", label: "תפקיד" },
  { value: "city", label: "עיר" },
  { value: "notes", label: "הערות" },
];

export default function FormsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [showBuilder, setShowBuilder] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [sourceTag, setSourceTag] = useState("");
  const [fields, setFields] = useState<FormField[]>([
    { id: "f1", type: "text", label: "שם פרטי", required: true, mapTo: "first_name" },
    { id: "f2", type: "text", label: "שם משפחה", required: true, mapTo: "last_name" },
    { id: "f3", type: "email", label: "מייל", required: true, mapTo: "email" },
    { id: "f4", type: "phone", label: "טלפון", required: false, mapTo: "phone" },
  ]);

  const { data: forms, isLoading } = useQuery({
    queryKey: ["forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_forms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Form[];
    },
  });

  const createForm = useMutation({
    mutationFn: async () => {
      const slug = formSlug || formName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const { error } = await supabase.from("crm_forms").insert({
        name: formName,
        slug,
        fields,
        settings: { thank_you_message: "תודה! נחזור אליך בהקדם." },
        source_tag: sourceTag || "form",
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      toast.success("טופס נוצר בהצלחה");
      setShowBuilder(false);
      resetForm();
    },
  });

  const deleteForm = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("crm_forms").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      toast.success("טופס נמחק");
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormSlug("");
    setSourceTag("");
    setFields([
      { id: "f1", type: "text", label: "שם פרטי", required: true, mapTo: "first_name" },
      { id: "f2", type: "text", label: "שם משפחה", required: true, mapTo: "last_name" },
      { id: "f3", type: "email", label: "מייל", required: true, mapTo: "email" },
      { id: "f4", type: "phone", label: "טלפון", required: false, mapTo: "phone" },
    ]);
  };

  const addField = () => {
    setFields([...fields, {
      id: `f${Date.now()}`,
      type: "text",
      label: "",
      required: false,
    }]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const generateEmbedCode = (form: Form) => {
    const baseUrl = window.location.origin;
    return `<iframe src="${baseUrl}/form/${form.slug}" style="width:100%;min-height:500px;border:none;border-radius:12px;" />`;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground">
          <ArrowRight size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">טפסי לידים</h1>
          <p className="text-muted-foreground text-sm">צור טפסים לאיסוף לידים אוטומטית</p>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90"
        >
          <Plus size={16} />
          טופס חדש
        </button>
      </div>

      {/* Existing forms */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : forms && forms.length > 0 ? (
        <div className="space-y-3">
          {forms.map(form => (
            <div key={form.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                  <FileText size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{form.name}</h3>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full",
                      form.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {form.is_active ? "פעיל" : "לא פעיל"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{form.fields?.length || 0} שדות</span>
                    <span>{form.submission_count} הגשות</span>
                    <span>נוצר {timeAgo(form.created_at)}</span>
                    <span dir="ltr" className="bg-secondary px-2 py-0.5 rounded font-mono">/{form.slug}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generateEmbedCode(form));
                      toast.success("קוד הטמעה הועתק");
                    }}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
                    title="העתק קוד הטמעה"
                  >
                    <Code size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: "מחיקת טופס",
                        description: "למחוק את הטופס?",
                        confirmText: "מחק",
                        cancelText: "ביטול",
                        variant: "destructive",
                      });
                      if (!confirmed) return;
                      deleteForm.mutate(form.id);
                    }}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !showBuilder ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <div className="text-center">
            <FileText size={36} className="mx-auto mb-2 opacity-20" />
            <p className="font-medium">אין טפסים</p>
            <p className="text-sm">צור טופס ליד ראשון</p>
          </div>
        </div>
      ) : null}

      {/* Form builder */}
      {showBuilder && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold">בניית טופס</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">שם הטופס *</label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring"
                placeholder="למשל: הרשמה לסדנה"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">תגית מקור</label>
              <input
                value={sourceTag}
                onChange={e => setSourceTag(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring"
                placeholder="form, landing_page..."
              />
            </div>
          </div>

          {/* Fields */}
          <div>
            <h3 className="text-sm font-medium mb-3">שדות הטופס</h3>
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg">
                  <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                  <input
                    value={field.label}
                    onChange={e => updateField(field.id, { label: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background outline-none"
                    placeholder="תווית השדה"
                  />
                  <Select
                    value={field.type}
                    onValueChange={v => updateField(field.id, { type: v as any })}
                  >
                    <SelectTrigger className="w-24 px-2 py-1 text-xs border border-input rounded bg-background outline-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select
                    value={field.mapTo || "__none__"}
                    onValueChange={v => updateField(field.id, { mapTo: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger className="w-28 px-2 py-1 text-xs border border-input rounded bg-background outline-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRM_FIELD_MAPPINGS.map(m => <SelectItem key={m.value || "__none__"} value={m.value || "__none__"}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={e => updateField(field.id, { required: e.target.checked })}
                      className="w-3 h-3"
                    />
                    חובה
                  </label>
                  <button onClick={() => removeField(field.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addField}
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:bg-primary/5 px-3 py-1.5 rounded"
            >
              <Plus size={12} /> הוסף שדה
            </button>
          </div>

          <div className="flex gap-3 pt-2 border-t border-border">
            <button
              onClick={() => createForm.mutate()}
              disabled={!formName || fields.length === 0}
              className="px-6 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              צור טופס
            </button>
            <button
              onClick={() => { setShowBuilder(false); resetForm(); }}
              className="px-4 py-2.5 text-sm border border-input rounded-lg hover:bg-secondary"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

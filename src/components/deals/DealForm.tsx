import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { useCreateDeal, usePipelines } from "@/hooks/useDeals";
import { useContacts } from "@/hooks/useContacts";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/crm";

const dealSchema = z.object({
  title: z.string().min(1, "כותרת העסקה חובה"),
  contact_id: z.string().min(1, "יש לבחור ליד"),
  pipeline_id: z.string().min(1, "יש לבחור צנרת"),
  stage_id: z.string().min(1, "יש לבחור שלב"),
  value: z.coerce.number().min(0).default(0),
  product_id: z.string().optional(),
  expected_close: z.string().optional(),
  notes: z.string().optional(),
  assigned_to: z.string().optional(),
});

type DealFormData = z.infer<typeof dealSchema>;

interface DealFormProps {
  onClose: () => void;
  defaultContactId?: string;
}

export default function DealForm({ onClose, defaultContactId }: DealFormProps) {
  const createDeal = useCreateDeal();
  const { data: pipelines } = usePipelines();
  const { data: contacts } = useContacts();
  const { members } = useTeamMembers();
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const defaultPipeline = pipelines?.find(p => p.is_default) || pipelines?.[0];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      contact_id: defaultContactId || "",
      pipeline_id: defaultPipeline?.id || "",
      stage_id: defaultPipeline?.stages?.[0]?.id || "",
      value: 0,
    },
  });

  const selectedPipelineId = watch("pipeline_id");
  const selectedPipeline = pipelines?.find(p => p.id === selectedPipelineId);
  const stages = selectedPipeline?.stages || [];

  const onSubmit = async (data: DealFormData) => {
    const stage = stages.find(s => s.id === data.stage_id);
    await createDeal.mutateAsync({
      ...data,
      probability: stage?.probability || 0,
      status: "open",
      product_id: data.product_id || null,
      assigned_to: data.assigned_to || null,
    } as any);
    onClose();
  };

  // When product is selected, auto-fill value and title
  const handleProductChange = (productId: string) => {
    setValue("product_id", productId);
    const product = products?.find(p => p.id === productId);
    if (product) {
      setValue("value", product.price);
      const titleField = document.querySelector<HTMLInputElement>('input[name="title"]');
      if (titleField && !titleField.value) {
        setValue("title", `הרשמה ל${product.name}`);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="fixed inset-y-0 left-0 w-full max-w-lg bg-card shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">עסקה חדשה</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Contact */}
          <div>
            <label className="text-sm font-medium mb-1 block">ליד *</label>
            <select
              {...register("contact_id")}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
            >
              <option value="">בחר ליד</option>
              {contacts?.map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} {c.email ? `(${c.email})` : ""}
                </option>
              ))}
            </select>
            {errors.contact_id && (
              <p className="text-xs text-destructive mt-1">{errors.contact_id.message}</p>
            )}
          </div>

          {/* Product */}
          <div>
            <label className="text-sm font-medium mb-1 block">מוצר/קורס</label>
            <select
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
            >
              <option value="">בחר מוצר (אופציונלי)</option>
              {products?.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} - {p.price.toLocaleString()} ₪
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1 block">כותרת העסקה *</label>
            <input
              {...register("title")}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="למשל: הרשמה לקורס AI Agents"
            />
            {errors.title && (
              <p className="text-xs text-destructive mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Pipeline & Stage */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">צנרת *</label>
              <select
                {...register("pipeline_id")}
                onChange={(e) => {
                  setValue("pipeline_id", e.target.value);
                  const pl = pipelines?.find(p => p.id === e.target.value);
                  if (pl?.stages?.[0]) setValue("stage_id", pl.stages[0].id);
                }}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
              >
                {pipelines?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">שלב *</label>
              <select
                {...register("stage_id")}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
              >
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Value & Expected Close */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">ערך (₪)</label>
              <input
                {...register("value")}
                type="number"
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">סגירה צפויה</label>
              <input
                {...register("expected_close")}
                type="date"
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
              />
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <label className="text-sm font-medium mb-1 block">אחראי</label>
            <select
              {...register("assigned_to")}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
            >
              <option value="">ללא שיוך</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-1 block">הערות</label>
            <textarea
              {...register("notes")}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "יוצר..." : "צור עסקה"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

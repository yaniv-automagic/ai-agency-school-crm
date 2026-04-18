import { useState } from "react";
import { Plus, Package, Pencil, Trash2, X, ToggleLeft, ToggleRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import type { Product } from "@/types/crm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });
}

const emptyForm = { name: "", description: "", price: "", currency: "ILS", category: "course", duration_description: "", is_active: true };

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string } & Record<string, any>) => {
      const { id, ...fields } = data;
      if (id) {
        const { error } = await supabase.from("crm_products").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_products").insert(fields);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(editingId ? "מוצר עודכן" : "מוצר נוצר");
      closeForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("מוצר נמחק");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("crm_products").update({ is_active, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      currency: product.currency,
      category: product.category,
      duration_description: product.duration_description || "",
      is_active: product.is_active,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSave = () => {
    if (!formData.name) return;
    saveMutation.mutate({
      id: editingId || undefined,
      name: formData.name,
      description: formData.description || null,
      price: Number(formData.price) || 0,
      currency: formData.currency,
      category: formData.category,
      duration_description: formData.duration_description || null,
      is_active: formData.is_active,
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`למחוק את "${name}"? לא ניתן לבטל.`)) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">מוצרים וקורסים</h1>
          <p className="text-muted-foreground text-sm">{products?.length || 0} מוצרים</p>
        </div>
        <button onClick={() => { setEditingId(null); setFormData(emptyForm); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90">
          <Plus size={16} /> מוצר חדש
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => {
            const cat = PRODUCT_CATEGORIES.find(c => c.value === product.category);
            return (
              <div key={product.id} className={cn("bg-card border rounded-xl p-5 transition-shadow group relative", product.is_active ? "border-border hover:shadow-md" : "border-border/50 opacity-60")}>
                {/* Actions */}
                <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(product)}
                    className="p-1.5 rounded-lg bg-white border border-border shadow-sm hover:bg-secondary text-muted-foreground">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => toggleActive.mutate({ id: product.id, is_active: !product.is_active })}
                    className="p-1.5 rounded-lg bg-white border border-border shadow-sm hover:bg-secondary text-muted-foreground"
                    title={product.is_active ? "השבת" : "הפעל"}>
                    {product.is_active ? <ToggleRight size={13} className="text-green-500" /> : <ToggleLeft size={13} />}
                  </button>
                  <button onClick={() => handleDelete(product.id, product.name)}
                    className="p-1.5 rounded-lg bg-white border border-border shadow-sm hover:bg-red-50 text-muted-foreground hover:text-destructive">
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Package size={20} className="text-primary" />
                  </div>
                  <span className="text-xs bg-secondary px-2.5 py-1 rounded-full">{cat?.label}</span>
                </div>
                <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
                {product.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-xl font-bold text-primary">{product.price.toLocaleString()} ₪</span>
                  {product.duration_description && (
                    <span className="text-xs text-muted-foreground">{product.duration_description}</span>
                  )}
                </div>
                {!product.is_active && (
                  <p className="text-xs text-destructive mt-2 font-medium">לא פעיל</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <Package size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium mb-1">אין מוצרים</p>
            <p className="text-sm">הוסף קורסים ומוצרים</p>
          </div>
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={closeForm}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? "עריכת מוצר" : "מוצר חדש"}</h2>
              <button onClick={closeForm} className="p-1 rounded hover:bg-secondary text-muted-foreground"><X size={18} /></button>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">שם המוצר *</label>
              <input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="למשל: AI Agents Bootcamp" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">תיאור</label>
              <textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">מחיר (₪)</label>
                <input type="number" value={formData.price} onChange={e => setFormData(f => ({ ...f, price: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background" dir="ltr" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">קטגוריה</label>
                <select value={formData.category} onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background">
                  {PRODUCT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">משך</label>
              <input value={formData.duration_description} onChange={e => setFormData(f => ({ ...f, duration_description: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background" placeholder="למשל: 8 שבועות" />
            </div>
            {editingId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.is_active as any} onChange={e => setFormData(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded accent-primary" />
                <span className="text-sm">מוצר פעיל</span>
              </label>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={!formData.name || saveMutation.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {saveMutation.isPending ? "שומר..." : editingId ? "עדכן מוצר" : "צור מוצר"}
              </button>
              <button onClick={closeForm} className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

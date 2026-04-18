import { useState } from "react";
import { Plus, Package, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import type { Product } from "@/types/crm";
import { toast } from "sonner";

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

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "", description: "", price: "", currency: "ILS",
    category: "course", duration_description: ""
  });

  const createProduct = useMutation({
    mutationFn: async (product: Partial<Product>) => {
      const { data, error } = await supabase
        .from("crm_products")
        .insert(product)
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("מוצר נוצר בהצלחה");
      setShowForm(false);
      setFormData({ name: "", description: "", price: "", currency: "ILS", category: "course", duration_description: "" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">מוצרים וקורסים</h1>
          <p className="text-muted-foreground text-sm">{products?.length || 0} מוצרים</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          מוצר חדש
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
              <div key={product.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Package size={20} className="text-primary" />
                  </div>
                  <span className="text-xs bg-secondary px-2.5 py-1 rounded-full">
                    {cat?.label}
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
                {product.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-xl font-bold text-primary">
                    {product.price.toLocaleString()} ₪
                  </span>
                  {product.duration_description && (
                    <span className="text-xs text-muted-foreground">
                      {product.duration_description}
                    </span>
                  )}
                </div>
                {!product.is_active && (
                  <p className="text-xs text-destructive mt-2">לא פעיל</p>
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

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">מוצר חדש</h2>
            <div>
              <label className="text-sm font-medium mb-1 block">שם המוצר *</label>
              <input
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="למשל: AI Agents Bootcamp"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">תיאור</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">מחיר (₪)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={e => setFormData(f => ({ ...f, price: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">קטגוריה</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
                >
                  {PRODUCT_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">משך</label>
              <input
                value={formData.duration_description}
                onChange={e => setFormData(f => ({ ...f, duration_description: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
                placeholder="למשל: 8 שבועות"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  if (!formData.name) return;
                  createProduct.mutate({
                    name: formData.name,
                    description: formData.description || null,
                    price: Number(formData.price) || 0,
                    currency: formData.currency,
                    category: formData.category as any,
                    duration_description: formData.duration_description || null,
                    is_active: true,
                  });
                }}
                disabled={!formData.name}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                צור מוצר
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

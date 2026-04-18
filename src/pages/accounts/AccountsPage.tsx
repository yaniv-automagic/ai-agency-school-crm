import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Building2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Account } from "@/types/crm";
import { timeAgo } from "@/lib/utils";
import { toast } from "sonner";

function useAccounts(search?: string) {
  return useQuery({
    queryKey: ["accounts", search],
    queryFn: async () => {
      let query = supabase
        .from("crm_accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Account[];
    },
  });
}

export default function AccountsPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { data: accounts, isLoading } = useAccounts(search || undefined);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createAccount = useMutation({
    mutationFn: async (account: Partial<Account>) => {
      const { data, error } = await supabase
        .from("crm_accounts")
        .insert(account)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("חשבון נוצר בהצלחה");
      setShowForm(false);
    },
    onError: (error: Error) => {
      toast.error(`שגיאה: ${error.message}`);
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    website: "",
    industry: "",
    phone: "",
    email: "",
    city: "",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">חשבונות</h1>
          <p className="text-muted-foreground text-sm">{accounts?.length || 0} חשבונות</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          חשבון חדש
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="חיפוש חשבונות..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pr-10 pl-4 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">שם</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">תעשייה</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">טלפון</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">מייל</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">עיר</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">נוצר</th>
              </tr>
            </thead>
            <tbody>
              {accounts && accounts.length > 0 ? (
                accounts.map(account => (
                  <tr
                    key={account.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <Building2 size={16} />
                        </div>
                        <span className="font-medium">{account.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{account.industry || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground" dir="ltr">{account.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{account.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{account.city || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{timeAgo(account.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                    <Building2 size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium mb-1">אין חשבונות</p>
                    <p className="text-sm">הוסף ארגונים וחברות</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Simple Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">חשבון חדש</h2>
            <div>
              <label className="text-sm font-medium mb-1 block">שם חשבון *</label>
              <input
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">תעשייה</label>
                <input
                  value={formData.industry}
                  onChange={e => setFormData(f => ({ ...f, industry: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">עיר</label>
                <input
                  value={formData.city}
                  onChange={e => setFormData(f => ({ ...f, city: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">טלפון</label>
                <input
                  value={formData.phone}
                  onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">מייל</label>
                <input
                  value={formData.email}
                  onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">אתר</label>
              <input
                value={formData.website}
                onChange={e => setFormData(f => ({ ...f, website: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                dir="ltr"
                placeholder="https://"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => createAccount.mutate(formData)}
                disabled={!formData.name}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                צור חשבון
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary transition-colors"
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

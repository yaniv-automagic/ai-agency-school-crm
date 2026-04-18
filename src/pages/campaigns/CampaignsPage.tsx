import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Megaphone, Mail, MessageCircle, MessageSquare, Send, Clock, CheckCircle, BarChart3 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Campaign } from "@/types/crm";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "טיוטה", color: "bg-gray-100 text-gray-600", icon: Clock },
  scheduled: { label: "מתוזמן", color: "bg-blue-100 text-blue-600", icon: Clock },
  sending: { label: "נשלח...", color: "bg-yellow-100 text-yellow-600", icon: Send },
  sent: { label: "נשלח", color: "bg-green-100 text-green-600", icon: CheckCircle },
  cancelled: { label: "בוטל", color: "bg-red-100 text-red-600", icon: Clock },
};

const TYPE_ICONS: Record<string, any> = {
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
};

export default function CampaignsPage() {
  const { data: campaigns, isLoading } = useCampaigns();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "", type: "email" as "email" | "sms" | "whatsapp", subject: "", body_text: ""
  });

  const createCampaign = useMutation({
    mutationFn: async (campaign: Partial<Campaign>) => {
      const { data, error } = await supabase
        .from("crm_campaigns")
        .insert(campaign)
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("קמפיין נוצר");
      setShowForm(false);
      setFormData({ name: "", type: "email", subject: "", body_text: "" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">קמפיינים</h1>
          <p className="text-muted-foreground text-sm">{campaigns?.length || 0} קמפיינים</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          קמפיין חדש
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "קמפייני מייל", count: campaigns?.filter(c => c.type === "email").length || 0, icon: Mail, color: "text-blue-500" },
          { label: "קמפייני WhatsApp", count: campaigns?.filter(c => c.type === "whatsapp").length || 0, icon: MessageCircle, color: "text-emerald-500" },
          { label: "קמפייני SMS", count: campaigns?.filter(c => c.type === "sms").length || 0, icon: MessageSquare, color: "text-purple-500" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <stat.icon size={20} className={stat.color} />
            <div>
              <p className="text-2xl font-bold">{stat.count}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="space-y-3">
          {campaigns.map(campaign => {
            const status = STATUS_MAP[campaign.status] || STATUS_MAP.draft;
            const TypeIcon = TYPE_ICONS[campaign.type] || Mail;
            const stats = campaign.stats || {};

            return (
              <div key={campaign.id} onClick={() => navigate(`/campaigns/${campaign.id}`)} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                    <TypeIcon size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{campaign.name}</h3>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", status.color)}>
                        {status.label}
                      </span>
                    </div>
                    {campaign.subject && (
                      <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>נוצר {timeAgo(campaign.created_at)}</span>
                      {campaign.sent_at && <span>נשלח {timeAgo(campaign.sent_at)}</span>}
                      {stats.sent_count && (
                        <>
                          <span>📤 {stats.sent_count} נשלחו</span>
                          {stats.opened && <span>📭 {stats.opened} נפתחו</span>}
                          {stats.clicked && <span>🔗 {stats.clicked} לחצו</span>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <Megaphone size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium mb-1">אין קמפיינים</p>
            <p className="text-sm">צור קמפיין מייל, WhatsApp או SMS</p>
          </div>
        </div>
      )}

      {/* Create Campaign Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">קמפיין חדש</h2>

            <div>
              <label className="text-sm font-medium mb-1 block">שם הקמפיין *</label>
              <input
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="למשל: ברוכים הבאים - קורס חדש"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">ערוץ</label>
              <div className="flex gap-2">
                {[
                  { value: "email", label: "מייל", icon: Mail },
                  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
                  { value: "sms", label: "SMS", icon: MessageSquare },
                ].map(ch => (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, type: ch.value as any }))}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm border rounded-xl transition-colors",
                      formData.type === ch.value
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-input hover:bg-secondary"
                    )}
                  >
                    <ch.icon size={16} />
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            {formData.type === "email" && (
              <div>
                <label className="text-sm font-medium mb-1 block">נושא המייל</label>
                <input
                  value={formData.subject}
                  onChange={e => setFormData(f => ({ ...f, subject: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="נושא..."
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">תוכן ההודעה</label>
              <textarea
                value={formData.body_text}
                onChange={e => setFormData(f => ({ ...f, body_text: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="שלום {{first_name}},&#10;&#10;תוכן ההודעה..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                משתנים זמינים: {"{{first_name}}"}, {"{{last_name}}"}, {"{{email}}"}, {"{{company}}"}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  if (!formData.name) return;
                  createCampaign.mutate({
                    name: formData.name,
                    type: formData.type,
                    subject: formData.subject || null,
                    body_text: formData.body_text || null,
                    status: "draft",
                  });
                }}
                disabled={!formData.name}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                צור קמפיין (טיוטה)
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

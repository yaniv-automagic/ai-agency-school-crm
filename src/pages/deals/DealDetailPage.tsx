import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useDeal } from "@/hooks/useDeals";
import { useActivities } from "@/hooks/useActivities";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { ACTIVITY_TYPES } from "@/lib/constants";

export default function DealDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: deal, isLoading } = useDeal(id);
  const { data: activities } = useActivities({ deal_id: id });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">עסקה לא נמצאה</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/pipeline")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight size={16} />
        חזרה לצנרת
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{deal.title}</h1>
          <p className="text-muted-foreground mt-1">
            {deal.contact?.first_name} {deal.contact?.last_name}
          </p>
        </div>
        <div className="text-left">
          <p className="text-2xl font-bold text-primary">{formatCurrency(deal.value)}</p>
          <p className="text-sm text-muted-foreground">{deal.stage?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold mb-4">פעילות</h3>
            {activities && activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map(activity => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs">
                      {ACTIVITY_TYPES.find(t => t.value === activity.type)?.label?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {ACTIVITY_TYPES.find(t => t.value === activity.type)?.label}
                      </p>
                      {activity.body && (
                        <p className="text-sm text-muted-foreground mt-0.5">{activity.body}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{timeAgo(activity.performed_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">אין פעילות</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">פרטי עסקה</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">סטטוס</span>
                <span className="font-medium">{deal.status === "open" ? "פתוח" : deal.status === "won" ? "נסגר" : "אבוד"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">הסתברות</span>
                <span>{deal.probability}%</span>
              </div>
              {deal.expected_close && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סגירה צפויה</span>
                  <span>{new Date(deal.expected_close).toLocaleDateString("he-IL")}</span>
                </div>
              )}
              {deal.product && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">מוצר</span>
                  <span>{deal.product.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">נוצר</span>
                <span>{timeAgo(deal.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

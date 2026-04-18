import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Send, Copy, CheckCircle2 } from "lucide-react";
import { useContract, useUpdateContract } from "@/hooks/useContracts";
import { CONTRACT_STATUSES } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

export default function ContractDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: contract, isLoading } = useContract(id);
  const updateContract = useUpdateContract();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">חוזה לא נמצא</p>
      </div>
    );
  }

  const status = CONTRACT_STATUSES.find((s) => s.value === contract.status);

  const handleSendForSigning = async () => {
    await updateContract.mutateAsync({
      id: contract.id,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    toast.success("החוזה נשלח לחתימה");
  };

  const handleCopySignLink = () => {
    if (contract.sign_token) {
      const url = `${window.location.origin}/sign/${contract.sign_token}`;
      navigator.clipboard.writeText(url);
      toast.success("קישור החתימה הועתק");
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/contracts")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight size={16} />
        חזרה לחוזים
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{contract.title}</h1>
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
              status?.color
            )}
          >
            {status?.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {contract.status === "draft" && (
            <button
              onClick={handleSendForSigning}
              disabled={updateContract.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send size={16} />
              שלח לחתימה
            </button>
          )}
          {contract.sign_token && (
            <button
              onClick={handleCopySignLink}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-secondary transition-colors"
            >
              <Copy size={16} />
              העתק קישור חתימה
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contract HTML Body */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: contract.body_html }}
            />
          </div>

          {/* Signature (if signed) */}
          {contract.status === "signed" && contract.signature_data && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-600" />
                חתימה
              </h3>
              <div className="border border-border rounded-lg p-4 bg-white">
                {contract.signature_type === "drawn" ? (
                  <img
                    src={contract.signature_data}
                    alt="חתימה"
                    className="max-h-32 mx-auto"
                  />
                ) : (
                  <p className="text-2xl text-center" style={{ fontFamily: "cursive" }}>
                    {contract.signature_data}
                  </p>
                )}
              </div>
              {contract.signed_at && (
                <p className="text-sm text-muted-foreground mt-3">
                  נחתם ב-{new Date(contract.signed_at).toLocaleDateString("he-IL")}{" "}
                  בשעה {new Date(contract.signed_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {contract.signer_ip && (
                <p className="text-xs text-muted-foreground mt-1" dir="ltr">
                  IP: {contract.signer_ip}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact Info */}
          {contract.contact && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm">ליד</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">שם</span>
                  <span className="font-medium">
                    {contract.contact.first_name} {contract.contact.last_name}
                  </span>
                </div>
                {contract.contact.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">מייל</span>
                    <span dir="ltr">{contract.contact.email}</span>
                  </div>
                )}
                {contract.contact.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">טלפון</span>
                    <span dir="ltr">{contract.contact.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deal Info */}
          {contract.deal && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm">עסקה</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">כותרת</span>
                  <span className="font-medium">{contract.deal.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ערך</span>
                  <span>
                    {new Intl.NumberFormat("he-IL", {
                      style: "currency",
                      currency: contract.deal.currency || "ILS",
                      minimumFractionDigits: 0,
                    }).format(contract.deal.value)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">ציר זמן</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm">נוצר</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(contract.created_at)}</p>
                </div>
              </div>
              {contract.sent_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm">נשלח</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(contract.sent_at)}</p>
                  </div>
                </div>
              )}
              {contract.viewed_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm">נצפה</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(contract.viewed_at)}</p>
                  </div>
                </div>
              )}
              {contract.signed_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm">נחתם</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(contract.signed_at)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

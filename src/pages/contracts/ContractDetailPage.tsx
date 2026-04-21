import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Send, Copy, CheckCircle2, Lock, Download, FileText, Shield, XCircle } from "lucide-react";
import { useContract, useUpdateContract } from "@/hooks/useContracts";
import { useContractAuditLog, useSendContract } from "@/hooks/useContracts";
import { CONTRACT_STATUSES } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import SendContractDialog from "@/components/contracts/SendContractDialog";

const AUDIT_EVENT_LABELS: Record<string, string> = {
  contract_created: "חוזה נוצר",
  contract_edited: "חוזה נערך",
  contract_sent: "חוזה נשלח",
  contract_viewed: "חוזה נצפה",
  contract_downloaded: "חוזה הורד",
  identity_verified: "זהות אומתה",
  document_reviewed: "מסמך נקרא",
  consent_given: "הסכמה ניתנה",
  signature_started: "חתימה החלה",
  signature_completed: "חתימה הושלמה",
  pdf_generated: "PDF נוצר",
  signed_pdf_generated: "PDF חתום נוצר",
  email_sent_to_signer: "מייל נשלח לחותם",
  email_sent_to_owner: "מייל נשלח לבעלים",
  contract_expired: "חוזה פג תוקף",
  contract_cancelled: "חוזה בוטל",
};

const AUDIT_EVENT_COLORS: Record<string, string> = {
  contract_created: "bg-gray-400",
  contract_sent: "bg-blue-500",
  contract_viewed: "bg-amber-500",
  identity_verified: "bg-purple-500",
  document_reviewed: "bg-indigo-500",
  consent_given: "bg-cyan-500",
  signature_completed: "bg-green-500",
  signed_pdf_generated: "bg-green-400",
  email_sent_to_signer: "bg-blue-400",
  email_sent_to_owner: "bg-blue-400",
};

export default function ContractDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: contract, isLoading } = useContract(id);
  const { data: auditLog } = useContractAuditLog(id);
  const sendContract = useSendContract();
  const updateContract = useUpdateContract();
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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

  const handleCopySignLink = () => {
    if (contract.sign_token) {
      const url = `${window.location.origin}/sign/${contract.sign_token}`;
      navigator.clipboard.writeText(url);
      toast.success("קישור החתימה הועתק");
    }
  };

  const handleCancelContract = async () => {
    await updateContract.mutateAsync({
      id: contract.id,
      status: "cancelled",
      sign_token: null,
    });
    setShowCancelConfirm(false);
    toast.success("ההסכם בוטל, קישור החתימה כבר לא פעיל");
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
          {contract.locked && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              <Lock size={12} />
              נעול
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {contract.status === "draft" && !contract.locked && (
            <button
              onClick={() => setShowSendDialog(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
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
          {(contract.status === "sent" || contract.status === "viewed") && !contract.locked && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <XCircle size={16} />
              ביטול הסכם
            </button>
          )}
          {contract.signed_pdf_url && (
            <a
              href={contract.signed_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-secondary transition-colors"
            >
              <Download size={16} />
              הורד PDF חתום
            </a>
          )}
          {contract.pdf_url && !contract.signed_pdf_url && (
            <a
              href={contract.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-secondary transition-colors"
            >
              <FileText size={16} />
              הורד PDF
            </a>
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
              <div className="mt-3 space-y-1">
                {contract.signer_name_confirmed && (
                  <p className="text-sm text-muted-foreground">
                    חותם: {contract.signer_name_confirmed}
                  </p>
                )}
                {contract.signed_at && (
                  <p className="text-sm text-muted-foreground">
                    נחתם ב-{new Date(contract.signed_at).toLocaleDateString("he-IL")}{" "}
                    בשעה {new Date(contract.signed_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                {contract.signer_ip && (
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    IP: {contract.signer_ip}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Document Integrity (if signed) */}
          {contract.status === "signed" && (contract.document_hash || contract.certificate_id) && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Shield size={18} className="text-blue-600" />
                שלמות מסמך ותעודת חתימה
              </h3>
              <div className="space-y-3 text-sm">
                {contract.certificate_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">מזהה תעודה</span>
                    <span className="font-mono text-xs">{contract.certificate_id}</span>
                  </div>
                )}
                {contract.document_hash && (
                  <div>
                    <span className="text-muted-foreground block mb-1">Document Hash (SHA-256)</span>
                    <span className="font-mono text-xs break-all" dir="ltr">{contract.document_hash}</span>
                  </div>
                )}
                {contract.signed_document_hash && (
                  <div>
                    <span className="text-muted-foreground block mb-1">Signed PDF Hash (SHA-256)</span>
                    <span className="font-mono text-xs break-all" dir="ltr">{contract.signed_document_hash}</span>
                  </div>
                )}
              </div>
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

          {/* Audit Trail */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">מעקב אירועים</h3>
            <div className="space-y-3">
              {auditLog && auditLog.length > 0 ? (
                auditLog.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${AUDIT_EVENT_COLORS[event.event_type] || "bg-gray-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{AUDIT_EVENT_LABELS[event.event_type] || event.event_type}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(event.created_at)}</p>
                      {event.ip_address && (
                        <p className="text-xs text-muted-foreground" dir="ltr">IP: {event.ip_address}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                // Fallback to basic timeline
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Send Contract Dialog */}
      {showSendDialog && (
        <SendContractDialog
          contract={contract}
          onClose={() => setShowSendDialog(false)}
          onSend={async (params) => {
            await sendContract.mutateAsync({ id: contract.id, ...params });
            setShowSendDialog(false);
          }}
          isSending={sendContract.isPending}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCancelConfirm(false)} />
          <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-semibold">ביטול הסכם</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              פעולה זו תבטל את ההסכם ותשבית את קישור החתימה. לא ניתן יהיה לחתום על ההסכם דרך הקישור הקיים.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelContract}
                disabled={updateContract.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {updateContract.isPending ? "מבטל..." : "בטל הסכם"}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary transition-colors"
              >
                חזרה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { X, Send } from "lucide-react";
import type { Contract } from "@/types/crm";

interface Props {
  contract: Contract;
  onClose: () => void;
  onSend: (params: { email_subject?: string; email_body?: string; expires_in_days?: number }) => Promise<void>;
  isSending: boolean;
}

export default function SendContractDialog({ contract, onClose, onSend, isSending }: Props) {
  const [emailSubject, setEmailSubject] = useState(`${contract.title} - חוזה לחתימה`);
  const [emailBody, setEmailBody] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSend({
      email_subject: emailSubject,
      email_body: emailBody || undefined,
      expires_in_days: expiresInDays,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold">שליחת חוזה לחתימה</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Recipient info */}
          <div className="p-3 bg-secondary/50 rounded-lg text-sm">
            <p className="text-muted-foreground">נמען:</p>
            <p className="font-medium">
              {contract.contact?.first_name} {contract.contact?.last_name}
              {contract.contact?.email && (
                <span className="text-muted-foreground font-normal" dir="ltr"> ({contract.contact.email})</span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">נושא המייל</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">הודעה אישית (אופציונלי)</label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="הוסף הודעה אישית שתופיע מעל כפתור החתימה..."
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-background resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">תוקף (ימים)</label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              min={1}
              max={365}
              className="w-24 px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              החוזה יפוג תוקף לאחר {expiresInDays} ימים
            </p>
          </div>

          {/* Preview note */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            בעת השליחה, ייווצר PDF של החוזה ויחושב hash קריפטוגרפי לאימות שלמות המסמך.
            מייל עם קישור לחתימה יישלח לנמען.
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={isSending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  שולח ומייצר PDF...
                </>
              ) : (
                <>
                  <Send size={16} />
                  שלח לחתימה
                </>
              )}
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

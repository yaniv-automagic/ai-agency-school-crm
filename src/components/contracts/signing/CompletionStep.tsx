import { CheckCircle2, Download } from "lucide-react";

interface Props {
  contractTitle: string;
  certificateId: string;
  signedPdfUrl: string | null;
  signedAt: string;
}

export default function CompletionStep({ contractTitle, certificateId, signedPdfUrl, signedAt }: Props) {
  const formattedDate = new Date(signedAt).toLocaleDateString("he-IL", {
    year: "numeric", month: "long", day: "numeric",
  });
  const formattedTime = new Date(signedAt).toLocaleTimeString("he-IL", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 size={40} className="text-green-600" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">החוזה נחתם בהצלחה!</h2>
      <p className="text-gray-500 mb-6">
        תודה שחתמת על "<strong>{contractTitle}</strong>". עותק חתום נשלח לאימייל שלך.
      </p>

      <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600 space-y-2 mb-6">
        <p>
          נחתם ב-{formattedDate} בשעה {formattedTime}
        </p>
        <p className="font-mono text-xs text-gray-400">
          מזהה תעודה: {certificateId}
        </p>
      </div>

      {signedPdfUrl && (
        <a
          href={signedPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download size={16} />
          הורדת חוזה חתום
        </a>
      )}
    </div>
  );
}

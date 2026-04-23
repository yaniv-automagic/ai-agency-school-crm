import { PenTool } from "lucide-react";
import SignaturePad from "@/components/contracts/SignaturePad";

interface Props {
  isSubmitting: boolean;
  onSign: (data: string, type: "drawn" | "typed") => void;
}

export default function SignatureStep({ isSubmitting, onSign }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <PenTool size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">חתימה</h3>
          <p className="text-sm text-gray-500">שלב 3 מתוך 3 - חתמו על החוזה</p>
        </div>
      </div>

      <SignaturePad onSign={onSign} width={500} height={200} />

      {isSubmitting && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          חותם ומייצר PDF חתום...
        </div>
      )}
    </div>
  );
}

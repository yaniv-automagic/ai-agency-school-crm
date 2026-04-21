import { useState } from "react";
import { ShieldCheck } from "lucide-react";

interface Props {
  contactName: string;
  contactEmail: string;
  isSubmitting: boolean;
  error: string | null;
  onVerify: (fullName: string, email: string) => void;
}

export default function IdentityVerificationStep({ contactName, contactEmail, isSubmitting, error, onVerify }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onVerify(fullName, email);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <ShieldCheck size={20} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">אימות זהות</h3>
          <p className="text-sm text-gray-500">שלב 1 מתוך 4 - אנא אמתו את זהותכם</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="הזינו את שמכם המלא"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            dir="rtl"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">כתובת אימייל</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="הזינו את כתובת האימייל שלכם"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            dir="ltr"
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !fullName.trim() || !email.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              מאמת...
            </>
          ) : (
            "אימות והמשך"
          )}
        </button>
      </form>
    </div>
  );
}

import { useState } from "react";
import { Scale } from "lucide-react";

interface Props {
  isSubmitting: boolean;
  onConsent: (consentText: string) => void;
}

const CONSENT_TEXT_1 = 'אני מאשר/ת שקראתי את החוזה, הבנתי את תוכנו, ואני מסכים/ה לחתום עליו באופן אלקטרוני בהתאם לחוק חתימה אלקטרונית, תשס"א-2001';
const CONSENT_TEXT_2 = "אני מאשר/ת שהפרטים שמסרתי נכונים ומדויקים";

export default function LegalConsentStep({ isSubmitting, onConsent }: Props) {
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);

  const handleSubmit = () => {
    onConsent(`${CONSENT_TEXT_1}; ${CONSENT_TEXT_2}`);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <Scale size={20} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">הסכמה משפטית</h3>
          <p className="text-sm text-gray-500">שלב 3 מתוך 4 - אשרו את הסכמתכם לחתימה אלקטרונית</p>
        </div>
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={consent1}
            onChange={(e) => setConsent1(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 leading-relaxed">{CONSENT_TEXT_1}</span>
        </label>

        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={consent2}
            onChange={(e) => setConsent2(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 leading-relaxed">{CONSENT_TEXT_2}</span>
        </label>
      </div>

      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          בלחיצה על "המשך לחתימה", הנכם מאשרים כי הבנתם שחתימה אלקטרונית זו תהיה מחייבת משפטית
          ותהיה שקולה לחתימה ידנית, בהתאם לחוק חתימה אלקטרונית, תשס"א-2001.
        </p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!consent1 || !consent2 || isSubmitting}
        className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            שומר...
          </>
        ) : (
          "המשך לחתימה"
        )}
      </button>
    </div>
  );
}

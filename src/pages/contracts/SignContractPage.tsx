import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useSigningCeremony } from "@/hooks/useSigningCeremony";
import DocumentReviewStep from "@/components/contracts/signing/DocumentReviewStep";
import LegalConsentStep from "@/components/contracts/signing/LegalConsentStep";
import SignatureStep from "@/components/contracts/signing/SignatureStep";
import CompletionStep from "@/components/contracts/signing/CompletionStep";

const STEP_NUMBERS: Record<string, number> = {
  review: 1,
  consent: 2,
  signature: 3,
  complete: 4,
};

export default function SignContractPage() {
  const { token } = useParams();
  const {
    step,
    contract,
    error,
    isSubmitting,
    signingResult,
    loadContract,
    handleConfirmReview,
    handleGiveConsent,
    handleSign,
  } = useSigningCeremony(token);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  // Loading state
  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Error state
  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" dir="rtl">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-800 mb-2">
            {error || "חוזה לא נמצא"}
          </p>
          <p className="text-gray-500">הקישור אינו תקף או שפג תוקפו</p>
        </div>
      </div>
    );
  }

  const currentStepNum = STEP_NUMBERS[step] || 1;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-center">
          <img src="/logo.png" alt="AI Agency School" className="h-10" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Contract Title */}
        {contract && step !== "complete" && (
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-900">{contract.title}</h2>
            {contract.contact_name && (
              <p className="text-gray-500 mt-1">{contract.contact_name}</p>
            )}
          </div>
        )}

        {/* Step progress indicator */}
        {step !== "complete" && (
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    num < currentStepNum
                      ? "bg-green-500 text-white"
                      : num === currentStepNum
                        ? "bg-primary text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {num < currentStepNum ? "✓" : num}
                </div>
                {num < 3 && (
                  <div
                    className={`w-8 h-0.5 transition-colors ${
                      num < currentStepNum ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step content */}
        {step === "review" && contract && (
          <DocumentReviewStep
            bodyHtml={contract.body_html}
            isSubmitting={isSubmitting}
            onConfirmReview={handleConfirmReview}
          />
        )}

        {step === "consent" && (
          <LegalConsentStep
            isSubmitting={isSubmitting}
            onConsent={handleGiveConsent}
          />
        )}

        {step === "signature" && (
          <SignatureStep
            isSubmitting={isSubmitting}
            onSign={handleSign}
          />
        )}

        {step === "complete" && contract && signingResult && (
          <CompletionStep
            contractTitle={contract.title}
            certificateId={signingResult.certificate_id}
            signedPdfUrl={signingResult.signed_pdf_url}
            signedAt={signingResult.signed_at}
          />
        )}

        {/* Legal footer */}
        {step !== "complete" && (
          <div className="text-center text-xs text-gray-400 pb-4">
            <p>חתימה אלקטרונית מאובטחת בהתאם לחוק חתימה אלקטרונית, תשס"א-2001</p>
          </div>
        )}
      </div>
    </div>
  );
}

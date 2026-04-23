import { useState, useCallback, useRef } from "react";
import {
  getContractForSigning,
  confirmReview,
  giveConsent,
  submitSignature,
} from "@/lib/signing-api";

export type SigningStep = "loading" | "error" | "review" | "consent" | "signature" | "complete";

interface ContractData {
  id: string;
  title: string;
  body_html: string;
  status: string;
  contact_name: string;
  contact_email: string;
}

interface SigningResult {
  certificate_id: string;
  signed_pdf_url: string | null;
  signed_at: string;
}

export function useSigningCeremony(token: string | undefined) {
  const [step, setStep] = useState<SigningStep>("loading");
  const [contract, setContract] = useState<ContractData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signingResult, setSigningResult] = useState<SigningResult | null>(null);
  const ceremonyTokenRef = useRef<string>("");
  const reviewStartRef = useRef<number>(0);

  const loadContract = useCallback(async () => {
    if (!token) {
      setError("קישור לא תקף");
      setStep("error");
      return;
    }

    try {
      const data = await getContractForSigning(token);

      if (data.status === "signed") {
        setError("חוזה כבר נחתם");
        setStep("error");
        return;
      }

      setContract(data);
      // Unique sign token identifies the signer - skip identity verification
      if (data.ceremony_token) {
        ceremonyTokenRef.current = data.ceremony_token;
      }
      reviewStartRef.current = Date.now();
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת החוזה");
      setStep("error");
    }
  }, [token]);

  const handleConfirmReview = useCallback(async () => {
    if (!token) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const timeSpent = Math.round((Date.now() - reviewStartRef.current) / 1000);
      const result = await confirmReview(token, ceremonyTokenRef.current, timeSpent);
      ceremonyTokenRef.current = result.ceremony_token;
      setStep("consent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setIsSubmitting(false);
    }
  }, [token]);

  const handleGiveConsent = useCallback(async (consentText: string) => {
    if (!token) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await giveConsent(token, ceremonyTokenRef.current, consentText);
      ceremonyTokenRef.current = result.ceremony_token;
      setStep("signature");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setIsSubmitting(false);
    }
  }, [token]);

  const handleSign = useCallback(async (signatureData: string, signatureType: "drawn" | "typed") => {
    if (!token) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitSignature(token, ceremonyTokenRef.current, signatureData, signatureType);
      setSigningResult(result);
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בחתימה");
    } finally {
      setIsSubmitting(false);
    }
  }, [token]);

  return {
    step,
    contract,
    error,
    isSubmitting,
    signingResult,
    loadContract,
    handleConfirmReview,
    handleGiveConsent,
    handleSign,
  };
}

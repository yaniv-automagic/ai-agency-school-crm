/**
 * API client for the public contract signing ceremony.
 * Communicates with backend endpoints (not Supabase directly).
 */

const BACKEND_URL = import.meta.env.VITE_WEBHOOK_BACKEND_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

interface ContractForSigning {
  id: string;
  title: string;
  body_html: string;
  status: string;
  contact_name: string;
  contact_email: string;
  ceremony_token?: string;
}

interface CeremonyStepResponse {
  success: boolean;
  ceremony_token: string;
}

interface SignResponse {
  success: boolean;
  certificate_id: string;
  signed_pdf_url: string | null;
  signed_at: string;
}

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${url}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "שגיאה בלתי צפויה");
  }

  return data as T;
}

export async function getContractForSigning(token: string): Promise<ContractForSigning> {
  return apiCall<ContractForSigning>(`/api/contracts/sign/${token}`);
}

export async function verifyIdentity(
  token: string,
  fullName: string,
  email: string,
): Promise<CeremonyStepResponse> {
  return apiCall<CeremonyStepResponse>(`/api/contracts/sign/${token}/verify-identity`, {
    method: "POST",
    body: JSON.stringify({ full_name: fullName, email }),
  });
}

export async function confirmReview(
  token: string,
  ceremonyToken: string,
  timeSpentSeconds: number,
): Promise<CeremonyStepResponse> {
  return apiCall<CeremonyStepResponse>(`/api/contracts/sign/${token}/confirm-review`, {
    method: "POST",
    body: JSON.stringify({ ceremony_token: ceremonyToken, time_spent_seconds: timeSpentSeconds }),
  });
}

export async function giveConsent(
  token: string,
  ceremonyToken: string,
  consentText: string,
): Promise<CeremonyStepResponse> {
  return apiCall<CeremonyStepResponse>(`/api/contracts/sign/${token}/consent`, {
    method: "POST",
    body: JSON.stringify({ ceremony_token: ceremonyToken, consent_text: consentText }),
  });
}

export async function submitSignature(
  token: string,
  ceremonyToken: string,
  signatureData: string,
  signatureType: "drawn" | "typed",
): Promise<SignResponse> {
  return apiCall<SignResponse>(`/api/contracts/sign/${token}/sign`, {
    method: "POST",
    body: JSON.stringify({ ceremony_token: ceremonyToken, signature_data: signatureData, signature_type: signatureType }),
  });
}

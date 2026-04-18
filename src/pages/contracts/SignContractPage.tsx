import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useContractByToken, useUpdateContract } from "@/hooks/useContracts";
import SignaturePad from "@/components/contracts/SignaturePad";

export default function SignContractPage() {
  const { token } = useParams();
  const { data: contract, isLoading, error } = useContractByToken(token);
  const updateContract = useUpdateContract();
  const [signed, setSigned] = useState(false);

  const handleSign = async (data: string, type: "drawn" | "typed") => {
    if (!contract) return;

    // Try to get signer IP
    let signerIp = "";
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const json = await res.json();
      signerIp = json.ip;
    } catch {
      // Ignore IP fetch failure
    }

    await updateContract.mutateAsync({
      id: contract.id,
      status: "signed",
      signature_data: data,
      signature_type: type,
      signed_at: new Date().toISOString(),
      signer_ip: signerIp || null,
    });

    setSigned(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" dir="rtl">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-800 mb-2">חוזה לא נמצא</p>
          <p className="text-gray-500">הקישור אינו תקף או שפג תוקפו</p>
        </div>
      </div>
    );
  }

  if (contract.status === "signed" || signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" dir="rtl">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 animate-[scale-in_0.5s_ease-out]">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">החוזה נחתם בהצלחה!</h1>
          <p className="text-gray-500 mb-6">
            תודה שחתמת על החוזה. עותק יישלח אליך במייל.
          </p>
          <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
            <p>
              נחתם ב-{new Date(contract.signed_at || new Date().toISOString()).toLocaleDateString("he-IL")}{" "}
              בשעה{" "}
              {new Date(contract.signed_at || new Date().toISOString()).toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header / Logo */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">AI Agency School</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Contract Title */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">{contract.title}</h2>
          {contract.contact && (
            <p className="text-gray-500 mt-1">
              {contract.contact.first_name} {contract.contact.last_name}
            </p>
          )}
        </div>

        {/* Contract Content */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm">
          <div
            className="prose prose-sm max-w-none"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: contract.body_html }}
          />
        </div>

        {/* Signature Area */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">חתימה</h3>
          <SignaturePad
            onSign={handleSign}
            width={500}
            height={200}
          />
          {updateContract.isPending && (
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              שומר את החתימה...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

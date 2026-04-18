import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText } from "lucide-react";
import { useContracts } from "@/hooks/useContracts";
import { CONTRACT_STATUSES } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import type { ContractStatus } from "@/types/crm";

const FILTER_TABS = [
  { value: "", label: "הכל" },
  { value: "draft", label: "טיוטה" },
  { value: "sent", label: "נשלח" },
  { value: "signed", label: "נחתם" },
] as const;

export default function ContractsPage() {
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "">("");
  const navigate = useNavigate();

  const { data: contracts, isLoading } = useContracts(
    statusFilter ? { status: statusFilter as ContractStatus } : undefined
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">חוזים</h1>
          <p className="text-muted-foreground text-sm">
            {contracts?.length || 0} חוזים
          </p>
        </div>
        <button
          onClick={() => navigate("/contracts/new")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          חוזה חדש
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value as ContractStatus | "")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              statusFilter === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contracts Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">כותרת</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">איש קשר</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">סטטוס</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">נשלח</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">נחתם</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">תאריך יצירה</th>
              </tr>
            </thead>
            <tbody>
              {contracts && contracts.length > 0 ? (
                contracts.map((contract) => {
                  const status = CONTRACT_STATUSES.find(
                    (s) => s.value === contract.status
                  );
                  return (
                    <tr
                      key={contract.id}
                      onClick={() => navigate(`/contracts/${contract.id}`)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-muted-foreground shrink-0" />
                          <span className="font-medium">{contract.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {contract.contact
                          ? `${contract.contact.first_name} ${contract.contact.last_name}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                            status?.color
                          )}
                        >
                          {status?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {contract.sent_at ? timeAgo(contract.sent_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {contract.signed_at ? timeAgo(contract.signed_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {timeAgo(contract.created_at)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                    <FileText size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium mb-1">אין חוזים</p>
                    <p className="text-sm">צור חוזה חדש כדי להתחיל</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

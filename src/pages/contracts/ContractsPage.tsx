import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText } from "lucide-react";
import { useContracts } from "@/hooks/useContracts";
import { CONTRACT_STATUSES } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import type { ContractStatus } from "@/types/crm";
import { useSortable } from "@/hooks/useSortable";
import { SortableHeader } from "@/components/ui/sortable-header";
import { BulkActionBar, BulkDeleteButton } from "@/components/ui/bulk-action-bar";

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
  const { sorted: sortedContracts, isSorted, toggleSort } = useSortable<any>(contracts || [], {
    initialKey: "created_at", initialDir: "desc",
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(prev => prev.length === sortedContracts.length ? [] : sortedContracts.map((c: any) => c.id));
  const contractGetter = (k: string) => {
    switch (k) {
      case "contact":   return (c: any) => `${c.contact?.first_name || ""} ${c.contact?.last_name || ""}`.trim();
      case "title":     return (c: any) => c.title;
      case "status":    return (c: any) => c.status;
      case "sent_at":   return (c: any) => c.sent_at;
      case "signed_at": return (c: any) => c.signed_at;
      case "created_at":return (c: any) => c.created_at;
      default: return (c: any) => c[k];
    }
  };

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
                <th className="w-10 px-3 py-3 text-center">
                  <input type="checkbox" className="rounded accent-primary"
                    checked={sortedContracts.length > 0 && selectedIds.length === sortedContracts.length}
                    onChange={toggleAll} />
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground"><SortableHeader sortKey="title" align="center" isSorted={isSorted} onSort={k => toggleSort(k, contractGetter(k))}>כותרת</SortableHeader></th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground"><SortableHeader sortKey="contact" align="center" isSorted={isSorted} onSort={k => toggleSort(k, contractGetter(k))}>ליד</SortableHeader></th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground"><SortableHeader sortKey="status" align="center" isSorted={isSorted} onSort={k => toggleSort(k, contractGetter(k))}>סטטוס</SortableHeader></th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground"><SortableHeader sortKey="sent_at" align="center" isSorted={isSorted} onSort={k => toggleSort(k, contractGetter(k))}>נשלח</SortableHeader></th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground"><SortableHeader sortKey="signed_at" align="center" isSorted={isSorted} onSort={k => toggleSort(k, contractGetter(k))}>נחתם</SortableHeader></th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground"><SortableHeader sortKey="created_at" align="center" isSorted={isSorted} onSort={k => toggleSort(k, contractGetter(k))}>תאריך יצירה</SortableHeader></th>
              </tr>
            </thead>
            <tbody>
              {sortedContracts && sortedContracts.length > 0 ? (
                sortedContracts.map((contract: any) => {
                  const status = CONTRACT_STATUSES.find(
                    (s) => s.value === contract.status
                  );
                  return (
                    <tr
                      key={contract.id}
                      onClick={() => navigate(`/contracts/${contract.id}`)}
                      className={cn("border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors", selectedIds.includes(contract.id) && "bg-primary/5")}
                    >
                      <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="rounded accent-primary"
                          checked={selectedIds.includes(contract.id)}
                          onChange={() => toggleSelect(contract.id)} />
                      </td>
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
                        {contract.sent_at ? formatDateTime(contract.sent_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {contract.signed_at ? formatDateTime(contract.signed_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDateTime(contract.created_at)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
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

      <BulkActionBar selectedIds={selectedIds} onClear={() => setSelectedIds([])} entityLabel="חוזים">
        <BulkDeleteButton selectedIds={selectedIds} onCleared={() => setSelectedIds([])} tableName="crm_contracts" entityLabel="חוזים" invalidateKeys={[["contracts"]]} />
      </BulkActionBar>
    </div>
  );
}

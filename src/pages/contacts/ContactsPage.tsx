import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Filter, Download, Upload, LayoutGrid, List } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import { CONTACT_STATUSES, CONTACT_SOURCES } from "@/lib/constants";
import { cn, formatPhone, timeAgo } from "@/lib/utils";
import ContactForm from "@/components/contacts/ContactForm";
import { ExportButton, ImportButton } from "@/components/contacts/ImportExportContacts";
import BulkActions from "@/components/contacts/BulkActions";

export default function ContactsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(searchParams.get("new") === "true");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const navigate = useNavigate();

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    if (!contacts) return;
    setSelectedIds(prev => prev.length === contacts.length ? [] : contacts.map(c => c.id));
  };

  const { data: contacts, isLoading } = useContacts({
    search: search || undefined,
    status: (statusFilter || undefined) as any,
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">אנשי קשר</h1>
          <p className="text-muted-foreground text-sm">
            {contacts?.length || 0} אנשי קשר
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          איש קשר חדש
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="חיפוש לפי שם, מייל, טלפון..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
        >
          <option value="">כל הסטטוסים</option>
          {CONTACT_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <ExportButton contacts={contacts || []} />
        <ImportButton />

        <div className="flex items-center border border-input rounded-lg overflow-hidden mr-auto">
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "p-2 transition-colors",
              viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
            )}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={cn(
              "p-2 transition-colors",
              viewMode === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
            )}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Contacts Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : viewMode === "table" ? (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" className="rounded accent-primary" checked={contacts?.length ? selectedIds.length === contacts.length : false} onChange={toggleAll} />
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">שם</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">מייל</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">טלפון</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">סטטוס</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">מקור</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">נוצר</th>
              </tr>
            </thead>
            <tbody>
              {contacts && contacts.length > 0 ? (
                contacts.map(contact => {
                  const status = CONTACT_STATUSES.find(s => s.value === contact.status);
                  const source = CONTACT_SOURCES.find(s => s.value === contact.source);
                  return (
                    <tr
                      key={contact.id}
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                      className={cn("border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors", selectedIds.includes(contact.id) && "bg-primary/5")}
                    >
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="rounded accent-primary" checked={selectedIds.includes(contact.id)} onChange={() => toggleSelect(contact.id)} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                            {contact.first_name?.charAt(0)}{contact.last_name?.charAt(0)}
                          </div>
                          <span className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{contact.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground" dir="ltr">{formatPhone(contact.phone || "")}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                          "bg-secondary text-secondary-foreground"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", status?.color)} />
                          {status?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{source?.label || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{timeAgo(contact.created_at)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <p className="text-lg font-medium mb-1">אין אנשי קשר</p>
                    <p className="text-sm">התחל להוסיף אנשי קשר למערכת</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Kanban View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {CONTACT_STATUSES.map(status => {
            const statusContacts = contacts?.filter(c => c.status === status.value) || [];
            return (
              <div key={status.value} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={cn("w-2.5 h-2.5 rounded-full", status.color)} />
                  <span className="text-sm font-medium">{status.label}</span>
                  <span className="text-xs text-muted-foreground mr-auto">
                    {statusContacts.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {statusContacts.map(contact => (
                    <div
                      key={contact.id}
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                      className="p-3 bg-card border border-border rounded-lg hover:shadow-md cursor-pointer transition-all"
                    >
                      <p className="font-medium text-sm">
                        {contact.first_name} {contact.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {contact.email || contact.phone || "—"}
                      </p>
                      {contact.tags?.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {contact.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-xs bg-secondary px-2 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contact Form Sheet */}
      {showForm && (
        <ContactForm
          onClose={() => {
            setShowForm(false);
            searchParams.delete("new");
            setSearchParams(searchParams);
          }}
        />
      )}

      {/* Bulk Actions */}
      <BulkActions selectedIds={selectedIds} onClear={() => setSelectedIds([])} totalCount={contacts?.length || 0} />
    </div>
  );
}

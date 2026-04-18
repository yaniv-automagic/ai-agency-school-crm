import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Filter, Download, Upload, LayoutGrid, List } from "lucide-react";
import { useContacts, useUpdateContact } from "@/hooks/useContacts";
import { usePipelines } from "@/hooks/useDeals";
import { CONTACT_SOURCES } from "@/lib/constants";
import { cn, formatPhone, timeAgo } from "@/lib/utils";
import ContactForm from "@/components/contacts/ContactForm";
import { ExportButton, ImportButton } from "@/components/contacts/ImportExportContacts";
import BulkActions from "@/components/contacts/BulkActions";
import type { PipelineStage } from "@/types/crm";

export default function ContactsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(searchParams.get("new") === "true");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusPickerId, setStatusPickerId] = useState<string | null>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; right: number } | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const navigate = useNavigate();
  const updateContact = useUpdateContact();
  const { data: pipelines } = usePipelines();

  const activePipeline = selectedPipelineId
    ? pipelines?.find(p => p.id === selectedPipelineId)
    : pipelines?.find(p => p.is_default) || pipelines?.[0];
  const stages = activePipeline?.stages || [];

  // All stages across all pipelines - for display lookups
  const allStages = pipelines?.flatMap(p => p.stages || []) || [];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    if (!contacts) return;
    setSelectedIds(prev => prev.length === contacts.length ? [] : contacts.map(c => c.id));
  };

  const { data: contacts, isLoading } = useContacts({
    search: search || undefined,
    stage_id: stageFilter || undefined,
  });

  const getContactStage = (contact: { stage_id: string | null; stage?: PipelineStage }) => {
    if (contact.stage) return contact.stage;
    return allStages.find(s => s.id === contact.stage_id);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">לידים</h1>
          <p className="text-muted-foreground text-sm">
            {contacts?.length || 0} לידים
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          ליד חדש
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

        {pipelines && pipelines.length > 1 && (
          <select
            value={selectedPipelineId}
            onChange={(e) => { setSelectedPipelineId(e.target.value); setStageFilter(""); }}
            className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
          >
            {pipelines.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
        >
          <option value="">כל השלבים</option>
          {stages.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
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
        <div className="border border-border rounded-xl bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" className="rounded accent-primary" checked={contacts?.length ? selectedIds.length === contacts.length : false} onChange={toggleAll} />
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">שם</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">מייל</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">טלפון</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">שלב</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">אחראי</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">מקור</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">נוצר</th>
              </tr>
            </thead>
            <tbody>
              {contacts && contacts.length > 0 ? (
                contacts.map(contact => {
                  const stage = getContactStage(contact);
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
                          {contact.avatar_url ? (
                            <img src={contact.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                              {contact.first_name?.charAt(0)}{contact.last_name?.charAt(0)}
                            </div>
                          )}
                          <span className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{contact.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground" dir="ltr">{formatPhone(contact.phone || "")}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            if (statusPickerId === contact.id) {
                              setStatusPickerId(null);
                              setPickerPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setPickerPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setStatusPickerId(contact.id);
                            }
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                            "bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                          )}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: stage?.color || "#6b7280" }}
                          />
                          {stage?.name || "ללא שלב"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {contact.assigned_member ? (
                          <div className="flex items-center gap-2">
                            {contact.assigned_member.avatar_url ? (
                              <img src={contact.assigned_member.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                                {contact.assigned_member.display_name?.charAt(0)}
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground">{contact.assigned_member.display_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{source?.label || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{timeAgo(contact.created_at)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    <p className="text-lg font-medium mb-1">אין לידים</p>
                    <p className="text-sm">התחל להוסיף לידים למערכת</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Kanban View - grouped by pipeline stages */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => {
            const stageContacts = contacts?.filter(c => c.stage_id === stage.id) || [];
            return (
              <div key={stage.id} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color || "#6b7280" }} />
                  <span className="text-sm font-medium">{stage.name}</span>
                  <span className="text-xs text-muted-foreground mr-auto">
                    {stageContacts.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {stageContacts.map(contact => (
                    <div
                      key={contact.id}
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                      className="p-3 bg-card border border-border rounded-lg hover:shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {contact.avatar_url ? (
                          <img src={contact.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-medium">
                            {contact.first_name?.charAt(0)}{contact.last_name?.charAt(0)}
                          </div>
                        )}
                        <p className="font-medium text-sm">
                          {contact.first_name} {contact.last_name}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
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
          {/* Unassigned column for contacts without a stage */}
          {(() => {
            const noStage = contacts?.filter(c => !c.stage_id) || [];
            if (noStage.length === 0) return null;
            return (
              <div className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                  <span className="text-sm font-medium text-muted-foreground">ללא שלב</span>
                  <span className="text-xs text-muted-foreground mr-auto">{noStage.length}</span>
                </div>
                <div className="space-y-2">
                  {noStage.map(contact => (
                    <div
                      key={contact.id}
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                      className="p-3 bg-card border border-border rounded-lg hover:shadow-md cursor-pointer transition-all"
                    >
                      <p className="font-medium text-sm">{contact.first_name} {contact.last_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{contact.email || contact.phone || "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
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

      {/* Stage picker portal */}
      {statusPickerId && pickerPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setStatusPickerId(null); setPickerPos(null); }} />
          <div
            className="fixed bg-card border border-border rounded-xl shadow-xl py-1 w-48 z-50 max-h-80 overflow-y-auto"
            style={{ top: pickerPos.top, right: pickerPos.right }}
            dir="rtl"
          >
            {pipelines?.map(pipeline => (
              <div key={pipeline.id}>
                {pipelines.length > 1 && (
                  <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
                    {pipeline.name}
                  </div>
                )}
                {pipeline.stages?.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      updateContact.mutate({ id: statusPickerId, stage_id: s.id } as any);
                      setStatusPickerId(null);
                      setPickerPos(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                      contacts?.find(c => c.id === statusPickerId)?.stage_id === s.id && "bg-secondary/50 font-medium"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || "#6b7280" }} />
                    {s.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

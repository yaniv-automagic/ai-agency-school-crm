import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Mail, Phone, MessageCircle, Building2, MapPin, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { useContact, useDeleteContact } from "@/hooks/useContacts";
import { useActivities, useCreateActivity } from "@/hooks/useActivities";
import { useDeals } from "@/hooks/useDeals";
import { useTasks } from "@/hooks/useTasks";
import { CONTACT_STATUSES, CONTACT_SOURCES, ACTIVITY_TYPES } from "@/lib/constants";
import { cn, formatPhone, timeAgo, formatCurrency } from "@/lib/utils";
import { useState } from "react";
import ContactForm from "@/components/contacts/ContactForm";
import WhatsAppChat from "@/components/whatsapp/WhatsAppChat";
import ActivityTimeline from "@/components/contacts/ActivityTimeline";

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useContact(id);
  const { data: activities } = useActivities({ contact_id: id });
  const { data: deals } = useDeals({ contact_id: id });
  const { data: tasks } = useTasks({ contact_id: id });
  const deleteContact = useDeleteContact();
  const createActivity = useCreateActivity();
  const [showEdit, setShowEdit] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [noteText, setNoteText] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">איש קשר לא נמצא</p>
        <button onClick={() => navigate("/contacts")} className="text-primary mt-2 text-sm">
          חזרה לאנשי קשר
        </button>
      </div>
    );
  }

  const status = CONTACT_STATUSES.find(s => s.value === contact.status);
  const source = CONTACT_SOURCES.find(s => s.value === contact.source);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await createActivity.mutateAsync({
      contact_id: contact.id,
      type: "note",
      body: noteText,
    });
    setNoteText("");
  };

  const handleDelete = async () => {
    if (!confirm("האם למחוק את איש הקשר?")) return;
    await deleteContact.mutateAsync(contact.id);
    navigate("/contacts");
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/contacts")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRight size={16} />
        חזרה לאנשי קשר
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
            {contact.first_name?.charAt(0)}{contact.last_name?.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {contact.first_name} {contact.last_name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              {contact.company && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building2 size={14} />
                  {contact.company}
                </span>
              )}
              {contact.city && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin size={14} />
                  {contact.city}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", status?.color)} />
                {status?.label}
              </span>
              {source && (
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {source.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(contact.whatsapp_phone || contact.phone) && (
            <button
              onClick={() => setShowWhatsApp(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <MessageCircle size={14} />
              WhatsApp
            </button>
          )}
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-input rounded-lg hover:bg-secondary transition-colors"
          >
            <Edit size={14} />
            עריכה
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-destructive border border-input rounded-lg hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - Activity Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold mb-4">פעילות</h3>
            <ActivityTimeline contactId={contact.id} />
          </div>
        </div>

        {/* Sidebar - Contact Details */}
        <div className="space-y-4">
          {/* Contact Info */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">פרטי קשר</h3>
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                <Mail size={14} />
                <span dir="ltr">{contact.email}</span>
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                <Phone size={14} />
                <span dir="ltr">{formatPhone(contact.phone)}</span>
              </a>
            )}
            {contact.whatsapp_phone && (
              <a
                href={`https://wa.me/${contact.whatsapp_phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-emerald-500"
              >
                <MessageCircle size={14} />
                <span dir="ltr">{contact.whatsapp_phone}</span>
              </a>
            )}
            {contact.job_title && (
              <p className="text-sm text-muted-foreground">{contact.job_title}</p>
            )}
          </div>

          {/* Deals */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">עסקאות</h3>
            {deals && deals.length > 0 ? (
              <div className="space-y-2">
                {deals.map(deal => (
                  <div
                    key={deal.id}
                    onClick={() => navigate(`/pipeline/${deal.id}`)}
                    className="p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
                  >
                    <p className="text-sm font-medium">{deal.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{deal.stage?.name}</span>
                      <span className="text-xs font-medium">{formatCurrency(deal.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">אין עסקאות</p>
            )}
          </div>

          {/* Tasks */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">משימות</h3>
            {tasks && tasks.filter(t => t.status !== "completed").length > 0 ? (
              <div className="space-y-2">
                {tasks
                  .filter(t => t.status !== "completed")
                  .map(task => (
                    <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">{task.title}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">אין משימות פתוחות</p>
            )}
          </div>

          {/* Tags */}
          {contact.tags?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3">תגיות</h3>
              <div className="flex flex-wrap gap-1">
                {contact.tags.map(tag => (
                  <span key={tag} className="text-xs bg-secondary px-2 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-2">הערות</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <ContactForm contact={contact} onClose={() => setShowEdit(false)} />
      )}

      {showWhatsApp && (
        <WhatsAppChat contact={contact} onClose={() => setShowWhatsApp(false)} />
      )}
    </div>
  );
}

import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Mail, Phone, MessageCircle, Building2, MapPin, Edit, Trash2, Video, Calendar, UserCircle, Kanban, FileSignature, Send } from "lucide-react";
import { useContact, useDeleteContact, useUpdateContact } from "@/hooks/useContacts";
import { useActivities, useCreateActivity } from "@/hooks/useActivities";
import { useDeals, usePipelines } from "@/hooks/useDeals";
import { useTasks } from "@/hooks/useTasks";
import { useMeetings, useCreateMeeting } from "@/hooks/useMeetings";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { CONTACT_SOURCES, MEETING_TYPES } from "@/lib/constants";
import { cn, formatPhone, timeAgo, formatCurrency } from "@/lib/utils";
import { useState } from "react";
import ContactForm from "@/components/contacts/ContactForm";
import DealForm from "@/components/deals/DealForm";
import WhatsAppChat from "@/components/whatsapp/WhatsAppChat";
import ActivityTimeline from "@/components/contacts/ActivityTimeline";
import { useContractTemplates, useCreateContract } from "@/hooks/useContracts";
import { toast } from "sonner";

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useContact(id);
  const { data: activities } = useActivities({ contact_id: id });
  const { data: deals } = useDeals({ contact_id: id });
  const { data: tasks } = useTasks({ contact_id: id });
  const { data: meetings } = useMeetings({ contact_id: id });
  const { data: pipelines } = usePipelines();
  const { members } = useTeamMembers();
  const deleteContact = useDeleteContact();
  const updateContact = useUpdateContact();
  const createActivity = useCreateActivity();
  const createMeeting = useCreateMeeting();
  const { data: contractTemplates } = useContractTemplates();
  const createContract = useCreateContract();
  const [showEdit, setShowEdit] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [contractTitle, setContractTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [meetingData, setMeetingData] = useState({
    title: "",
    meeting_type: "sales_consultation" as string,
    scheduled_at: "",
    duration_minutes: 30,
    description: "",
    meeting_url: "",
  });

  const allStages = pipelines?.flatMap(p => p.stages || []) || [];

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
        <p className="text-muted-foreground">ליד לא נמצא</p>
        <button onClick={() => navigate("/contacts")} className="text-primary mt-2 text-sm">
          חזרה ללידים
        </button>
      </div>
    );
  }

  const stage = contact.stage || allStages.find(s => s.id === contact.stage_id);
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
    if (!confirm("האם למחוק את הליד?")) return;
    await deleteContact.mutateAsync(contact.id);
    navigate("/contacts");
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMeeting.mutateAsync({
      contact_id: contact.id,
      title: meetingData.title || `פגישה עם ${contact.first_name} ${contact.last_name}`,
      meeting_type: meetingData.meeting_type as any,
      scheduled_at: meetingData.scheduled_at,
      duration_minutes: meetingData.duration_minutes,
      description: meetingData.description || undefined,
      meeting_url: meetingData.meeting_url || undefined,
      status: "scheduled",
    } as any);
    setShowMeetingForm(false);
    setMeetingData({ title: "", meeting_type: "sales_consultation", scheduled_at: "", duration_minutes: 30, description: "", meeting_url: "" });
  };

  const handleSendContract = async (e: React.FormEvent) => {
    e.preventDefault();
    const template = contractTemplates?.find(t => t.id === selectedTemplateId);
    if (!template) return;

    // Replace variables in template body
    let body = template.body_html;
    body = body.replace(/\{\{first_name\}\}/g, contact.first_name);
    body = body.replace(/\{\{last_name\}\}/g, contact.last_name);
    body = body.replace(/\{\{full_name\}\}/g, `${contact.first_name} ${contact.last_name}`);
    body = body.replace(/\{\{email\}\}/g, contact.email || "");
    body = body.replace(/\{\{phone\}\}/g, contact.phone || "");
    body = body.replace(/\{\{company\}\}/g, contact.company || "");
    body = body.replace(/\{\{date\}\}/g, new Date().toLocaleDateString("he-IL"));

    const result = await createContract.mutateAsync({
      contact_id: contact.id,
      template_id: template.id,
      title: contractTitle || `${template.name} - ${contact.first_name} ${contact.last_name}`,
      body_html: body,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    setShowContractForm(false);
    setSelectedTemplateId("");
    setContractTitle("");
    toast.success("ההסכם נוצר ונשלח");
    navigate(`/contracts/${result.id}`);
  };

  const upcomingMeetings = meetings?.filter(m => m.status === "scheduled" || m.status === "confirmed") || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/contacts")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRight size={16} />
        חזרה ללידים
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {contact.avatar_url ? (
            <img src={contact.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
              {contact.first_name?.charAt(0)}{contact.last_name?.charAt(0)}
            </div>
          )}
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
              {/* Source badge */}
              {source && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                  {source.label}
                </span>
              )}

              {/* Status/Stage picker */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusPicker(!showStatusPicker)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage?.color || "#6b7280" }} />
                  {stage?.name || "ללא שלב"}
                </button>
                {showStatusPicker && (
                  <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl shadow-xl py-1 w-48 z-50 max-h-72 overflow-y-auto" dir="rtl">
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
                              updateContact.mutate({ id: contact.id, stage_id: s.id } as any);
                              setShowStatusPicker(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                              s.id === contact.stage_id && "bg-secondary/50 font-medium"
                            )}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || "#6b7280" }} />
                            {s.name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignee picker */}
              <div className="relative">
                <button
                  onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
                >
                  {contact.assigned_member ? (
                    <>
                      {contact.assigned_member.avatar_url ? (
                        <img src={contact.assigned_member.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                          {contact.assigned_member.display_name?.charAt(0)}
                        </div>
                      )}
                      {contact.assigned_member.display_name}
                    </>
                  ) : (
                    <span className="text-muted-foreground">לא משויך</span>
                  )}
                </button>
                {showAssigneePicker && (
                  <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl shadow-xl py-1 w-48 z-50" dir="rtl">
                    <button
                      onClick={() => { updateContact.mutate({ id: contact.id, assigned_to: null } as any); setShowAssigneePicker(false); }}
                      className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right", !contact.assigned_to && "bg-secondary/50 font-medium")}
                    >
                      ללא שיוך
                    </button>
                    {members.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { updateContact.mutate({ id: contact.id, assigned_to: m.id } as any); setShowAssigneePicker(false); }}
                        className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right", m.id === contact.assigned_to && "bg-secondary/50 font-medium")}
                      >
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-medium">{m.display_name?.charAt(0)}</div>
                        )}
                        {m.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDealForm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Kanban size={14} />
            צור עסקה
          </button>
          <button
            onClick={() => {
              setContractTitle("");
              setSelectedTemplateId("");
              setShowContractForm(true);
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <FileSignature size={14} />
            שלח הסכם
          </button>
          <button
            onClick={() => setShowMeetingForm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Video size={14} />
            קבע פגישה
          </button>
          {contact.phone && (
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
            {contact.job_title && (
              <p className="text-sm text-muted-foreground">{contact.job_title}</p>
            )}

          </div>

          {/* Upcoming Meetings */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">פגישות</h3>
              <button
                onClick={() => setShowMeetingForm(true)}
                className="text-xs text-primary hover:underline"
              >
                + קבע פגישה
              </button>
            </div>
            {upcomingMeetings.length > 0 ? (
              <div className="space-y-2">
                {upcomingMeetings.map(meeting => (
                  <div
                    key={meeting.id}
                    onClick={() => navigate(`/meetings/${meeting.id}`)}
                    className="p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
                  >
                    <p className="text-sm font-medium">{meeting.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar size={12} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(meeting.scheduled_at).toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">אין פגישות קרובות</p>
            )}
          </div>

          {/* Deals */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">עסקאות</h3>
              <button
                onClick={() => setShowDealForm(true)}
                className="text-xs text-primary hover:underline"
              >
                + עסקה חדשה
              </button>
            </div>
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

      {showDealForm && (
        <DealForm defaultContactId={contact.id} onClose={() => setShowDealForm(false)} />
      )}

      {showWhatsApp && (
        <WhatsAppChat contact={contact} onClose={() => setShowWhatsApp(false)} />
      )}

      {/* Send Contract Modal */}
      {showContractForm && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowContractForm(false)}>
          <div
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileSignature size={20} />
                שליחת הסכם
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                ל{contact.first_name} {contact.last_name}
              </p>
            </div>
            <form onSubmit={handleSendContract} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">תבנית הסכם *</label>
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
                >
                  <option value="">בחר תבנית</option>
                  {contractTemplates?.filter(t => t.is_active).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {contractTemplates && contractTemplates.filter(t => t.is_active).length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    אין תבניות הסכם פעילות.{" "}
                    <button
                      type="button"
                      onClick={() => navigate("/settings/contracts")}
                      className="text-primary hover:underline"
                    >
                      צור תבנית
                    </button>
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">כותרת ההסכם</label>
                <input
                  value={contractTitle}
                  onChange={e => setContractTitle(e.target.value)}
                  placeholder={`הסכם - ${contact.first_name} ${contact.last_name}`}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {contact.email && (
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Send size={14} />
                  לינק לחתימה יישלח ל: <span className="font-medium text-foreground" dir="ltr">{contact.email}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createContract.isPending || !selectedTemplateId}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {createContract.isPending ? "שולח..." : "צור ושלח הסכם"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowContractForm(false)}
                  className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meeting Form Modal */}
      {showMeetingForm && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowMeetingForm(false)}>
          <div
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold">קביעת פגישה</h2>
              <p className="text-sm text-muted-foreground mt-1">
                עם {contact.first_name} {contact.last_name}
              </p>
            </div>
            <form onSubmit={handleCreateMeeting} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">כותרת</label>
                <input
                  value={meetingData.title}
                  onChange={e => setMeetingData(d => ({ ...d, title: e.target.value }))}
                  placeholder={`פגישה עם ${contact.first_name} ${contact.last_name}`}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">סוג פגישה</label>
                  <select
                    value={meetingData.meeting_type}
                    onChange={e => setMeetingData(d => ({ ...d, meeting_type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
                  >
                    {MEETING_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">משך (דקות)</label>
                  <select
                    value={meetingData.duration_minutes}
                    onChange={e => setMeetingData(d => ({ ...d, duration_minutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
                  >
                    <option value={15}>15 דקות</option>
                    <option value={30}>30 דקות</option>
                    <option value={45}>45 דקות</option>
                    <option value={60}>60 דקות</option>
                    <option value={90}>90 דקות</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">תאריך ושעה *</label>
                <input
                  type="datetime-local"
                  value={meetingData.scheduled_at}
                  onChange={e => setMeetingData(d => ({ ...d, scheduled_at: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">לינק לפגישה</label>
                <input
                  value={meetingData.meeting_url}
                  onChange={e => setMeetingData(d => ({ ...d, meeting_url: e.target.value }))}
                  placeholder="https://zoom.us/j/..."
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">הערות</label>
                <textarea
                  value={meetingData.description}
                  onChange={e => setMeetingData(d => ({ ...d, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="הערות לפגישה..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMeeting.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {createMeeting.isPending ? "שומר..." : "קבע פגישה"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMeetingForm(false)}
                  className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

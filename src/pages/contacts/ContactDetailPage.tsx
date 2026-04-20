import { useParams, useNavigate } from "react-router-dom";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ArrowRight, Mail, Phone, MessageCircle, MapPin, Edit, Trash2, Video, Calendar, UserCircle, Kanban, FileSignature, Send, Hash } from "lucide-react";
import { useContact, useDeleteContact, useUpdateContact } from "@/hooks/useContacts";
import { useActivities, useCreateActivity } from "@/hooks/useActivities";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useDeals, usePipelines } from "@/hooks/useDeals";
import { useTasks, useCreateTask } from "@/hooks/useTasks";
import { useMeetings, useCreateMeeting } from "@/hooks/useMeetings";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { CONTACT_SOURCES, MEETING_TYPES } from "@/lib/constants";
import { cn, formatPhone, formatDateTime, formatCurrency } from "@/lib/utils";
import { useState } from "react";
import ContactForm from "@/components/contacts/ContactForm";
import DealForm from "@/components/deals/DealForm";
import WhatsAppChat from "@/components/whatsapp/WhatsAppChat";
import ActivityTimeline from "@/components/contacts/ActivityTimeline";
import { useContractTemplates, useCreateContract } from "@/hooks/useContracts";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const confirm = useConfirm();
  const updateContact = useUpdateContact();
  const createActivity = useCreateActivity();
  const createMeeting = useCreateMeeting();
  const { data: contractTemplates } = useContractTemplates();
  const createContract = useCreateContract();

  // Cross-reference ad campaign from UTM
  const { data: matchedAdCampaign } = useQuery({
    queryKey: ["ad-campaign-match", id],
    queryFn: async () => {
      if (!contact?.ad_campaign_id && !contact?.utm_campaign) return null;
      let q = supabase.from("crm_ad_campaigns").select("name, status, platform_campaign_id");
      if (contact?.ad_campaign_id) q = q.eq("platform_campaign_id", contact.ad_campaign_id);
      else if (contact?.utm_campaign) q = q.ilike("name", `%${contact.utm_campaign}%`);
      const { data } = await q.limit(1).single();
      return data as { name: string; status: string | null; platform_campaign_id: string } | null;
    },
    enabled: !!contact && !!(contact.ad_campaign_id || contact.utm_campaign),
  });

  const [showEdit, setShowEdit] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [contractTitle, setContractTitle] = useState("");
  const [showTaskCreate, setShowTaskCreate] = useState(false);
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
  const contactPipeline = stage ? pipelines?.find(p => p.stages?.some(s => s.id === stage.id)) : null;

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
    const confirmed = await confirm({
      title: "מחיקת ליד",
      description: "האם למחוק את הליד?",
      confirmText: "מחק",
      cancelText: "ביטול",
      variant: "destructive",
    });
    if (!confirmed) return;
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
          <div>
            <h1 className="text-2xl font-bold">
              {contact.first_name} {contact.last_name}
            </h1>
            {(contact.address || contact.city) && (
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <MapPin size={14} />
                {contact.address || contact.city}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              {/* Source badge */}
              {source && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                  {source.label}
                </span>
              )}

              {/* Pipeline badge */}
              {contactPipeline && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                  {contactPipeline.name}
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
          {contact.phone && (
            <button onClick={() => setShowWhatsApp(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
              <MessageCircle size={14} /> WhatsApp
            </button>
          )}
          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-input rounded-lg hover:bg-secondary transition-colors">
            <Edit size={14} /> עריכה
          </button>
          <button onClick={handleDelete}
            className="p-2 text-destructive border border-input rounded-lg hover:bg-destructive/10 transition-colors">
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
          {/* Contact Info - Inline Editable */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
            <h3 className="font-semibold text-sm">פרטים</h3>
            <InlineField label="מייל" value={contact.email} icon={<Mail size={13} />}
              onSave={v => updateContact.mutate({ id: contact.id, email: v || null } as any)}
              href={contact.email ? `mailto:${contact.email}` : undefined} dir="ltr" />
            <InlineField label="טלפון" value={contact.phone} icon={<Phone size={13} />}
              onSave={v => updateContact.mutate({ id: contact.id, phone: v || null } as any)}
              displayValue={formatPhone(contact.phone || "")}
              href={contact.phone ? `tel:${contact.phone}` : undefined} dir="ltr" />
            <InlineField label="כתובת" value={contact.address || contact.city} icon={<MapPin size={13} />}
              onSave={v => updateContact.mutate({ id: contact.id, address: v || null } as any)} />
            <InlineField label="ת.ז." value={contact.id_number} icon={<Hash size={13} />}
              onSave={v => updateContact.mutate({ id: contact.id, id_number: v || null } as any)} dir="ltr" />
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

          {/* Tasks - with inline create */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">משימות</h3>
              <button onClick={() => setShowTaskCreate(!showTaskCreate)} className="text-xs text-primary hover:underline">
                + משימה חדשה
              </button>
            </div>
            {showTaskCreate && (
              <TaskCreateWidget contactId={contact.id} members={members}
                onClose={() => setShowTaskCreate(false)} />
            )}
            {tasks && tasks.filter(t => t.status !== "completed").length > 0 ? (
              <div className="space-y-2">
                {tasks.filter(t => t.status !== "completed").map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50">
                    <input type="checkbox" className="rounded accent-primary w-3.5 h-3.5" />
                    <span className="text-sm flex-1">{task.title}</span>
                    {task.assigned_member && (
                      <span className="text-[10px] text-muted-foreground">{task.assigned_member.display_name}</span>
                    )}
                    {task.due_date && (
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(task.due_date)}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : !showTaskCreate ? (
              <p className="text-xs text-muted-foreground">אין משימות פתוחות</p>
            ) : null}
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

          {/* Marketing Attribution - always visible */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-sm">נתוני שיווק</h3>
            <MarketingRow label="סוג תנועה" value={
              contact.utm_medium?.includes("paid") || contact.utm_medium?.includes("cpc") || contact.ad_platform ? "ממומן" :
              contact.source === "referral" ? "הפניה" :
              contact.utm_medium === "organic" || contact.source === "website" ? "אורגני" :
              contact.utm_medium === "social" ? "רשתות חברתיות" :
              contact.source || "לא ידוע"
            } badge />
            <MarketingRow label="פלטפורמה" value={contact.ad_platform || (contact.utm_source?.includes("facebook") || contact.utm_source?.includes("fb") ? "facebook" : contact.utm_source?.includes("instagram") ? "instagram" : contact.utm_source?.includes("google") ? "google" : contact.utm_source?.includes("youtube") ? "youtube" : "—")} />
            <MarketingRow label="מקור (source)" value={contact.utm_source} dir="ltr" />
            <MarketingRow label="מדיום (medium)" value={contact.utm_medium} dir="ltr" />
            <MarketingRow label="קמפיין" value={contact.utm_campaign} dir="ltr" />
            {matchedAdCampaign && (
              <MarketingRow label="מודעה" value={matchedAdCampaign.name} />
            )}
            {contact.ad_campaign_id && !matchedAdCampaign && (
              <MarketingRow label="מזהה מודעה" value={contact.ad_campaign_id} dir="ltr" />
            )}
            {contact.utm_content && <MarketingRow label="תוכן" value={contact.utm_content} dir="ltr" />}
            {contact.utm_term && <MarketingRow label="מונח" value={contact.utm_term} dir="ltr" />}
            <MarketingRow label="סוג כניסה" value={contact.entry_type || "—"} />
            <MarketingRow label="דף נחיתה" value={contact.landing_page_url?.replace("https://aiagencyschool.co.il", "") || "—"}
              href={contact.landing_page_url || undefined} dir="ltr" />
            <MarketingRow label="מגע ראשון" value={contact.first_touch_at ? formatDateTime(contact.first_touch_at) : "—"} />
            <MarketingRow label="המרה אחרונה" value={contact.conversion_at ? formatDateTime(contact.conversion_at) : "—"} />
          </div>
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
                <Select value={selectedTemplateId || undefined} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background">
                    <SelectValue placeholder="בחר תבנית" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTemplates?.filter(t => t.is_active).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <Select value={meetingData.meeting_type} onValueChange={v => setMeetingData(d => ({ ...d, meeting_type: v }))}>
                    <SelectTrigger className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background">
                      <SelectValue placeholder="בחר סוג" />
                    </SelectTrigger>
                    <SelectContent>
                      {MEETING_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">משך (דקות)</label>
                  <Select value={String(meetingData.duration_minutes)} onValueChange={v => setMeetingData(d => ({ ...d, duration_minutes: Number(v) }))}>
                    <SelectTrigger className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background">
                      <SelectValue placeholder="משך" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 דקות</SelectItem>
                      <SelectItem value="30">30 דקות</SelectItem>
                      <SelectItem value="45">45 דקות</SelectItem>
                      <SelectItem value="60">60 דקות</SelectItem>
                      <SelectItem value="90">90 דקות</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">תאריך ושעה *</label>
                <DateTimePicker
                  value={meetingData.scheduled_at}
                  onChange={v => setMeetingData(d => ({ ...d, scheduled_at: v }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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

// ── Inline Editable Field ──
function InlineField({ label, value, icon, onSave, href, dir, displayValue }: {
  label: string; value: string | null | undefined; icon?: React.ReactNode;
  onSave: (v: string) => void; href?: string; dir?: string; displayValue?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  const commit = () => { if (draft !== (value || "")) onSave(draft); setEditing(false); };

  return (
    <div className="flex items-center gap-2 group min-h-[28px]">
      {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
      <span className="text-xs text-muted-foreground w-12 shrink-0">{label}</span>
      {editing ? (
        <input value={draft} onChange={e => setDraft(e.target.value)} dir={dir}
          className="flex-1 px-2 py-0.5 text-sm border border-input rounded bg-background outline-none focus:ring-1 focus:ring-ring"
          autoFocus onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} />
      ) : (
        <div className="flex-1 flex items-center gap-1 min-w-0 cursor-pointer" onClick={() => { setDraft(value || ""); setEditing(true); }}>
          {href && value ? (
            <a href={href} onClick={e => e.stopPropagation()} className="text-sm text-muted-foreground hover:text-primary truncate" dir={dir}>
              {displayValue || value}
            </a>
          ) : (
            <span className={cn("text-sm truncate", value ? "text-foreground" : "text-muted-foreground/50")} dir={dir}>
              {displayValue || value || "—"}
            </span>
          )}
          <Edit size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
        </div>
      )}
    </div>
  );
}

// ── Task Create Widget ──
function TaskCreateWidget({ contactId, members, onClose }: {
  contactId: string; members: { id: string; display_name: string }[]; onClose: () => void;
}) {
  const createTask = useCreateTask();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");

  const handleCreate = async () => {
    if (!title.trim()) return;
    await createTask.mutateAsync({
      title, contact_id: contactId, type: "task", priority: priority as any, status: "pending",
      assigned_to: assignee || null, due_date: dueDate ? new Date(dueDate).toISOString() : null,
    } as any);
    toast.success("משימה נוצרה");
    onClose();
  };

  return (
    <div className="space-y-2 mb-3 p-3 bg-muted/30 rounded-lg border border-border">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="מה צריך לעשות?"
        className="w-full px-2.5 py-1.5 text-sm border border-input rounded-lg bg-background outline-none" autoFocus />
      <div className="grid grid-cols-3 gap-2">
        <Select value={assignee || "__none__"} onValueChange={v => setAssignee(v === "__none__" ? "" : v)}>
          <SelectTrigger className="text-xs h-8"><SelectValue placeholder="אחראי" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">ללא</SelectItem>
            {members.map(m => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">נמוכה</SelectItem>
            <SelectItem value="medium">בינונית</SelectItem>
            <SelectItem value="high">גבוהה</SelectItem>
            <SelectItem value="urgent">דחוף</SelectItem>
          </SelectContent>
        </Select>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="px-2 py-1 text-xs border border-input rounded-lg bg-background outline-none h-8" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-secondary">ביטול</button>
        <button onClick={handleCreate} disabled={!title.trim()}
          className="px-3 py-1 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
          צור
        </button>
      </div>
    </div>
  );
}

// ── Marketing Row ──
function MarketingRow({ label, value, dir, href, badge }: {
  label: string; value: string | null | undefined; dir?: string; href?: string; badge?: boolean;
}) {
  const display = value || "—";
  const hasValue = !!value && value !== "—";
  return (
    <div className="flex items-center justify-between text-xs gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {badge && hasValue ? (
        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium",
          display === "ממומן" ? "bg-blue-100 text-blue-700" :
          display === "אורגני" ? "bg-green-100 text-green-700" :
          display === "הפניה" ? "bg-amber-100 text-amber-700" :
          "bg-secondary text-secondary-foreground"
        )}>{display}</span>
      ) : href && hasValue ? (
        <a href={href} target="_blank" rel="noopener" className="font-medium text-primary hover:underline truncate max-w-[160px]" dir={dir}>{display}</a>
      ) : (
        <span className={cn("font-medium truncate max-w-[160px]", hasValue ? "text-foreground" : "text-muted-foreground/40")} dir={dir}>{display}</span>
      )}
    </div>
  );
}

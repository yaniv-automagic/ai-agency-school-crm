import { useParams, useNavigate } from "react-router-dom";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ArrowRight, Mail, Phone, MessageCircle, MapPin, Edit, Trash2, Video, Calendar, UserCircle, Kanban, FileSignature, Send, Hash, Link } from "lucide-react";
import { useContact, useDeleteContact, useUpdateContact } from "@/hooks/useContacts";
import { useActivities, useCreateActivity } from "@/hooks/useActivities";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useDeals, useCreateDeal, usePipelines } from "@/hooks/useDeals";
import { useEnrollments, useCreateEnrollment, useUpdateEnrollment } from "@/hooks/useEnrollments";
import type { Product } from "@/types/crm";
import { useTasks, useCreateTask } from "@/hooks/useTasks";
import { useMeetings, useCreateMeeting } from "@/hooks/useMeetings";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/contexts/AuthContext";
import { CONTACT_SOURCES, MEETING_TYPES, MEETING_STATUSES } from "@/lib/constants";
import { cn, formatPhone, formatDateTime, formatCurrency } from "@/lib/utils";
import { useState } from "react";
import ContactForm from "@/components/contacts/ContactForm";
import DealForm from "@/components/deals/DealForm";
import WhatsAppChat from "@/components/whatsapp/WhatsAppChat";
import ActivityTimeline from "@/components/contacts/ActivityTimeline";
import { useContractTemplates, useCreateContract, useSendContract } from "@/hooks/useContracts";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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
  const { teamMember } = useAuth();
  const deleteContact = useDeleteContact();
  const confirm = useConfirm();
  const updateContact = useUpdateContact();
  const createActivity = useCreateActivity();
  const createTask = useCreateTask();
  const createMeeting = useCreateMeeting();
  const { data: contractTemplates } = useContractTemplates();
  const createContract = useCreateContract();
  const sendContract = useSendContract();
  const createDeal = useCreateDeal();
  const { data: enrollments } = useEnrollments({ contact_id: id });
  const createEnrollment = useCreateEnrollment();
  const updateEnrollment = useUpdateEnrollment();
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_products").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

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
  const [showPipelinePicker, setShowPipelinePicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [contractVariables, setContractVariables] = useState<Record<string, string>>({});
  const [selectedDealId, setSelectedDealId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [showCommunityInput, setShowCommunityInput] = useState(false);
  const [communityName, setCommunityName] = useState("");
  const [showFollowupPopup, setShowFollowupPopup] = useState(false);
  const [showLossPopup, setShowLossPopup] = useState(false);
  const [showClosedDealPopup, setShowClosedDealPopup] = useState(false);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [isVirtual, setIsVirtual] = useState(false);
  const [linkMode, setLinkMode] = useState<"auto" | "manual">("auto");
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
      performed_by: teamMember?.id || null,
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
    let meetingUrl: string | undefined = undefined;
    if (isVirtual) {
      meetingUrl = linkMode === "manual" ? (meetingData.meeting_url || undefined) : "auto_generate";
    }
    await createMeeting.mutateAsync({
      contact_id: contact.id,
      title: meetingData.title || `פגישה עם ${contact.first_name} ${contact.last_name}`,
      meeting_type: meetingData.meeting_type as any,
      scheduled_at: meetingData.scheduled_at,
      duration_minutes: meetingData.duration_minutes,
      description: meetingData.description || undefined,
      meeting_url: meetingUrl,
      status: "scheduled",
      _tenantId: teamMember?.tenant_id,
    } as any);
    setShowMeetingForm(false);
    setIsVirtual(false);
    setLinkMode("auto");
    setMeetingData({ title: "", meeting_type: "sales_consultation", scheduled_at: "", duration_minutes: 30, description: "", meeting_url: "" });
  };

  // Parse {{variable}} placeholders from template content
  const parseTemplateVariables = (html: string): string[] => {
    const matches = html.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    const unique = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "").trim()))];
    return unique;
  };

  // Hebrew labels for template variable keys
  const VARIABLE_LABELS: Record<string, string> = {
    firstName: "שם פרטי", lastName: "שם משפחה", fullName: "שם מלא",
    email: "אימייל", phone: "טלפון", idNumber: "תעודת זהות",
    address: "כתובת", city: "עיר", company: "חברה", jobTitle: "תפקיד",
    dealTitle: "שם העסקה", dealValue: "סכום העסקה", dealCurrency: "מטבע",
    productName: "שם המוצר", productPrice: "מחיר המוצר",
    todayDate: "תאריך היום", todayDateHebrew: "תאריך עברי", todayDay: "יום בשבוע",
    contractDate: "תאריך החוזה", expiryDate: "תאריך תפוגה",
    companyName: "שם החברה", companyAddress: "כתובת החברה",
    companyPhone: "טלפון החברה", companyEmail: "אימייל החברה", companyId: "ח.פ / ע.מ",
    contractNumber: "מספר חוזה", contractTitle: "כותרת החוזה",
    paymentTerms: "תנאי תשלום", numberOfPayments: "מספר תשלומים",
    // Hebrew key variants
    "שם_מלא": "שם מלא", "שם_פרטי": "שם פרטי", "שם_משפחה": "שם משפחה",
    "אימייל": "אימייל", "טלפון": "טלפון", "תעודת_זהות": "תעודת זהות",
    "כתובת": "כתובת", "עיר": "עיר", "חברה": "חברה", "תאריך": "תאריך",
  };

  // Variables that are auto-filled and should NOT show as editable fields
  const AUTO_FILL_KEYS = new Set([
    "firstName", "lastName", "fullName", "email", "phone", "company", "city", "jobTitle",
    "todayDate", "todayDateHebrew", "todayDay", "contractDate",
    "contractTitle", "contractNumber",
    "dealTitle", "dealValue", "dealCurrency",
    "productName", "productPrice",
    "first_name", "last_name", "full_name", "date",
    "שם_מלא", "שם_פרטי", "שם_משפחה", "אימייל", "טלפון", "חברה", "עיר", "תאריך",
  ]);

  // Keys that trigger deal/product dropdowns instead of text inputs
  const DEAL_KEYS = new Set(["dealTitle", "dealValue", "dealCurrency"]);
  const PRODUCT_KEYS = new Set(["productName", "productPrice"]);

  // Auto-fill variables from contact/deal/product data
  const autoFillVariables = (vars: string[], dealId?: string, productId?: string): Record<string, string> => {
    const map: Record<string, string> = {};
    const contactFullName = `${contact.first_name} ${contact.last_name}`.trim();
    const today = new Date().toLocaleDateString("he-IL");
    const dayName = new Date().toLocaleDateString("he-IL", { weekday: "long" });

    const deal = dealId ? deals?.find(d => d.id === dealId) : deals?.[0];
    const product = productId
      ? products?.find(p => p.id === productId)
      : deal?.product_id
        ? products?.find(p => p.id === deal.product_id)
        : undefined;

    const autoMap: Record<string, string> = {
      firstName: contact.first_name || "",
      lastName: contact.last_name || "",
      fullName: contactFullName,
      email: contact.email || "",
      phone: contact.phone || "",
      idNumber: contact.id_number || "",
      address: contact.address || "",
      city: contact.city || "",
      company: contact.company || "",
      jobTitle: contact.job_title || "",
      todayDate: today,
      todayDateHebrew: today,
      todayDay: dayName,
      contractDate: today,
      contractTitle: "",
      contractNumber: "",
      dealTitle: deal?.title || "",
      dealValue: deal?.value ? new Intl.NumberFormat("he-IL").format(deal.value) : "",
      dealCurrency: deal?.currency || "ILS",
      productName: product?.name || "",
      productPrice: product?.price ? new Intl.NumberFormat("he-IL").format(product.price) : "",
      "שם_מלא": contactFullName,
      "שם_פרטי": contact.first_name || "",
      "שם_משפחה": contact.last_name || "",
      "אימייל": contact.email || "",
      "טלפון": contact.phone || "",
      "תעודת_זהות": contact.id_number || "",
      "כתובת": contact.address || contact.city || "",
      "תאריך": today,
      full_name: contactFullName,
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      date: today,
    };

    for (const v of vars) {
      map[v] = autoMap[v] ?? "";
    }
    return map;
  };

  const handleDealSelect = (dealId: string) => {
    setSelectedDealId(dealId);
    const deal = deals?.find(d => d.id === dealId);
    // Auto-select product from deal if available
    const prodId = deal?.product_id || selectedProductId;
    if (deal?.product_id) setSelectedProductId(deal.product_id);
    // Re-fill variables with this deal/product
    if (selectedTemplateId) {
      const template = contractTemplates?.find(t => t.id === selectedTemplateId);
      if (template) {
        const vars = parseTemplateVariables(template.body_html);
        setContractVariables(prev => ({ ...prev, ...autoFillVariables(vars, dealId, prodId) }));
      }
    }
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    if (selectedTemplateId) {
      const template = contractTemplates?.find(t => t.id === selectedTemplateId);
      if (template) {
        const vars = parseTemplateVariables(template.body_html);
        setContractVariables(prev => ({ ...prev, ...autoFillVariables(vars, selectedDealId, productId) }));
      }
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSelectedDealId("");
    setSelectedProductId("");
    const template = contractTemplates?.find(t => t.id === templateId);
    if (template) {
      const vars = parseTemplateVariables(template.body_html);
      setContractVariables(autoFillVariables(vars));
    } else {
      setContractVariables({});
    }
  };

  // Check which variables are still empty
  const emptyVariables = Object.entries(contractVariables).filter(([, value]) => !value.trim());
  const allVariablesFilled = selectedTemplateId ? emptyVariables.length === 0 : false;

  const handleSendContract = async (e: React.FormEvent) => {
    e.preventDefault();
    const template = contractTemplates?.find(t => t.id === selectedTemplateId);
    if (!template) return;

    // Validate all variables are filled
    if (emptyVariables.length > 0) {
      const labels = emptyVariables
        .map(([key]) => VARIABLE_LABELS[key] || key)
        .join(", ");
      toast.error(`יש למלא את כל המשתנים: ${labels}`);
      return;
    }

    // Replace all variables in template body
    let body = template.body_html;
    for (const [key, value] of Object.entries(contractVariables)) {
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    const title = `${template.name} - ${contact.first_name} ${contact.last_name}`;

    // 1. Create contract as draft
    const result = await createContract.mutateAsync({
      contact_id: contact.id,
      deal_id: selectedDealId || deals?.[0]?.id || null,
      template_id: template.id,
      title,
      body_html: body,
      status: "draft",
    } as any);

    // 2. Call backend to generate PDF, send branded email with signing link
    await sendContract.mutateAsync({
      id: result.id,
      email_subject: `${title} — לחתימתך`,
    });

    setShowContractForm(false);
    setSelectedTemplateId("");
    setContractVariables({});
    setSelectedDealId("");
    setSelectedProductId("");
    navigate(`/contracts/${result.id}`);
  };

  // ── "נסגר" (closed/won) stage handler ──
  const handleClosedStage = async (stageId: string) => {
    // 1. Check for signed contract
    const { data: signedContracts } = await supabase
      .from("crm_contracts")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("status", "signed")
      .limit(1);

    if (!signedContracts || signedContracts.length === 0) {
      const proceed = await confirm({
        title: "אין הסכם חתום",
        description: "לא נמצא הסכם חתום עבור לקוח זה. להמשיך בכל זאת?",
        confirmText: "המשך",
        cancelText: "ביטול",
      });
      if (!proceed) {
        setPendingStageId(null);
        return;
      }
    }

    // 2. Check for deals
    if (!deals || deals.length === 0) {
      // Show deal creation popup
      setShowClosedDealPopup(true);
      return; // The popup's onConfirm will call finishClosedStage
    }

    // Already has deals — proceed
    await finishClosedStage(stageId);
  };

  const finishClosedStage = async (stageId: string) => {
    // 3. Update stage
    await updateContact.mutateAsync({ id: contact.id, stage_id: stageId } as any);

    // 4. Create/update enrollment — re-fetch latest data to include deals just created
    const { data: latestDeals } = await supabase
      .from("crm_deals")
      .select("id, product_id")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false });

    const { data: latestEnrollments } = await supabase
      .from("crm_program_enrollments")
      .select("id, status, start_date")
      .eq("contact_id", contact.id)
      .limit(1);

    const existingEnrollment = latestEnrollments && latestEnrollments.length > 0 ? latestEnrollments[0] : null;
    if (existingEnrollment) {
      await updateEnrollment.mutateAsync({
        id: existingEnrollment.id,
        status: "active",
        start_date: existingEnrollment.start_date || new Date().toISOString().split("T")[0],
      });
    } else {
      // Find product from deal
      const dealWithProduct = (latestDeals || []).find(d => d.product_id);
      if (dealWithProduct?.product_id) {
        await createEnrollment.mutateAsync({
          contact_id: contact.id,
          deal_id: dealWithProduct.id,
          product_id: dealWithProduct.product_id,
          status: "active",
          start_date: new Date().toISOString().split("T")[0],
          total_sessions: 0,
          completed_sessions: 0,
          portal_access_granted: false,
        } as any);
      }
    }

    // 5. Create timeline activity
    await createActivity.mutateAsync({
      contact_id: contact.id,
      type: "stage_change",
      subject: "שינוי שלב — נסגר",
      body: "העסקה נסגרה בהצלחה",
      performed_by: teamMember?.id || null,
    });

    // 6. Success toast
    toast.success("העסקה נסגרה בהצלחה! הרשמה לתכנית נוצרה.");
    setPendingStageId(null);
  };

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
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {/* Source badge */}
              {source && (
                <span className="inline-flex items-center py-0.5 px-2.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                  {source.label}
                </span>
              )}

              {/* Pipeline picker */}
              <div className="relative flex">
                <button
                  onClick={() => setShowPipelinePicker(!showPipelinePicker)}
                  className="inline-flex items-center py-0.5 px-2.5 rounded-full text-xs font-medium gap-1.5 bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors cursor-pointer"
                >
                  {contactPipeline?.name || "ללא צנרת"}
                </button>
                {showPipelinePicker && (
                  <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl shadow-xl py-1 w-44 z-50" dir="rtl">
                    {pipelines?.map(p => (
                      <button key={p.id}
                        onClick={() => {
                          const firstStage = p.stages?.[0];
                          if (firstStage) updateContact.mutate({ id: contact.id, stage_id: firstStage.id } as any);
                          setShowPipelinePicker(false);
                        }}
                        className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-right",
                          contactPipeline?.id === p.id && "bg-violet-50 font-medium")}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status/Stage picker - only current pipeline stages */}
              <div className="relative flex">
                <button
                  onClick={() => setShowStatusPicker(!showStatusPicker)}
                  className="inline-flex items-center py-0.5 px-2.5 rounded-full text-xs font-medium text-white hover:opacity-80 transition-colors cursor-pointer"
                  style={{ backgroundColor: stage?.color || "#6b7280" }}
                >
                  {stage?.name || "ללא שלב"}
                </button>
                {showStatusPicker && (
                  <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl shadow-xl py-1 w-44 z-50 max-h-72 overflow-y-auto" dir="rtl">
                    {(contactPipeline?.stages || []).map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          const stageName = s.name.toLowerCase();
                          if (stageName.includes("פולואפ") || stageName.includes("follow")) {
                            setPendingStageId(s.id);
                            setShowFollowupPopup(true);
                          } else if (stageName.includes("לא נסגר") || stageName.includes("לא רלוונטי")) {
                            setPendingStageId(s.id);
                            setShowLossPopup(true);
                          } else if (stageName.includes("נסגר") && !stageName.includes("לא נסגר")) {
                            setPendingStageId(s.id);
                            handleClosedStage(s.id);
                          } else {
                            updateContact.mutate({ id: contact.id, stage_id: s.id } as any);
                          }
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
                )}
              </div>

              {/* Assignee picker */}
              <div className="relative flex">
                <button
                  onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                  className="inline-flex items-center py-0.5 px-2.5 rounded-full text-xs font-medium gap-1 bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
                >
                  {contact.assigned_member ? (
                    <>
                      {contact.assigned_member.avatar_url ? (
                        <img src={contact.assigned_member.avatar_url} alt="" className="w-[14px] h-[14px] rounded-full object-cover" />
                      ) : (
                        <span className="w-[14px] h-[14px] rounded-full bg-primary/20 inline-flex items-center justify-center text-[6px] font-bold text-primary leading-none">{contact.assigned_member.display_name?.charAt(0)}</span>
                      )}
                      {contact.assigned_member.display_name}
                    </>
                  ) : "לא משויך"}
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

              {/* Marketing consent badge */}
              <button onClick={() => updateContact.mutate({ id: contact.id, marketing_consent: !contact.marketing_consent, marketing_consent_at: !contact.marketing_consent ? new Date().toISOString() : null } as any)}
                className={cn("inline-flex items-center py-0.5 px-2.5 rounded-full text-xs font-medium transition-colors",
                  contact.marketing_consent ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-600 hover:bg-red-200")}>
                {contact.marketing_consent ? "✓ אישר דיוור" : "✕ לא אישר דיוור"}
              </button>
            </div>
          </div>

        <div className="flex items-center gap-2">
          {contact.phone && (
            <button onClick={() => setShowWhatsApp(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
              <MessageCircle size={14} /> WhatsApp
            </button>
          )}
          <button onClick={() => setShowContractForm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <FileSignature size={14} /> הסכם
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

          {/* Lead Tracking */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">מעקב ליד</h3>

            {/* Webinar fields - only for webinar pipeline */}
            {contactPipeline?.name?.includes("וובינר") && (
              <>
                <InlineField label="נרשם לוובינר" value={contact.webinar_registered} icon={<Calendar size={13} />}
                  onSave={v => updateContact.mutate({ id: contact.id, webinar_registered: v || null } as any)} />
                <InlineField label="נכח בוובינר" value={contact.webinar_attended} icon={<Video size={13} />}
                  onSave={v => updateContact.mutate({ id: contact.id, webinar_attended: v || null } as any)} />
              </>
            )}

            {/* Meeting date */}
            {upcomingMeetings.length > 0 && (
              <div className="flex items-center gap-2 text-xs py-0.5">
                <Calendar size={13} className="text-blue-500 shrink-0" />
                <span className="font-medium text-foreground">{formatDateTime(upcomingMeetings[0].scheduled_at)}</span>
              </div>
            )}

            {/* Checkboxes */}
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 text-xs cursor-pointer group">
                <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                  contact.sales_call_completed ? "bg-primary border-primary" : "border-muted-foreground/30 group-hover:border-primary/50")}>
                  {contact.sales_call_completed && <span className="text-primary-foreground text-[10px]">✓</span>}
                </div>
                <input type="checkbox" checked={!!contact.sales_call_completed} className="sr-only"
                  onChange={e => updateContact.mutate({ id: contact.id, sales_call_completed: e.target.checked } as any)} />
                <span className={contact.sales_call_completed ? "font-medium text-foreground" : "text-muted-foreground"}>שיחה קצה לקצה</span>
              </label>

            </div>

            {/* Community groups */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">קבוצות WhatsApp</span>
                {!(contact.community_groups?.length > 0) && (
                  <button onClick={async () => {
                    const ok = await confirm({ title: "הוספה לקבוצות", description: `להוסיף את ${contact.first_name} ${contact.last_name} לקבוצות הקהילה?`, confirmText: "הוסף", cancelText: "ביטול" });
                    if (ok) {
                      updateContact.mutate({ id: contact.id, community_groups: ["קהילה"] } as any);
                      toast.success("הליד נוסף לקבוצות");
                    }
                  }}
                    className="px-2.5 py-1 text-[10px] font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
                    + הוספה לקבוצות
                  </button>
                )}
              </div>
              {contact.community_groups?.length > 0 ? (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-medium inline-block">צורף לקבוצות</span>
              ) : (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 font-medium inline-block">לא צורף לקבוצות</span>
              )}
            </div>
          </div>

          {/* Meetings */}
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
            {meetings && meetings.length > 0 ? (
              <div className="space-y-2">
                {meetings.slice(0, 5).map(meeting => {
                  const statusDef = MEETING_STATUSES.find(s => s.value === meeting.status);
                  return (
                    <div
                      key={meeting.id}
                      onClick={() => navigate(`/meetings/${meeting.id}`)}
                      className="p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{meeting.title}</p>
                        {statusDef && (
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0", statusDef.color)}>
                            {statusDef.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar size={12} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(meeting.scheduled_at).toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">אין פגישות</p>
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
            <MarketingRow label="utm_source" value={contact.utm_source} dir="ltr" />
            <MarketingRow label="utm_medium" value={contact.utm_medium} dir="ltr" />
            <MarketingRow label="utm_campaign" value={contact.utm_campaign} dir="ltr" />
            {matchedAdCampaign && (
              <MarketingRow label="שם מודעה" value={matchedAdCampaign.name} />
            )}
            {contact.ad_campaign_id && !matchedAdCampaign && (
              <MarketingRow label="מזהה מודעה" value={contact.ad_campaign_id} dir="ltr" />
            )}
            {contact.utm_content && <MarketingRow label="utm_content" value={contact.utm_content} dir="ltr" />}
            {contact.utm_term && <MarketingRow label="utm_term" value={contact.utm_term} dir="ltr" />}
            <MarketingRow label="סוג כניסה" value={contact.entry_type || "—"} />
            <MarketingRow label="דף נחיתה" value={contact.landing_page_url?.replace("https://aiagencyschool.co.il", "") || "—"}
              href={contact.landing_page_url || undefined} dir="ltr" />
            <MarketingRow label="מגע ראשון" value={contact.first_touch_at ? formatDateTime(contact.first_touch_at) : "—"} />
            <MarketingRow label="המרה אחרונה" value={contact.conversion_at ? formatDateTime(contact.conversion_at) : "—"} />
          </div>
        </div>
      </div>


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
            className="fixed top-[10%] left-1/2 -translate-x-1/2 w-full max-w-lg bg-card rounded-2xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileSignature size={20} />
                שליחת הסכם
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                ל{contact.first_name} {contact.last_name}
              </p>
            </div>
            <form onSubmit={handleSendContract} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-sm font-medium mb-1 block">תבנית הסכם *</label>
                <Select value={selectedTemplateId || undefined} onValueChange={handleTemplateSelect}>
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

              {/* Deal & Product selectors - show when template has deal/product variables */}
              {selectedTemplateId && Object.keys(contractVariables).some(k => DEAL_KEYS.has(k)) && deals && deals.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block text-right">בחירת עסקה</label>
                  <Select value={selectedDealId || undefined} onValueChange={handleDealSelect} dir="rtl">
                    <SelectTrigger className="w-full text-sm text-right">
                      <SelectValue placeholder="בחר עסקה..." />
                    </SelectTrigger>
                    <SelectContent>
                      {deals.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.title} - {new Intl.NumberFormat("he-IL", { style: "currency", currency: d.currency || "ILS", minimumFractionDigits: 0 }).format(d.value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedTemplateId && Object.keys(contractVariables).some(k => PRODUCT_KEYS.has(k)) && products && products.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block text-right">בחירת מוצר</label>
                  <Select value={selectedProductId || undefined} onValueChange={handleProductSelect} dir="rtl">
                    <SelectTrigger className="w-full text-sm text-right">
                      <SelectValue placeholder="בחר מוצר..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - {new Intl.NumberFormat("he-IL", { style: "currency", currency: p.currency || "ILS", minimumFractionDigits: 0 }).format(p.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Variable filling section */}
              {selectedTemplateId && Object.keys(contractVariables).length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium block border-b border-border pb-1 text-right">משתני ההסכם</label>
                  {Object.entries(contractVariables)
                    .filter(([key]) => !DEAL_KEYS.has(key) && !PRODUCT_KEYS.has(key))
                    .map(([key, value]) => (
                      <div key={key}>
                        <label className={cn("text-xs mb-1 block text-right", !value.trim() ? "text-red-500 font-medium" : "text-muted-foreground")}>
                          {VARIABLE_LABELS[key] || key.replace(/_/g, " ")} {!value.trim() && "*"}
                        </label>
                        <input
                          value={value}
                          onChange={e => setContractVariables(prev => ({ ...prev, [key]: e.target.value }))}
                          className={cn(
                            "w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-right",
                            !value.trim() ? "border-red-300 bg-red-50/50" : "border-input"
                          )}
                          dir="rtl"
                        />
                      </div>
                    ))}
                </div>
              )}

              {contact.email && (
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Send size={14} />
                  לינק לחתימה יישלח ל: <span className="font-medium text-foreground" dir="ltr">{contact.email}</span>
                </div>
              )}

              {selectedTemplateId && emptyVariables.length > 0 && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full" />
                  {emptyVariables.length} {emptyVariables.length === 1 ? "משתנה ריק" : "משתנים ריקים"} — יש למלא את כל השדות לפני שליחה
                </p>
              )}

              {(createContract.isPending || sendContract.isPending) && (
                <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-primary">
                      {createContract.isPending ? "יוצר הסכם..." : "מייצר PDF ושולח מייל עם לינק חתימה..."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">זה עלול לקחת מספר שניות</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createContract.isPending || sendContract.isPending || !selectedTemplateId || !allVariablesFilled}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  {(createContract.isPending || sendContract.isPending) ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      שולח...
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      צור ושלח הסכם
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={createContract.isPending || sendContract.isPending}
                  onClick={() => { setShowContractForm(false); setSelectedTemplateId(""); setContractVariables({}); setSelectedDealId(""); setSelectedProductId(""); }}
                  className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary disabled:opacity-50"
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">פגישה וירטואלית</label>
                  <Switch
                    checked={isVirtual}
                    onCheckedChange={(checked) => {
                      setIsVirtual(checked);
                      if (!checked) setMeetingData(d => ({ ...d, meeting_url: "" }));
                    }}
                  />
                </div>
                {isVirtual && (
                  <div className="space-y-3 pr-1">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="contactLinkMode"
                          checked={linkMode === "auto"}
                          onChange={() => {
                            setLinkMode("auto");
                            setMeetingData(d => ({ ...d, meeting_url: "" }));
                          }}
                          className="accent-primary h-4 w-4"
                        />
                        צור לינק אוטומטי
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="contactLinkMode"
                          checked={linkMode === "manual"}
                          onChange={() => setLinkMode("manual")}
                          className="accent-primary h-4 w-4"
                        />
                        לינק ידני
                      </label>
                    </div>
                    {linkMode === "manual" && (
                      <div className="flex items-center gap-2">
                        <Link size={16} className="text-muted-foreground shrink-0" />
                        <input
                          value={meetingData.meeting_url}
                          onChange={e => setMeetingData(d => ({ ...d, meeting_url: e.target.value }))}
                          placeholder="https://zoom.us/j/..."
                          className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          dir="ltr"
                        />
                      </div>
                    )}
                  </div>
                )}
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

      {/* Follow-up popup */}
      {showFollowupPopup && pendingStageId && (
        <FollowupPopup
          contact={contact}
          stageId={pendingStageId}
          onConfirm={async (dateTime, notes) => {
            await updateContact.mutateAsync({ id: contact.id, stage_id: pendingStageId } as any);
            await createActivity.mutateAsync({ contact_id: contact.id, type: "stage_change", subject: "שינוי שלב — פולואפ", body: notes ? `מועד פולואפ: ${formatDateTime(dateTime)}\n${notes}` : `מועד פולואפ: ${formatDateTime(dateTime)}`, performed_by: teamMember?.id || null });
            await createTask.mutateAsync({ title: `פולואפ — ${contact.first_name} ${contact.last_name}`, contact_id: contact.id, type: "follow_up", priority: "high", status: "pending", due_date: dateTime, assigned_to: contact.assigned_to || null } as any);
            toast.success("פולואפ נקבע ומשימה נוצרה");
            setShowFollowupPopup(false); setPendingStageId(null);
          }}
          onCancel={() => { setShowFollowupPopup(false); setPendingStageId(null); }}
        />
      )}

      {/* Loss reason popup */}
      {showLossPopup && pendingStageId && (
        <LossReasonPopup
          contact={contact}
          stageName={allStages.find(s => s.id === pendingStageId)?.name || ""}
          onConfirm={async (reason, disqualification, notes) => {
            await updateContact.mutateAsync({ id: contact.id, stage_id: pendingStageId, loss_reason: reason, disqualification_reason: disqualification || null, loss_notes: notes || null } as any);
            const body = [`סיבה: ${reason}`, disqualification && `סיבת פסילה: ${disqualification}`, notes && `הערות: ${notes}`].filter(Boolean).join("\n");
            await createActivity.mutateAsync({ contact_id: contact.id, type: "stage_change", subject: `שינוי שלב — ${allStages.find(s => s.id === pendingStageId)?.name}`, body, performed_by: teamMember?.id || null });
            setShowLossPopup(false); setPendingStageId(null);
          }}
          onCancel={() => { setShowLossPopup(false); setPendingStageId(null); }}
        />
      )}

      {/* Closed/won deal popup */}
      {showClosedDealPopup && pendingStageId && (
        <ClosedDealPopup
          contact={contact}
          products={products || []}
          onConfirm={async (dealData) => {
            // Find first pipeline + first stage for the deal
            const defaultPipeline = pipelines?.[0];
            const defaultDealStage = defaultPipeline?.stages?.[0];
            await createDeal.mutateAsync({
              contact_id: contact.id,
              title: dealData.title,
              value: dealData.amount,
              product_id: dealData.product_id || null,
              notes: dealData.notes || null,
              pipeline_id: defaultPipeline?.id || "",
              stage_id: defaultDealStage?.id || "",
              status: "won",
              currency: "ILS",
              actual_close: new Date().toISOString(),
            } as any);
            setShowClosedDealPopup(false);
            await finishClosedStage(pendingStageId);
          }}
          onCancel={() => { setShowClosedDealPopup(false); setPendingStageId(null); }}
        />
      )}
    </div>
  );
}

// ── Closed Deal Popup ──
function ClosedDealPopup({ contact, products, onConfirm, onCancel }: {
  contact: { first_name: string; last_name: string };
  products: Product[];
  onConfirm: (data: { title: string; amount: number; product_id: string; notes: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: `עסקה — ${contact.first_name} ${contact.last_name}`,
    amount: "",
    product_id: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.amount) return;
    setSubmitting(true);
    await onConfirm({
      title: form.title,
      amount: Number(form.amount),
      product_id: form.product_id,
      notes: form.notes,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold">יצירת עסקה</h2>
          <p className="text-sm text-muted-foreground mt-1">לא נמצאה עסקה עבור {contact.first_name} {contact.last_name}. יש ליצור עסקה לפני סגירה.</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">שם העסקה *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">סכום *</label>
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0" dir="ltr"
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">מוצר</label>
            <Select value={form.product_id || "__none__"} onValueChange={v => {
              const pid = v === "__none__" ? "" : v;
              const product = products.find(p => p.id === pid);
              setForm(f => ({
                ...f,
                product_id: pid,
                ...(product ? { amount: String(product.price), title: `${product.name} — ${contact.first_name} ${contact.last_name}` } : {}),
              }));
            }}>
              <SelectTrigger className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background">
                <SelectValue placeholder="בחר מוצר" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא מוצר</SelectItem>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">הערות</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="הערות לעסקה..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} disabled={!form.amount || submitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {submitting ? "שומר..." : "צור עסקה וסגור"}
            </button>
            <button onClick={onCancel} className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary">ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Follow-up Popup ──
const FOLLOWUP_INITIAL = { dateTime: "", notes: "" };

function FollowupPopup({ contact, stageId, onConfirm, onCancel }: {
  contact: Contact; stageId: string;
  onConfirm: (dateTime: string, notes: string) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState(FOLLOWUP_INITIAL);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold">קביעת פולואפ</h2>
          <p className="text-sm text-muted-foreground mt-1">{contact.first_name} {contact.last_name}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">מועד פולואפ *</label>
            <DateTimePicker value={form.dateTime} onChange={v => setForm(f => ({ ...f, dateTime: v }))} placeholder="בחר תאריך ושעה" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">הערות</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="הערות לפולואפ..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { if (form.dateTime) onConfirm(new Date(form.dateTime).toISOString(), form.notes); }} disabled={!form.dateTime}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">קבע פולואפ</button>
            <button onClick={onCancel} className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary">ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Loss Reason Popup ──
const LOSS_REASONS = [
  "לא עלה לפגישה", "חרגול שבור", "מחיר גבוה ביחס לתקציב",
  "בחר להתקדם עם מתחרה", "רוצה לנסות קודם לבד", "התכנית פחות מתאימה",
  "לא מרגיש שזה הזמן הנכון", "ספק לגבי יכולת אישית / רקע טכני",
  "חשש מהתחייבות או שינוי מקצועי", "חוסר הבנה של הערך / התמורה",
  "ממתין למימון / הכנסה עתידית", "עדיין בשלב בירור / השוואה",
  "לא מעוניין", "לא עבר את שלב הסינון לפגישת הזנקה",
  "לא תואמה פגישה - אין מענה", "אחר",
];
const DISQUALIFICATION_REASONS = [
  "לא עלה לפגישה", "חרגול שבור", "מחיר גבוה ביחס לתקציב", "בחר להתקדם עם מתחרה",
  "רוצה לנסות קודם לבד", "התכנית פחות מתאימה", "לא מרגיש שזה הזמן הנכון",
  "ספק לגבי יכולת אישית / רקע טכני", "חשש מהתחייבות או שינוי מקצועי",
  "חוסר הבנה של הערך / התמורה", "ממתין למימון / הכנסה עתידית",
  "עדיין בשלב בירור / השוואה", "לא מעוניין", "לא עבר את שלב הסינון לפגישת הזנקה",
  "לא תואמה פגישה - אין מענה", "אחר",
];

function LossReasonPopup({ contact, stageName, onConfirm, onCancel }: {
  contact: Contact; stageName: string;
  onConfirm: (reason: string, disqualification: string | null, notes: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [disqualification, setDisqualification] = useState("");
  const [notes, setNotes] = useState("");
  const isDisqualify = stageName.includes("לא רלוונטי");

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold">{stageName}</h2>
          <p className="text-sm text-muted-foreground mt-1">{contact.first_name} {contact.last_name}</p>
        </div>
        <div className="p-6 space-y-4">
          {!isDisqualify && (
            <div>
              <label className="text-sm font-medium mb-1 block">סיבה שלא נסגר *</label>
              <Select value={reason || "__none__"} onValueChange={v => setReason(v === "__none__" ? "" : v)}>
                <SelectTrigger className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background">
                  <SelectValue placeholder="בחר סיבה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">בחר סיבה</SelectItem>
                  {LOSS_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {isDisqualify && (
            <div>
              <label className="text-sm font-medium mb-1 block">סיבת פסילה *</label>
              <Select value={disqualification || "__none__"} onValueChange={v => setDisqualification(v === "__none__" ? "" : v)}>
                <SelectTrigger className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background">
                  <SelectValue placeholder="בחר סיבה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">בחר סיבה</SelectItem>
                  {DISQUALIFICATION_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1 block">הערות</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="הערות נוספות..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => {
              if (isDisqualify && !disqualification) return;
              if (!isDisqualify && !reason) return;
              onConfirm(reason || disqualification, isDisqualify ? disqualification : null, notes);
            }} disabled={isDisqualify ? !disqualification : !reason}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-destructive rounded-lg hover:bg-destructive/90 disabled:opacity-50">אישור</button>
            <button onClick={onCancel} className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary">ביטול</button>
          </div>
        </div>
      </div>
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
    <div className="flex text-xs gap-2 py-0.5">
      <span className="text-muted-foreground shrink-0 min-w-[90px]" dir="ltr">{label}</span>
      {badge && hasValue ? (
        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium",
          display === "ממומן" ? "bg-blue-100 text-blue-700" :
          display === "אורגני" ? "bg-green-100 text-green-700" :
          display === "הפניה" ? "bg-amber-100 text-amber-700" :
          "bg-secondary text-secondary-foreground"
        )}>{display}</span>
      ) : href && hasValue ? (
        <a href={href} target="_blank" rel="noopener" className="font-medium text-primary hover:underline break-all" dir={dir}>{display}</a>
      ) : (
        <span className={cn("font-medium break-all", hasValue ? "text-foreground" : "text-muted-foreground/40")} dir={dir}>{display}</span>
      )}
    </div>
  );
}

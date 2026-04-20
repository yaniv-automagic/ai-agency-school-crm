export interface Contact {
  id: string;
  tenant_id: string;
  account_id: string | null;
  portal_user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  company: string | null;
  job_title: string | null;
  source: ContactSource;
  status: ContactStatus;
  tags: string[];
  custom_fields: Record<string, any>;
  notes: string | null;
  avatar_url: string | null;
  city: string | null;
  address: string | null;
  id_number: string | null;
  assigned_to: string | null;
  last_activity_at: string | null;
  // Lead tracking
  webinar_registered: string | null;
  webinar_attended: string | null;
  sales_call_completed: boolean;
  community_groups: string[];
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  // Attribution
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  entry_type: EntryType | null;
  landing_page_url: string | null;
  referrer_url: string | null;
  ad_platform: AdPlatform | null;
  ad_campaign_id: string | null;
  ad_adset_id: string | null;
  ad_id: string | null;
  first_touch_at: string | null;
  conversion_at: string | null;
  //
  created_at: string;
  updated_at: string;
  created_by: string | null;
  stage_id: string | null;
  // Joined
  account?: Account;
  assigned_member?: TeamMember;
  stage?: PipelineStage;
}

export type EntryType = "vsl" | "webinar" | "organic" | "direct";
export type AdPlatform = "facebook" | "instagram" | "youtube" | "google" | "organic";

export type ContactStatus = string;
export type ContactSource = "website" | "whatsapp" | "referral" | "facebook_ad" | "instagram" | "google_ad" | "workshop" | "manual" | "import";

export interface Account {
  id: string;
  tenant_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  custom_fields: Record<string, any>;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Deal {
  id: string;
  tenant_id: string;
  contact_id: string;
  account_id: string | null;
  pipeline_id: string;
  stage_id: string;
  title: string;
  value: number;
  currency: string;
  expected_close: string | null;
  actual_close: string | null;
  status: DealStatus;
  loss_reason: string | null;
  product_id: string | null;
  assigned_to: string | null;
  custom_fields: Record<string, any>;
  notes: string | null;
  probability: number;
  stage_entered_at: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined
  contact?: Contact;
  stage?: PipelineStage;
  product?: Product;
  assigned_member?: TeamMember;
}

export type DealStatus = "open" | "won" | "lost";

export interface Pipeline {
  id: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
  default_stage_id: string | null;
  created_at: string;
  stages?: PipelineStage[];
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  order_index: number;
  color: string | null;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  portal_course_id: string | null;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  category: ProductCategory;
  is_active: boolean;
  duration_description: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductCategory = "course" | "workshop" | "mentoring" | "bundle";

export interface Activity {
  id: string;
  tenant_id: string;
  contact_id: string;
  deal_id: string | null;
  type: ActivityType;
  direction: "inbound" | "outbound" | null;
  subject: string | null;
  body: string | null;
  metadata: Record<string, any>;
  performed_by: string | null;
  performed_at: string;
  created_at: string;
  // Joined
  performer?: TeamMember;
}

export type ActivityType = "note" | "call" | "email" | "meeting" | "whatsapp" | "sms" | "stage_change" | "system";

export interface Task {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  deal_id: string | null;
  title: string;
  description: string | null;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  google_event_id: string | null;
  reminder_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: Contact;
  deal?: Deal;
  assigned_member?: TeamMember;
}

export type TaskType = "task" | "call" | "meeting" | "follow_up" | "email";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface TeamMember {
  id: string;
  tenant_id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone: string | null;
  role: TeamRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export type TeamRole = "owner" | "admin" | "sales" | "marketing" | "viewer";

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  type: "email" | "sms" | "whatsapp";
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  template_id: string | null;
  segment_filter: Record<string, any>;
  scheduled_at: string | null;
  sent_at: string | null;
  stats: CampaignStats;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  sent_count?: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  bounced?: number;
}

export interface MessageTemplate {
  id: string;
  tenant_id: string;
  name: string;
  channel: "email" | "sms" | "whatsapp";
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  variables: string[];
  wa_template_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Automation {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, any>;
  conditions: AutomationConditionGroup[];
  actions: AutomationAction[];
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  error_count: number;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AutomationTriggerType =
  | "record_created"
  | "record_updated"
  | "record_created_or_updated"
  | "relative_time"
  | "scheduled"
  | "webhook_received"
  | "form_submitted";

export interface AutomationConditionGroup {
  logic: "AND" | "OR";
  conditions: AutomationCondition[];
}

export interface AutomationCondition {
  field: string;
  operator: string;
  value: any;
}

export interface AutomationAction {
  type: string;
  config: Record<string, any>;
}

export interface SavedView {
  id: string;
  tenant_id: string;
  entity_type: string;
  name: string;
  filters: Record<string, any>;
  columns: string[] | null;
  sort_by: string | null;
  sort_direction: "asc" | "desc" | null;
  is_default: boolean;
  created_by: string | null;
  is_shared: boolean;
  created_at: string;
}

// ── Meetings ──

export type MeetingType = "sales_consultation" | "mentoring_1on1" | "mastermind_group" | "other";
export type MeetingStatus = "scheduled" | "confirmed" | "completed" | "no_show" | "cancelled" | "rescheduled";
export type MeetingOutcome = "won" | "lost" | "follow_up" | "no_show";

export interface Meeting {
  id: string;
  tenant_id: string;
  contact_id: string;
  deal_id: string | null;
  task_id: string | null;
  enrollment_id: string | null;
  meeting_type: MeetingType;
  status: MeetingStatus;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  recording_url: string | null;
  transcript_url: string | null;
  transcript_text: string | null;
  ai_summary: string | null;
  ai_action_items: string[];
  fireflies_meeting_id: string | null;
  outcome: MeetingOutcome | null;
  outcome_notes: string | null;
  outcome_deal_value: number | null;
  assigned_to: string | null;
  google_event_id: string | null;
  fillout_submission_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: Contact;
  deal?: Deal;
}

// ── Program Enrollment ──

export type EnrollmentStatus = "pending" | "active" | "completed" | "paused" | "cancelled";
export type SessionType = "personal" | "mastermind" | "course_access";
export type SessionStatus = "planned" | "scheduled" | "completed" | "missed" | "cancelled";

export interface ProgramEnrollment {
  id: string;
  tenant_id: string;
  contact_id: string;
  deal_id: string | null;
  product_id: string;
  status: EnrollmentStatus;
  start_date: string | null;
  end_date: string | null;
  total_sessions: number;
  completed_sessions: number;
  portal_access_granted: boolean;
  portal_access_granted_at: string | null;
  mentor_name: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: Contact;
  product?: Product;
  sessions?: ProgramSession[];
  assigned_member?: TeamMember;
}

export interface ProgramSession {
  id: string;
  tenant_id: string;
  enrollment_id: string;
  meeting_id: string | null;
  session_number: number;
  session_type: SessionType;
  status: SessionStatus;
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  meeting?: Meeting;
}

// ── Contracts ──

export type ContractStatus = "draft" | "sent" | "viewed" | "signed" | "expired" | "cancelled";

export interface ContractTemplate {
  id: string;
  tenant_id: string;
  name: string;
  body_html: string;
  variables: string[];
  product_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  tenant_id: string;
  contact_id: string;
  deal_id: string | null;
  template_id: string | null;
  title: string;
  body_html: string;
  pdf_url: string | null;
  status: ContractStatus;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  expires_at: string | null;
  signature_data: string | null;
  signature_type: "drawn" | "typed" | null;
  signer_ip: string | null;
  signed_pdf_url: string | null;
  sign_token: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: Contact;
  deal?: Deal;
}

// ── Facebook Ads ──

export interface AdAccount {
  id: string;
  tenant_id: string;
  platform: "facebook" | "google";
  account_id: string;
  account_name: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdCampaign {
  id: string;
  tenant_id: string;
  ad_account_id: string;
  platform_campaign_id: string;
  name: string;
  status: string | null;
  objective: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  start_time: string | null;
  stop_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdDailyStat {
  id: string;
  tenant_id: string;
  ad_account_id: string;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  conversions: number;
  cpl: number | null;
  cpa: number | null;
  ctr: number | null;
  cpc: number | null;
  created_at: string;
}

// ── Fillout Integration ──

// ── RBAC Permissions ──

export type CrmEntity =
  | "contacts"
  | "deals"
  | "meetings"
  | "tasks"
  | "enrollments"
  | "contracts"
  | "campaigns"
  | "automations"
  | "products"
  | "events"
  | "finance"
  | "settings"
  | "users";

export type CrmAction = "create" | "read" | "update" | "delete";

export interface RolePermission {
  id: string;
  tenant_id: string | null;
  role: TeamRole;
  entity: CrmEntity;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
}

export type PermissionsMap = Record<CrmEntity, Record<CrmAction, boolean>>;

// ── Fillout ──

export interface FilloutFormMapping {
  id: string;
  tenant_id: string;
  fillout_form_id: string;
  name: string;
  field_mappings: Record<string, string>;
  utm_field_mappings: Record<string, string>;
  auto_create_deal: boolean;
  pipeline_id: string | null;
  stage_id: string | null;
  product_id: string | null;
  source_tag: string;
  entry_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Workshops ──

export type WorkshopStatus = "draft" | "active" | "completed" | "cancelled";

export interface Workshop {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  product_id: string | null;
  status: WorkshopStatus;
  start_date: string | null;
  end_date: string | null;
  total_sessions: number;
  max_participants: number | null;
  meeting_url: string | null;
  mentor_name: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  product?: Product;
  sessions?: WorkshopSession[];
  participants?: WorkshopParticipant[];
}

export interface WorkshopSession {
  id: string;
  tenant_id: string;
  workshop_id: string;
  session_number: number;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  meeting_url: string | null;
  recording_url: string | null;
  status: "planned" | "scheduled" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
  // Joined
  attendance?: SessionAttendance[];
}

export interface WorkshopParticipant {
  id: string;
  tenant_id: string;
  workshop_id: string;
  contact_id: string;
  enrollment_id: string | null;
  status: "active" | "completed" | "dropped" | "paused";
  joined_at: string;
  notes: string | null;
  // Joined
  contact?: Contact;
}

export interface SessionAttendance {
  id: string;
  session_id: string;
  participant_id: string;
  attended: boolean;
  notes: string | null;
}

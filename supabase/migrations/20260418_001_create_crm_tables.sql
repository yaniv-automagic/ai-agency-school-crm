-- =====================================================
-- AI Agency School CRM - Database Schema
-- All tables use "crm_" prefix in public schema
-- =====================================================

-- =====================================================
-- 1. Team Members
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner', 'admin', 'sales', 'marketing', 'viewer')),
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- =====================================================
-- 2. Accounts (Organizations)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  website text,
  industry text,
  size text,
  phone text,
  email text,
  address text,
  city text,
  notes text,
  custom_fields jsonb DEFAULT '{}',
  assigned_to uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES crm_team_members(id) ON DELETE SET NULL
);

-- =====================================================
-- 3. Contacts (People)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  account_id uuid REFERENCES crm_accounts(id) ON DELETE SET NULL,
  portal_user_id uuid,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  whatsapp_phone text,
  company text,
  job_title text,
  source text DEFAULT 'manual'
    CHECK (source IN ('website', 'whatsapp', 'referral', 'facebook_ad', 'instagram', 'google_ad', 'workshop', 'manual', 'import')),
  status text DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'student', 'alumni', 'inactive')),
  tags text[] DEFAULT '{}',
  custom_fields jsonb DEFAULT '{}',
  notes text,
  avatar_url text,
  city text,
  assigned_to uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  last_activity_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES crm_team_members(id) ON DELETE SET NULL
);

-- =====================================================
-- 4. Pipelines & Stages
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES crm_pipelines(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  order_index integer NOT NULL,
  color text DEFAULT '#6366f1',
  probability integer DEFAULT 0,
  is_won boolean DEFAULT false,
  is_lost boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 5. Products (Courses/Programs)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  portal_course_id uuid,
  name text NOT NULL,
  description text,
  price numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'ILS',
  category text DEFAULT 'course'
    CHECK (category IN ('course', 'workshop', 'mentoring', 'bundle')),
  is_active boolean DEFAULT true,
  duration_description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 6. Deals (Opportunities)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES crm_accounts(id) ON DELETE SET NULL,
  pipeline_id uuid REFERENCES crm_pipelines(id) ON DELETE CASCADE NOT NULL,
  stage_id uuid REFERENCES crm_pipeline_stages(id) ON DELETE SET NULL NOT NULL,
  title text NOT NULL,
  value numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'ILS',
  expected_close date,
  actual_close date,
  status text DEFAULT 'open'
    CHECK (status IN ('open', 'won', 'lost')),
  loss_reason text,
  product_id uuid REFERENCES crm_products(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  custom_fields jsonb DEFAULT '{}',
  notes text,
  probability integer DEFAULT 0,
  stage_entered_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES crm_team_members(id) ON DELETE SET NULL
);

-- =====================================================
-- 7. Activities
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE NOT NULL,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE SET NULL,
  type text NOT NULL
    CHECK (type IN ('note', 'call', 'email', 'meeting', 'whatsapp', 'sms', 'stage_change', 'system')),
  direction text CHECK (direction IN ('inbound', 'outbound')),
  subject text,
  body text,
  metadata jsonb DEFAULT '{}',
  performed_by uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  performed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 8. Tasks
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  type text DEFAULT 'task'
    CHECK (type IN ('task', 'call', 'meeting', 'follow_up', 'email')),
  priority text DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date timestamptz,
  completed_at timestamptz,
  assigned_to uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  created_by uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  google_event_id text,
  reminder_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 9. Email Messages
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES crm_activities(id) ON DELETE SET NULL,
  from_email text,
  to_email text,
  subject text,
  body_html text,
  body_text text,
  direction text CHECK (direction IN ('inbound', 'outbound')),
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  opened_at timestamptz,
  clicked_at timestamptz,
  external_id text,
  thread_id text,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 10. WhatsApp Messages
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES crm_activities(id) ON DELETE SET NULL,
  wa_message_id text,
  direction text CHECK (direction IN ('inbound', 'outbound')),
  message_type text DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'video', 'document', 'template', 'interactive')),
  content text,
  media_url text,
  template_name text,
  status text DEFAULT 'sent'
    CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 11. Automations
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL
    CHECK (trigger_type IN ('record_created', 'record_updated', 'record_created_or_updated', 'relative_time', 'scheduled', 'webhook_received', 'form_submitted')),
  trigger_config jsonb NOT NULL DEFAULT '{}',
  conditions jsonb DEFAULT '[]',
  actions jsonb NOT NULL DEFAULT '[]',
  is_active boolean DEFAULT true,
  run_count integer DEFAULT 0,
  last_run_at timestamptz,
  error_count integer DEFAULT 0,
  last_error text,
  created_by uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_automation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  event_type text NOT NULL,
  record_type text NOT NULL,
  record_id uuid NOT NULL,
  old_data jsonb,
  new_data jsonb,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES crm_automations(id) ON DELETE CASCADE,
  trigger_record_id uuid,
  trigger_record_type text,
  status text CHECK (status IN ('success', 'partial', 'failed', 'skipped')),
  actions_executed jsonb,
  error_message text,
  execution_time_ms integer,
  executed_at timestamptz DEFAULT now()
);

-- =====================================================
-- 12. Campaigns & Templates
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  subject text,
  body_html text,
  body_text text,
  variables text[] DEFAULT '{}',
  wa_template_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('email', 'sms', 'whatsapp')),
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  subject text,
  body_html text,
  body_text text,
  template_id uuid REFERENCES crm_message_templates(id) ON DELETE SET NULL,
  segment_filter jsonb DEFAULT '{}',
  scheduled_at timestamptz,
  sent_at timestamptz,
  stats jsonb DEFAULT '{}',
  created_by uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed')),
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  error_message text
);

-- =====================================================
-- 13. Journeys
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  description text,
  trigger_type text,
  trigger_config jsonb,
  nodes jsonb NOT NULL DEFAULT '[]',
  is_active boolean DEFAULT false,
  stats jsonb DEFAULT '{}',
  created_by uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_journey_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid REFERENCES crm_journeys(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE,
  current_node_id text,
  status text DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'exited', 'paused')),
  entered_at timestamptz DEFAULT now(),
  next_action_at timestamptz,
  completed_at timestamptz,
  history jsonb DEFAULT '[]'
);

-- =====================================================
-- 14. Forms
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  slug text UNIQUE,
  fields jsonb NOT NULL DEFAULT '[]',
  settings jsonb DEFAULT '{}',
  pipeline_id uuid REFERENCES crm_pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES crm_pipeline_stages(id) ON DELETE SET NULL,
  source_tag text,
  submission_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES crm_forms(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
  data jsonb NOT NULL,
  source_url text,
  utm_params jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 15. Integrations & Webhooks
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  slug text UNIQUE,
  secret text,
  is_active boolean DEFAULT true,
  last_received_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid REFERENCES crm_webhooks(id) ON DELETE CASCADE,
  payload jsonb,
  headers jsonb,
  status text CHECK (status IN ('processed', 'failed', 'ignored')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  provider text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

-- =====================================================
-- 16. Dashboard & Views
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  entity_type text NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  columns jsonb,
  sort_by text,
  sort_direction text CHECK (sort_direction IN ('asc', 'desc')),
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  is_shared boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  widget_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  position jsonb DEFAULT '{}',
  created_by uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone ON crm_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_source ON crm_contacts(source);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned ON crm_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created ON crm_contacts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline ON crm_deals(pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_status ON crm_deals(status);
CREATE INDEX IF NOT EXISTS idx_crm_deals_created ON crm_deals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON crm_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_date ON crm_activities(performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned ON crm_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON crm_tasks(due_date) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact ON crm_tasks(contact_id);

CREATE INDEX IF NOT EXISTS idx_crm_auto_queue_pending ON crm_automation_queue(processed, created_at) WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_crm_email_contact ON crm_email_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_whatsapp_contact ON crm_whatsapp_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_campaign_recipients_campaign ON crm_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_journey_enrollments_active ON crm_journey_enrollments(status, next_action_at) WHERE status = 'active';

-- Full text search on contacts
CREATE INDEX IF NOT EXISTS idx_crm_contacts_search ON crm_contacts USING gin(
  to_tsvector('simple', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,''))
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE crm_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_journey_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION is_crm_team_member(p_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM crm_team_members
    WHERE user_id = p_user_id AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- RLS Policies - All CRM tables accessible by team members
-- =====================================================

-- Contacts
CREATE POLICY "crm_contacts_all" ON crm_contacts FOR ALL USING (is_crm_team_member(auth.uid()));

-- Accounts
CREATE POLICY "crm_accounts_all" ON crm_accounts FOR ALL USING (is_crm_team_member(auth.uid()));

-- Deals
CREATE POLICY "crm_deals_all" ON crm_deals FOR ALL USING (is_crm_team_member(auth.uid()));

-- Activities
CREATE POLICY "crm_activities_all" ON crm_activities FOR ALL USING (is_crm_team_member(auth.uid()));

-- Tasks
CREATE POLICY "crm_tasks_all" ON crm_tasks FOR ALL USING (is_crm_team_member(auth.uid()));

-- Pipelines
CREATE POLICY "crm_pipelines_all" ON crm_pipelines FOR ALL USING (is_crm_team_member(auth.uid()));

-- Pipeline Stages - readable by all authenticated
CREATE POLICY "crm_pipeline_stages_read" ON crm_pipeline_stages FOR SELECT USING (true);
CREATE POLICY "crm_pipeline_stages_write" ON crm_pipeline_stages FOR ALL USING (is_crm_team_member(auth.uid()));

-- Products
CREATE POLICY "crm_products_all" ON crm_products FOR ALL USING (is_crm_team_member(auth.uid()));

-- Team Members
CREATE POLICY "crm_team_members_read" ON crm_team_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "crm_team_members_write" ON crm_team_members FOR ALL USING (is_crm_team_member(auth.uid()));

-- Email messages
CREATE POLICY "crm_email_messages_all" ON crm_email_messages FOR ALL USING (is_crm_team_member(auth.uid()));

-- WhatsApp messages
CREATE POLICY "crm_whatsapp_messages_all" ON crm_whatsapp_messages FOR ALL USING (is_crm_team_member(auth.uid()));

-- Automations
CREATE POLICY "crm_automations_all" ON crm_automations FOR ALL USING (is_crm_team_member(auth.uid()));

-- Automation logs
CREATE POLICY "crm_automation_logs_read" ON crm_automation_logs FOR SELECT USING (is_crm_team_member(auth.uid()));

-- Campaigns
CREATE POLICY "crm_campaigns_all" ON crm_campaigns FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_campaign_recipients_all" ON crm_campaign_recipients FOR ALL USING (is_crm_team_member(auth.uid()));

-- Message templates
CREATE POLICY "crm_message_templates_all" ON crm_message_templates FOR ALL USING (is_crm_team_member(auth.uid()));

-- Journeys
CREATE POLICY "crm_journeys_all" ON crm_journeys FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_journey_enrollments_all" ON crm_journey_enrollments FOR ALL USING (is_crm_team_member(auth.uid()));

-- Forms - submissions are public (anyone can submit)
CREATE POLICY "crm_forms_all" ON crm_forms FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_form_submissions_read" ON crm_form_submissions FOR SELECT USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_form_submissions_insert" ON crm_form_submissions FOR INSERT WITH CHECK (true);

-- Webhooks
CREATE POLICY "crm_webhooks_all" ON crm_webhooks FOR ALL USING (is_crm_team_member(auth.uid()));

-- Integration configs
CREATE POLICY "crm_integration_configs_all" ON crm_integration_configs FOR ALL USING (is_crm_team_member(auth.uid()));

-- Saved views
CREATE POLICY "crm_saved_views_all" ON crm_saved_views FOR ALL USING (is_crm_team_member(auth.uid()));

-- Dashboard widgets
CREATE POLICY "crm_dashboard_widgets_all" ON crm_dashboard_widgets FOR ALL USING (is_crm_team_member(auth.uid()));

-- =====================================================
-- SEED: Default Pipeline
-- =====================================================
DO $$
DECLARE
  pipeline_id uuid;
BEGIN
  -- Course Enrollment Pipeline
  INSERT INTO crm_pipelines (name, is_default)
  VALUES ('הרשמה לקורס', true)
  RETURNING id INTO pipeline_id;

  INSERT INTO crm_pipeline_stages (pipeline_id, name, order_index, color, probability, is_won, is_lost) VALUES
    (pipeline_id, 'ליד חדש', 0, '#3b82f6', 10, false, false),
    (pipeline_id, 'שיחה ראשונית', 1, '#f59e0b', 20, false, false),
    (pipeline_id, 'שיעור ניסיון', 2, '#f97316', 40, false, false),
    (pipeline_id, 'הצעת מחיר', 3, '#8b5cf6', 60, false, false),
    (pipeline_id, 'ממתין לתשלום', 4, '#ec4899', 80, false, false),
    (pipeline_id, 'נרשם!', 5, '#22c55e', 100, true, false),
    (pipeline_id, 'אבוד', 6, '#ef4444', 0, false, true);

  -- B2B Partnership Pipeline
  INSERT INTO crm_pipelines (name, is_default)
  VALUES ('שיתוף פעולה B2B', false)
  RETURNING id INTO pipeline_id;

  INSERT INTO crm_pipeline_stages (pipeline_id, name, order_index, color, probability, is_won, is_lost) VALUES
    (pipeline_id, 'פנייה', 0, '#3b82f6', 10, false, false),
    (pipeline_id, 'פגישה', 1, '#f59e0b', 30, false, false),
    (pipeline_id, 'הצעה', 2, '#8b5cf6', 50, false, false),
    (pipeline_id, 'משא ומתן', 3, '#ec4899', 70, false, false),
    (pipeline_id, 'סגירה', 4, '#22c55e', 100, true, false),
    (pipeline_id, 'לא רלוונטי', 5, '#ef4444', 0, false, true);
END $$;

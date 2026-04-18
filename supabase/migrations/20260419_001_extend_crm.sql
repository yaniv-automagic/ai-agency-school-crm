-- =====================================================
-- Phase 1: Attribution columns on crm_contacts
-- =====================================================

ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS entry_type text CHECK (entry_type IS NULL OR entry_type IN ('vsl', 'webinar', 'organic', 'direct')),
  ADD COLUMN IF NOT EXISTS landing_page_url text,
  ADD COLUMN IF NOT EXISTS referrer_url text,
  ADD COLUMN IF NOT EXISTS ad_platform text CHECK (ad_platform IS NULL OR ad_platform IN ('facebook', 'instagram', 'youtube', 'google', 'organic')),
  ADD COLUMN IF NOT EXISTS ad_campaign_id text,
  ADD COLUMN IF NOT EXISTS ad_adset_id text,
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS first_touch_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_utm_source ON crm_contacts(utm_source);
CREATE INDEX IF NOT EXISTS idx_contacts_utm_campaign ON crm_contacts(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_contacts_ad_platform ON crm_contacts(ad_platform);
CREATE INDEX IF NOT EXISTS idx_contacts_entry_type ON crm_contacts(entry_type);
CREATE INDEX IF NOT EXISTS idx_contacts_ad_campaign_id ON crm_contacts(ad_campaign_id);

-- =====================================================
-- Phase 2: Meetings
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE NOT NULL,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE SET NULL,
  task_id uuid REFERENCES crm_tasks(id) ON DELETE SET NULL,
  enrollment_id uuid,
  meeting_type text NOT NULL
    CHECK (meeting_type IN ('sales_consultation', 'mentoring_1on1', 'mastermind_group', 'trial_lesson')),
  status text DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'completed', 'no_show', 'cancelled', 'rescheduled')),
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  meeting_url text,
  recording_url text,
  outcome text CHECK (outcome IS NULL OR outcome IN ('won', 'lost', 'follow_up', 'no_show')),
  outcome_notes text,
  outcome_deal_value numeric(12,2),
  assigned_to uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  google_event_id text,
  fillout_submission_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_contact ON crm_meetings(contact_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON crm_meetings(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_type ON crm_meetings(meeting_type);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON crm_meetings(status);

ALTER TABLE crm_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_meetings_all" ON crm_meetings FOR ALL USING (is_crm_team_member(auth.uid()));

-- =====================================================
-- Phase 3: Program Enrollment & Sessions
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_program_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE NOT NULL,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE SET NULL,
  product_id uuid REFERENCES crm_products(id) ON DELETE SET NULL NOT NULL,
  status text DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'completed', 'paused', 'cancelled')),
  start_date date,
  end_date date,
  total_sessions integer DEFAULT 0,
  completed_sessions integer DEFAULT 0,
  portal_access_granted boolean DEFAULT false,
  portal_access_granted_at timestamptz,
  mentor_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_program_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  enrollment_id uuid REFERENCES crm_program_enrollments(id) ON DELETE CASCADE NOT NULL,
  meeting_id uuid REFERENCES crm_meetings(id) ON DELETE SET NULL,
  session_number integer NOT NULL,
  session_type text NOT NULL
    CHECK (session_type IN ('personal', 'mastermind', 'course_access')),
  status text DEFAULT 'planned'
    CHECK (status IN ('planned', 'scheduled', 'completed', 'missed', 'cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_meetings
  ADD CONSTRAINT fk_meetings_enrollment
  FOREIGN KEY (enrollment_id) REFERENCES crm_program_enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON crm_program_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_product ON crm_program_enrollments(product_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON crm_program_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sessions_enrollment ON crm_program_sessions(enrollment_id);

ALTER TABLE crm_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_program_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_enrollments_all" ON crm_program_enrollments FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_sessions_all" ON crm_program_sessions FOR ALL USING (is_crm_team_member(auth.uid()));

-- =====================================================
-- Phase 4: Digital Signatures
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  body_html text NOT NULL,
  variables text[] DEFAULT '{}',
  product_id uuid REFERENCES crm_products(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE NOT NULL,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE SET NULL,
  template_id uuid REFERENCES crm_contract_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  body_html text NOT NULL,
  pdf_url text,
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'expired', 'cancelled')),
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  expires_at timestamptz,
  signature_data text,
  signature_type text CHECK (signature_type IS NULL OR signature_type IN ('drawn', 'typed')),
  signer_ip text,
  signed_pdf_url text,
  sign_token text UNIQUE,
  created_by uuid REFERENCES crm_team_members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_contact ON crm_contracts(contact_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON crm_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_sign_token ON crm_contracts(sign_token);

ALTER TABLE crm_contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_contract_templates_all" ON crm_contract_templates FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_contracts_team" ON crm_contracts FOR ALL USING (is_crm_team_member(auth.uid()));
-- Public access for signing (by token)
CREATE POLICY "crm_contracts_sign" ON crm_contracts FOR SELECT USING (sign_token IS NOT NULL);
CREATE POLICY "crm_contracts_sign_update" ON crm_contracts FOR UPDATE USING (sign_token IS NOT NULL);

-- =====================================================
-- Phase 5: Fillout Integration
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_fillout_form_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  fillout_form_id text NOT NULL,
  name text NOT NULL,
  field_mappings jsonb NOT NULL DEFAULT '{}',
  utm_field_mappings jsonb DEFAULT '{}',
  auto_create_deal boolean DEFAULT false,
  pipeline_id uuid REFERENCES crm_pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES crm_pipeline_stages(id) ON DELETE SET NULL,
  product_id uuid REFERENCES crm_products(id) ON DELETE SET NULL,
  source_tag text DEFAULT 'website',
  entry_type text DEFAULT 'vsl',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_fillout_form_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_fillout_all" ON crm_fillout_form_mappings FOR ALL USING (is_crm_team_member(auth.uid()));

-- =====================================================
-- Phase 6: Facebook Ads
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  platform text NOT NULL DEFAULT 'facebook'
    CHECK (platform IN ('facebook', 'google')),
  account_id text NOT NULL,
  account_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  ad_account_id uuid REFERENCES crm_ad_accounts(id) ON DELETE CASCADE,
  platform_campaign_id text NOT NULL,
  name text NOT NULL,
  status text,
  objective text,
  daily_budget numeric(12,2),
  lifetime_budget numeric(12,2),
  start_time timestamptz,
  stop_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ad_account_id, platform_campaign_id)
);

CREATE TABLE IF NOT EXISTS crm_ad_adsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  campaign_id uuid REFERENCES crm_ad_campaigns(id) ON DELETE CASCADE,
  platform_adset_id text NOT NULL,
  name text NOT NULL,
  status text,
  targeting jsonb DEFAULT '{}',
  daily_budget numeric(12,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, platform_adset_id)
);

CREATE TABLE IF NOT EXISTS crm_ad_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  adset_id uuid REFERENCES crm_ad_adsets(id) ON DELETE CASCADE,
  platform_ad_id text NOT NULL,
  name text NOT NULL,
  status text,
  creative_url text,
  preview_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(adset_id, platform_ad_id)
);

CREATE TABLE IF NOT EXISTS crm_ad_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  ad_account_id uuid REFERENCES crm_ad_accounts(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES crm_ad_campaigns(id) ON DELETE SET NULL,
  adset_id uuid REFERENCES crm_ad_adsets(id) ON DELETE SET NULL,
  ad_id uuid REFERENCES crm_ad_ads(id) ON DELETE SET NULL,
  date date NOT NULL,
  spend numeric(12,2) DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  reach integer DEFAULT 0,
  leads integer DEFAULT 0,
  conversions integer DEFAULT 0,
  cpl numeric(12,2),
  cpa numeric(12,2),
  ctr numeric(8,4),
  cpc numeric(12,2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_stats_date ON crm_ad_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_stats_campaign ON crm_ad_daily_stats(campaign_id, date);

ALTER TABLE crm_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_ad_adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_ad_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_ad_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_ad_accounts_all" ON crm_ad_accounts FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_ad_campaigns_all" ON crm_ad_campaigns FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_ad_adsets_all" ON crm_ad_adsets FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_ad_ads_all" ON crm_ad_ads FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_ad_daily_stats_all" ON crm_ad_daily_stats FOR ALL USING (is_crm_team_member(auth.uid()));

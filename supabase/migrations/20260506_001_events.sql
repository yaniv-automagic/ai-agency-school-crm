-- =====================================================
-- Events (webinars, live community, workshops)
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('webinar', 'live_community', 'workshop')),
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  end_at timestamptz,
  duration_minutes integer DEFAULT 60,
  meeting_url text,
  recording_url text,
  registration_url text,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled')),
  registered_count integer DEFAULT 0,
  attended_count integer DEFAULT 0,
  leads_generated integer DEFAULT 0,
  deals_count integer DEFAULT 0,
  revenue numeric(12, 2) DEFAULT 0,
  cohort text,
  notes text,
  external_source text,
  external_id text,
  created_by uuid REFERENCES crm_team_members(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_events_scheduled_at ON crm_events(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_events_event_type ON crm_events(event_type);
CREATE INDEX IF NOT EXISTS idx_crm_events_status ON crm_events(status);
CREATE UNIQUE INDEX IF NOT EXISTS crm_events_external_uniq ON crm_events(external_source, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES crm_events(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  registered boolean DEFAULT true,
  attended boolean DEFAULT false,
  registered_at timestamptz,
  attended_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  click_id text,
  ad_name text,
  external_source text,
  external_id text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_event_registrations_event ON crm_event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_crm_event_registrations_contact ON crm_event_registrations(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_event_registrations_attended ON crm_event_registrations(attended) WHERE attended = true;

ALTER TABLE crm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_events_all" ON crm_events
  FOR ALL USING (is_crm_team_member(auth.uid()));

CREATE POLICY "crm_event_registrations_all" ON crm_event_registrations
  FOR ALL USING (is_crm_team_member(auth.uid()));

CREATE OR REPLACE FUNCTION update_crm_events_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_events_updated_at
  BEFORE UPDATE ON crm_events
  FOR EACH ROW EXECUTE FUNCTION update_crm_events_updated_at();

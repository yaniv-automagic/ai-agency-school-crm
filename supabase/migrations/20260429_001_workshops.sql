-- =====================================================
-- Workshops, Sessions & Participants
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  description text,
  product_id uuid REFERENCES crm_products(id) ON DELETE SET NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  start_date date,
  end_date date,
  total_sessions integer DEFAULT 0,
  max_participants integer,
  meeting_url text,
  mentor_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_workshop_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  workshop_id uuid REFERENCES crm_workshops(id) ON DELETE CASCADE NOT NULL,
  session_number integer NOT NULL,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz,
  duration_minutes integer DEFAULT 90,
  meeting_url text,
  recording_url text,
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'scheduled', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_workshop_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  workshop_id uuid REFERENCES crm_workshops(id) ON DELETE CASCADE NOT NULL,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE NOT NULL,
  enrollment_id uuid REFERENCES crm_program_enrollments(id) ON DELETE SET NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped', 'paused')),
  joined_at timestamptz DEFAULT now(),
  notes text,
  UNIQUE(workshop_id, contact_id)
);

CREATE TABLE IF NOT EXISTS crm_session_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES crm_workshop_sessions(id) ON DELETE CASCADE NOT NULL,
  participant_id uuid REFERENCES crm_workshop_participants(id) ON DELETE CASCADE NOT NULL,
  attended boolean DEFAULT false,
  notes text,
  UNIQUE(session_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_workshop_sessions ON crm_workshop_sessions(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_participants ON crm_workshop_participants(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_participant_contact ON crm_workshop_participants(contact_id);
CREATE INDEX IF NOT EXISTS idx_session_attendance ON crm_session_attendance(session_id);

ALTER TABLE crm_workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_workshop_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_workshop_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_session_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_workshops_all" ON crm_workshops FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_workshop_sessions_all" ON crm_workshop_sessions FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_workshop_participants_all" ON crm_workshop_participants FOR ALL USING (is_crm_team_member(auth.uid()));
CREATE POLICY "crm_session_attendance_all" ON crm_session_attendance FOR ALL USING (is_crm_team_member(auth.uid()));

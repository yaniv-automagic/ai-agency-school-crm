-- =====================================================
-- Zoom attendance: per-session join/leave records + Zoom-specific event metadata
-- =====================================================

-- 1. Zoom-specific columns on crm_events
ALTER TABLE crm_events
  ADD COLUMN IF NOT EXISTS host_email text,
  ADD COLUMN IF NOT EXISTS recording_files jsonb,        -- array of file metadata from Zoom
  ADD COLUMN IF NOT EXISTS recording_password text,
  ADD COLUMN IF NOT EXISTS external_metadata jsonb DEFAULT '{}',  -- zoom_uuid, zoom_id, host_id, etc.
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

COMMENT ON COLUMN crm_events.recording_files IS 'Array of Zoom recording file metadata: file_type, file_size, recording_type, play_url, download_url, recording_start, recording_end';
COMMENT ON COLUMN crm_events.external_metadata IS 'Provider-specific metadata. For Zoom: { zoom_uuid, zoom_id, host_id, type }';

-- 2. Per-session attendance — one row per join/leave (a participant can join+leave+rejoin)
CREATE TABLE IF NOT EXISTS crm_event_attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES crm_events(id) ON DELETE CASCADE,
  -- registration_id is null when the participant's email doesn't match a contact (unmatched attendee)
  registration_id uuid REFERENCES crm_event_registrations(id) ON DELETE CASCADE,
  participant_email text,
  participant_name text,
  participant_external_id text,        -- Zoom's user_id within the meeting
  joined_at timestamptz NOT NULL,
  left_at timestamptz NOT NULL,
  duration_seconds integer NOT NULL,
  external_source text NOT NULL DEFAULT 'zoom',
  raw jsonb,                           -- full provider participant record for debugging
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_event ON crm_event_attendance_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_registration ON crm_event_attendance_sessions(registration_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_email ON crm_event_attendance_sessions(participant_email);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_joined ON crm_event_attendance_sessions(event_id, joined_at);

-- Idempotent re-sync: prevent duplicate sessions when the same participant join is imported twice
CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_unique
  ON crm_event_attendance_sessions(event_id, participant_external_id, joined_at)
  WHERE participant_external_id IS NOT NULL;

ALTER TABLE crm_event_attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_event_attendance_sessions_all" ON crm_event_attendance_sessions
  FOR ALL USING (is_crm_team_member(auth.uid()));

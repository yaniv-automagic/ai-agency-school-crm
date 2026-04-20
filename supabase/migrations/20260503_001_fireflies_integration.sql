-- Fireflies.ai integration: add transcript fields to meetings
ALTER TABLE crm_meetings
  ADD COLUMN IF NOT EXISTS fireflies_meeting_id text,
  ADD COLUMN IF NOT EXISTS transcript_url text,
  ADD COLUMN IF NOT EXISTS transcript_text text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_action_items jsonb DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_crm_meetings_fireflies
  ON crm_meetings (fireflies_meeting_id) WHERE fireflies_meeting_id IS NOT NULL;

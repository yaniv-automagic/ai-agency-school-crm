-- Replace trial_lesson meeting type with other
ALTER TABLE crm_meetings DROP CONSTRAINT IF EXISTS crm_meetings_meeting_type_check;
ALTER TABLE crm_meetings ADD CONSTRAINT crm_meetings_meeting_type_check
  CHECK (meeting_type IN ('sales_consultation', 'mentoring_1on1', 'mastermind_group', 'other'));

-- Migrate existing trial_lesson records
UPDATE crm_meetings SET meeting_type = 'other' WHERE meeting_type = 'trial_lesson';

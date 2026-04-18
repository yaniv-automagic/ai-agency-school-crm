-- Add assigned_to column to program enrollments
ALTER TABLE crm_program_enrollments
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES crm_team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_assigned ON crm_program_enrollments(assigned_to);

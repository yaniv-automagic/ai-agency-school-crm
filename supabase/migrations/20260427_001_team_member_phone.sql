-- Add phone column to team members
ALTER TABLE crm_team_members
  ADD COLUMN IF NOT EXISTS phone text;

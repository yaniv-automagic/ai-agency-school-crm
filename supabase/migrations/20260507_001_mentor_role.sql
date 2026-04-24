-- =====================================================
-- Add "mentor" role to the RBAC system
-- =====================================================

-- Update role CHECK constraint on crm_team_members
ALTER TABLE crm_team_members DROP CONSTRAINT IF EXISTS crm_team_members_role_check;
ALTER TABLE crm_team_members ADD CONSTRAINT crm_team_members_role_check
  CHECK (role IN ('owner', 'admin', 'sales', 'marketing', 'viewer', 'mentor'));

-- Update role CHECK constraint on crm_role_permissions
ALTER TABLE crm_role_permissions DROP CONSTRAINT IF EXISTS crm_role_permissions_role_check;
ALTER TABLE crm_role_permissions ADD CONSTRAINT crm_role_permissions_role_check
  CHECK (role IN ('owner', 'admin', 'sales', 'marketing', 'viewer', 'mentor'));

-- Seed default permissions for mentor: manages their students
INSERT INTO crm_role_permissions (tenant_id, role, entity, can_create, can_read, can_update, can_delete) VALUES
  (NULL, 'mentor', 'contacts',    false, true,  true,  false),
  (NULL, 'mentor', 'deals',       false, true,  false, false),
  (NULL, 'mentor', 'meetings',    true,  true,  true,  false),
  (NULL, 'mentor', 'tasks',       true,  true,  true,  false),
  (NULL, 'mentor', 'enrollments', false, true,  true,  false),
  (NULL, 'mentor', 'contracts',   false, true,  false, false),
  (NULL, 'mentor', 'campaigns',   false, false, false, false),
  (NULL, 'mentor', 'automations', false, false, false, false),
  (NULL, 'mentor', 'products',    false, true,  false, false),
  (NULL, 'mentor', 'events',      false, true,  true,  false),
  (NULL, 'mentor', 'finance',     false, false, false, false),
  (NULL, 'mentor', 'settings',    false, false, false, false),
  (NULL, 'mentor', 'users',       false, false, false, false)
ON CONFLICT (tenant_id, role, entity) DO NOTHING;

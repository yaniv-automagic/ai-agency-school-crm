-- =====================================================
-- Role-Based Access Control (RBAC) - Permissions System
-- =====================================================

-- =====================================================
-- 1. Role Permissions Table
-- Stores CRUD permissions per role per entity
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'sales', 'marketing', 'viewer')),
  entity text NOT NULL,
  can_create boolean DEFAULT false,
  can_read boolean DEFAULT true,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, role, entity)
);

-- =====================================================
-- 2. Insert default permissions for all roles & entities
-- =====================================================

-- Helper: list of all CRM entities
-- contacts, deals, meetings, tasks, enrollments, contracts,
-- campaigns, automations, products, events, finance, settings, users

-- ── Owner: full access to everything ──
INSERT INTO crm_role_permissions (tenant_id, role, entity, can_create, can_read, can_update, can_delete) VALUES
  (NULL, 'owner', 'contacts',    true, true, true, true),
  (NULL, 'owner', 'deals',       true, true, true, true),
  (NULL, 'owner', 'meetings',    true, true, true, true),
  (NULL, 'owner', 'tasks',       true, true, true, true),
  (NULL, 'owner', 'enrollments', true, true, true, true),
  (NULL, 'owner', 'contracts',   true, true, true, true),
  (NULL, 'owner', 'campaigns',   true, true, true, true),
  (NULL, 'owner', 'automations', true, true, true, true),
  (NULL, 'owner', 'products',    true, true, true, true),
  (NULL, 'owner', 'events',      true, true, true, true),
  (NULL, 'owner', 'finance',     true, true, true, true),
  (NULL, 'owner', 'settings',    true, true, true, true),
  (NULL, 'owner', 'users',       true, true, true, true)
ON CONFLICT (tenant_id, role, entity) DO NOTHING;

-- ── Admin: full access except user deletion ──
INSERT INTO crm_role_permissions (tenant_id, role, entity, can_create, can_read, can_update, can_delete) VALUES
  (NULL, 'admin', 'contacts',    true, true, true, true),
  (NULL, 'admin', 'deals',       true, true, true, true),
  (NULL, 'admin', 'meetings',    true, true, true, true),
  (NULL, 'admin', 'tasks',       true, true, true, true),
  (NULL, 'admin', 'enrollments', true, true, true, true),
  (NULL, 'admin', 'contracts',   true, true, true, true),
  (NULL, 'admin', 'campaigns',   true, true, true, true),
  (NULL, 'admin', 'automations', true, true, true, true),
  (NULL, 'admin', 'products',    true, true, true, true),
  (NULL, 'admin', 'events',      true, true, true, true),
  (NULL, 'admin', 'finance',     true, true, true, false),
  (NULL, 'admin', 'settings',    true, true, true, false),
  (NULL, 'admin', 'users',       true, true, true, false)
ON CONFLICT (tenant_id, role, entity) DO NOTHING;

-- ── Sales: manage contacts, deals, meetings, tasks ──
INSERT INTO crm_role_permissions (tenant_id, role, entity, can_create, can_read, can_update, can_delete) VALUES
  (NULL, 'sales', 'contacts',    true,  true,  true,  false),
  (NULL, 'sales', 'deals',       true,  true,  true,  false),
  (NULL, 'sales', 'meetings',    true,  true,  true,  false),
  (NULL, 'sales', 'tasks',       true,  true,  true,  false),
  (NULL, 'sales', 'enrollments', false, true,  false, false),
  (NULL, 'sales', 'contracts',   true,  true,  true,  false),
  (NULL, 'sales', 'campaigns',   false, true,  false, false),
  (NULL, 'sales', 'automations', false, true,  false, false),
  (NULL, 'sales', 'products',    false, true,  false, false),
  (NULL, 'sales', 'events',      false, true,  false, false),
  (NULL, 'sales', 'finance',     false, true,  false, false),
  (NULL, 'sales', 'settings',    false, false, false, false),
  (NULL, 'sales', 'users',       false, false, false, false)
ON CONFLICT (tenant_id, role, entity) DO NOTHING;

-- ── Marketing: manage campaigns, automations, forms, events ──
INSERT INTO crm_role_permissions (tenant_id, role, entity, can_create, can_read, can_update, can_delete) VALUES
  (NULL, 'marketing', 'contacts',    false, true,  true,  false),
  (NULL, 'marketing', 'deals',       false, true,  false, false),
  (NULL, 'marketing', 'meetings',    false, true,  false, false),
  (NULL, 'marketing', 'tasks',       true,  true,  true,  false),
  (NULL, 'marketing', 'enrollments', false, true,  false, false),
  (NULL, 'marketing', 'contracts',   false, true,  false, false),
  (NULL, 'marketing', 'campaigns',   true,  true,  true,  true),
  (NULL, 'marketing', 'automations', true,  true,  true,  true),
  (NULL, 'marketing', 'products',    false, true,  true,  false),
  (NULL, 'marketing', 'events',      true,  true,  true,  true),
  (NULL, 'marketing', 'finance',     false, false, false, false),
  (NULL, 'marketing', 'settings',    false, false, false, false),
  (NULL, 'marketing', 'users',       false, false, false, false)
ON CONFLICT (tenant_id, role, entity) DO NOTHING;

-- ── Viewer: read-only access to most entities ──
INSERT INTO crm_role_permissions (tenant_id, role, entity, can_create, can_read, can_update, can_delete) VALUES
  (NULL, 'viewer', 'contacts',    false, true,  false, false),
  (NULL, 'viewer', 'deals',       false, true,  false, false),
  (NULL, 'viewer', 'meetings',    false, true,  false, false),
  (NULL, 'viewer', 'tasks',       false, true,  false, false),
  (NULL, 'viewer', 'enrollments', false, true,  false, false),
  (NULL, 'viewer', 'contracts',   false, true,  false, false),
  (NULL, 'viewer', 'campaigns',   false, true,  false, false),
  (NULL, 'viewer', 'automations', false, true,  false, false),
  (NULL, 'viewer', 'products',    false, true,  false, false),
  (NULL, 'viewer', 'events',      false, true,  false, false),
  (NULL, 'viewer', 'finance',     false, true,  false, false),
  (NULL, 'viewer', 'settings',    false, false, false, false),
  (NULL, 'viewer', 'users',       false, false, false, false)
ON CONFLICT (tenant_id, role, entity) DO NOTHING;

-- =====================================================
-- 3. RLS policies for role_permissions
-- =====================================================
ALTER TABLE crm_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read role permissions"
  ON crm_role_permissions FOR SELECT
  USING (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1 FROM crm_team_members
      WHERE user_id = auth.uid() AND is_active = true
        AND (crm_role_permissions.tenant_id IS NULL OR crm_team_members.tenant_id = crm_role_permissions.tenant_id)
    )
  );

CREATE POLICY "Owners and admins can manage role permissions"
  ON crm_role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM crm_team_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
    )
  );

-- User preferences table for per-user settings (columns, views, dashboard, etc.)
-- Replaces localStorage usage across the app
CREATE TABLE IF NOT EXISTS crm_user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tenant_id, key)
);

ALTER TABLE crm_user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own preferences
CREATE POLICY "users_own_preferences" ON crm_user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_prefs_lookup ON crm_user_preferences(user_id, tenant_id, key);

-- Fix RLS: make tenant-aware helper function
CREATE OR REPLACE FUNCTION is_crm_team_member_of_tenant(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM crm_team_members
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

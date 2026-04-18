-- =====================================================
-- WhatsApp Per-User Instances
-- Each team member can connect their own WhatsApp
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES crm_team_members(id) ON DELETE CASCADE,
  instance_name text NOT NULL,         -- Evolution API instance name (unique per user)
  instance_display_name text,          -- e.g. "הוואטסאפ של יניב"
  phone_number text,                   -- Connected phone number (filled after QR scan)
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connecting', 'connected', 'banned')),
  profile_picture_url text,
  evo_base_url text NOT NULL,          -- Evolution API server URL
  evo_api_key text NOT NULL,           -- API key for this instance
  is_default boolean DEFAULT false,    -- Default instance for this user
  last_connected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, instance_name)
);

CREATE INDEX idx_crm_wa_instances_user ON crm_whatsapp_instances(user_id);
CREATE INDEX idx_crm_wa_instances_tenant ON crm_whatsapp_instances(tenant_id);

-- Update whatsapp_messages to link to specific instance
ALTER TABLE crm_whatsapp_messages
  ADD COLUMN IF NOT EXISTS instance_id uuid REFERENCES crm_whatsapp_instances(id),
  ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES auth.users(id);

-- RLS
ALTER TABLE crm_whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their tenant instances"
  ON crm_whatsapp_instances FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM crm_team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their own instances"
  ON crm_whatsapp_instances FOR ALL
  USING (user_id = auth.uid());

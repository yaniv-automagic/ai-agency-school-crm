-- New lead tracking fields
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS webinar_registered text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS webinar_attended text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS sales_call_completed boolean DEFAULT false;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS community_groups text[] DEFAULT '{}';
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS marketing_consent boolean DEFAULT false;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;

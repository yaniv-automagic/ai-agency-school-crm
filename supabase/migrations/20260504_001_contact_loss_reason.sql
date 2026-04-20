-- Loss reason and follow-up fields
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS loss_reason text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS disqualification_reason text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS loss_notes text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS next_followup_at timestamptz;

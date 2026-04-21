-- =====================================================
-- Contract Signing Compliance - Israeli Electronic Signature Law
-- Adds audit trail, document hashing, signing ceremony support
-- =====================================================

-- 1. Contract Audit Log table
CREATE TABLE IF NOT EXISTS crm_contract_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES crm_contracts(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'contract_created', 'contract_edited', 'contract_sent', 'contract_viewed',
    'contract_downloaded', 'identity_verified', 'document_reviewed',
    'consent_given', 'signature_started', 'signature_completed',
    'pdf_generated', 'signed_pdf_generated', 'email_sent_to_signer',
    'email_sent_to_owner', 'contract_expired', 'contract_cancelled'
  )),
  actor_type text NOT NULL CHECK (actor_type IN ('team_member', 'signer', 'system')),
  actor_id text,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_audit_log_contract ON crm_contract_audit_log(contract_id, created_at);

-- 2. New columns on crm_contracts for signing compliance
ALTER TABLE crm_contracts ADD COLUMN IF NOT EXISTS document_hash text;
ALTER TABLE crm_contracts ADD COLUMN IF NOT EXISTS signed_document_hash text;
ALTER TABLE crm_contracts ADD COLUMN IF NOT EXISTS signer_name_confirmed text;
ALTER TABLE crm_contracts ADD COLUMN IF NOT EXISTS signer_email_confirmed text;
ALTER TABLE crm_contracts ADD COLUMN IF NOT EXISTS signer_user_agent text;
ALTER TABLE crm_contracts ADD COLUMN IF NOT EXISTS consent_given_at timestamptz;
ALTER TABLE crm_contracts ADD COLUMN IF NOT EXISTS document_reviewed_at timestamptz;
ALTER TABLE crm_contracts ADD COLUMN IF NOT EXISTS certificate_id text UNIQUE;
ALTER TABLE crm_contracts ADD COLUMN IF NOT EXISTS signing_ceremony_data jsonb DEFAULT '{}';
ALTER TABLE crm_contracts ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false;

-- 3. Security fix: Remove dangerous UPDATE policy that allows anonymous users
-- to modify ANY field on contracts with a sign_token
DROP POLICY IF EXISTS "crm_contracts_sign_update" ON crm_contracts;

-- 4. RLS for audit log
ALTER TABLE crm_contract_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_contract_audit_log_team_read" ON crm_contract_audit_log
  FOR SELECT USING (is_crm_team_member(auth.uid()));

-- 5. Trigger to prevent edits on locked contracts
CREATE OR REPLACE FUNCTION prevent_locked_contract_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.locked = true AND NEW.locked = true THEN
    RAISE EXCEPTION 'Contract is locked and cannot be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_locked_contract_update ON crm_contracts;
CREATE TRIGGER trg_prevent_locked_contract_update
  BEFORE UPDATE ON crm_contracts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_contract_update();

-- Default marketing_consent to true for all new contacts
ALTER TABLE crm_contacts ALTER COLUMN marketing_consent SET DEFAULT true;

-- Set existing contacts without explicit consent to true
UPDATE crm_contacts SET marketing_consent = true, marketing_consent_at = now() WHERE marketing_consent IS NULL;

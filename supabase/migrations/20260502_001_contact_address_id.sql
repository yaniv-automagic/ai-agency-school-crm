-- Add address and id_number to contacts
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS id_number text;

-- Migrate city data to address
UPDATE crm_contacts SET address = city WHERE city IS NOT NULL AND address IS NULL;

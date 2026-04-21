-- Add entry_type column to landing page mappings
ALTER TABLE crm_landing_page_mappings ADD COLUMN IF NOT EXISTS entry_type text;

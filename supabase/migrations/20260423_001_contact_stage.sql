-- Add stage_id to contacts so lead status is driven by pipeline stages
ALTER TABLE crm_contacts ADD COLUMN stage_id uuid REFERENCES crm_pipeline_stages(id);

-- Set existing contacts' stage_id based on their current status
-- Map old hardcoded statuses to stages from the default pipeline
DO $$
DECLARE
  default_pipeline_id uuid;
  stage_new uuid;
BEGIN
  SELECT id INTO default_pipeline_id FROM crm_pipelines WHERE is_default = true LIMIT 1;
  IF default_pipeline_id IS NOT NULL THEN
    SELECT id INTO stage_new FROM crm_pipeline_stages
      WHERE pipeline_id = default_pipeline_id AND order_index = 0 LIMIT 1;
    IF stage_new IS NOT NULL THEN
      UPDATE crm_contacts SET stage_id = stage_new WHERE stage_id IS NULL;
    END IF;
  END IF;
END $$;

-- Drop the old status CHECK constraint (status column kept for backwards compat but no longer enforced)
ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_status_check;

-- Index for fast stage lookups
CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage ON crm_contacts(stage_id);

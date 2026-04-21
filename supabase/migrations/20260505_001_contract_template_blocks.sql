-- Add blocks_json column to store the visual builder block data
ALTER TABLE crm_contract_templates
ADD COLUMN IF NOT EXISTS blocks_json jsonb DEFAULT '[]'::jsonb;

-- Add canvas_settings column to store canvas background/styling
ALTER TABLE crm_contract_templates
ADD COLUMN IF NOT EXISTS canvas_settings jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN crm_contract_templates.blocks_json IS 'JSON array of template builder blocks for the visual editor';
COMMENT ON COLUMN crm_contract_templates.canvas_settings IS 'JSON object with canvas background color, image, padding, etc.';

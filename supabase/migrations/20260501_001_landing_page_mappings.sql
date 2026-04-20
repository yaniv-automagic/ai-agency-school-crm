-- Landing page to pipeline mapping
CREATE TABLE IF NOT EXISTS crm_landing_page_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  url_pattern text NOT NULL,
  label text,
  pipeline_id uuid REFERENCES crm_pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES crm_pipeline_stages(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_landing_page_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_landing_page_mappings_all" ON crm_landing_page_mappings FOR ALL USING (true);

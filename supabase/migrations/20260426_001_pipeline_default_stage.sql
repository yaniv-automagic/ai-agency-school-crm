-- Add default_stage_id to pipelines for auto-assigning new leads
ALTER TABLE crm_pipelines ADD COLUMN default_stage_id uuid REFERENCES crm_pipeline_stages(id);

-- Set the first stage (order_index = 0) as default for existing pipelines
UPDATE crm_pipelines p
SET default_stage_id = (
  SELECT s.id FROM crm_pipeline_stages s
  WHERE s.pipeline_id = p.id
  ORDER BY s.order_index ASC
  LIMIT 1
);

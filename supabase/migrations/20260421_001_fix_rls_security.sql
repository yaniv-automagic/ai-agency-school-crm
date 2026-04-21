-- Fix RLS security issues flagged by Supabase
-- Tables missing RLS: crm_automation_queue, crm_webhook_logs

-- 1. Enable RLS on crm_automation_queue
ALTER TABLE crm_automation_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_automation_queue_team" ON crm_automation_queue
  FOR ALL USING (is_crm_team_member(auth.uid()));

-- 2. Enable RLS on crm_webhook_logs
ALTER TABLE crm_webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_webhook_logs_team" ON crm_webhook_logs
  FOR ALL USING (is_crm_team_member(auth.uid()));

-- 3. Fix overly permissive policy on crm_landing_page_mappings
DROP POLICY IF EXISTS "crm_landing_page_mappings_all" ON crm_landing_page_mappings;
CREATE POLICY "crm_landing_page_mappings_team" ON crm_landing_page_mappings
  FOR ALL USING (is_crm_team_member(auth.uid()));

-- 4. Fix crm_pipeline_stages - keep public read but restrict write
DROP POLICY IF EXISTS "crm_pipeline_stages_read" ON crm_pipeline_stages;
CREATE POLICY "crm_pipeline_stages_read" ON crm_pipeline_stages
  FOR SELECT USING (true);
-- Write operations require team membership (already exists via main policy)

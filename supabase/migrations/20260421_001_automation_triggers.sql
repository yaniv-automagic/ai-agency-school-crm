-- =====================================================
-- DB Triggers that feed crm_automation_queue
-- These fire on INSERT/UPDATE on key CRM tables
-- =====================================================

-- Generic trigger function
CREATE OR REPLACE FUNCTION crm_enqueue_automation_event()
RETURNS trigger AS $$
DECLARE
  event_type text;
  record_type text;
BEGIN
  -- Determine record type from table name
  record_type := replace(TG_TABLE_NAME, 'crm_', '');

  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type := record_type || '.created';
  ELSIF TG_OP = 'UPDATE' THEN
    event_type := record_type || '.updated';
  END IF;

  -- Special case: deal stage change
  IF TG_TABLE_NAME = 'crm_deals' AND TG_OP = 'UPDATE' THEN
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      event_type := 'deal.stage_changed';
    END IF;
  END IF;

  -- Insert into queue
  INSERT INTO crm_automation_queue (
    tenant_id, event_type, record_type, record_id, old_data, new_data
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    event_type,
    record_type,
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Contacts trigger
DROP TRIGGER IF EXISTS trg_contacts_automation ON crm_contacts;
CREATE TRIGGER trg_contacts_automation
  AFTER INSERT OR UPDATE ON crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION crm_enqueue_automation_event();

-- Deals trigger
DROP TRIGGER IF EXISTS trg_deals_automation ON crm_deals;
CREATE TRIGGER trg_deals_automation
  AFTER INSERT OR UPDATE ON crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION crm_enqueue_automation_event();

-- Tasks trigger
DROP TRIGGER IF EXISTS trg_tasks_automation ON crm_tasks;
CREATE TRIGGER trg_tasks_automation
  AFTER INSERT OR UPDATE ON crm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION crm_enqueue_automation_event();

-- Meetings trigger
DROP TRIGGER IF EXISTS trg_meetings_automation ON crm_meetings;
CREATE TRIGGER trg_meetings_automation
  AFTER INSERT OR UPDATE ON crm_meetings
  FOR EACH ROW
  EXECUTE FUNCTION crm_enqueue_automation_event();

-- Form submissions trigger
DROP TRIGGER IF EXISTS trg_form_submissions_automation ON crm_form_submissions;
CREATE TRIGGER trg_form_submissions_automation
  AFTER INSERT ON crm_form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION crm_enqueue_automation_event();

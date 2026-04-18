-- Restore VSL and Webinar pipelines

-- VSL Pipeline
DO $$
DECLARE
  vsl_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM crm_pipelines WHERE name = 'VSL') THEN
    INSERT INTO crm_pipelines (name, is_default) VALUES ('VSL', false) RETURNING id INTO vsl_id;
    INSERT INTO crm_pipeline_stages (pipeline_id, name, order_index, color, probability, is_won, is_lost) VALUES
      (vsl_id, 'ליד חדש',       0, '#3b82f6', 10, false, false),
      (vsl_id, 'צפה ב-VSL',     1, '#f59e0b', 20, false, false),
      (vsl_id, 'השאיר פרטים',   2, '#f97316', 40, false, false),
      (vsl_id, 'שיחת מכירה',    3, '#8b5cf6', 60, false, false),
      (vsl_id, 'ממתין לתשלום',  4, '#ec4899', 80, false, false),
      (vsl_id, 'נסגר!',         5, '#22c55e', 100, true, false),
      (vsl_id, 'אבוד',          6, '#ef4444', 0, false, true);
  END IF;
END $$;

-- Webinar Pipeline
DO $$
DECLARE
  webinar_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM crm_pipelines WHERE name = 'וובינר') THEN
    INSERT INTO crm_pipelines (name, is_default) VALUES ('וובינר', false) RETURNING id INTO webinar_id;
    INSERT INTO crm_pipeline_stages (pipeline_id, name, order_index, color, probability, is_won, is_lost) VALUES
      (webinar_id, 'נרשם לוובינר',  0, '#3b82f6', 10, false, false),
      (webinar_id, 'נכח בוובינר',   1, '#f59e0b', 30, false, false),
      (webinar_id, 'שיחת מכירה',    2, '#8b5cf6', 50, false, false),
      (webinar_id, 'ממתין לתשלום',  3, '#ec4899', 80, false, false),
      (webinar_id, 'נסגר!',         4, '#22c55e', 100, true, false),
      (webinar_id, 'אבוד',          5, '#ef4444', 0, false, true);
  END IF;
END $$;

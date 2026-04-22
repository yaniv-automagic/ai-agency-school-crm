-- Enable realtime for CRM tables so UI updates live without manual refresh
ALTER PUBLICATION supabase_realtime ADD TABLE crm_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_deals;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_contracts;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_program_enrollments;

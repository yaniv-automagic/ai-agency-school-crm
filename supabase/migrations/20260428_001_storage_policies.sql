-- Storage RLS policies for crm-files bucket
CREATE POLICY "crm_storage_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-files');

CREATE POLICY "crm_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'crm-files');

CREATE POLICY "crm_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'crm-files');

CREATE POLICY "crm_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'crm-files');

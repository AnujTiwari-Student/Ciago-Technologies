
-- Identity docs bucket policies. Path convention: <user_id>/<doc_type>-<timestamp>.<ext>
CREATE POLICY "idoc_obj_self" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='identity-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id='identity-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "idoc_obj_admin_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='identity-docs' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "idoc_obj_hr_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id='identity-docs'
    AND public.has_role(auth.uid(),'hr')
    AND NOT public.is_admin_user(((storage.foldername(name))[1])::uuid)
  );

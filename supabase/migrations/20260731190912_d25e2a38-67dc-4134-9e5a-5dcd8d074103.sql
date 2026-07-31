CREATE POLICY "estimate photos owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'estimate-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "estimate photos owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'estimate-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "estimate photos owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'estimate-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'estimate-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "estimate photos owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'estimate-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
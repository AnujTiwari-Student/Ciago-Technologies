DROP POLICY IF EXISTS "Anyone reads active postings" ON public.job_postings;
CREATE POLICY "Public reads active postings" ON public.job_postings FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "Admins read all postings" ON public.job_postings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
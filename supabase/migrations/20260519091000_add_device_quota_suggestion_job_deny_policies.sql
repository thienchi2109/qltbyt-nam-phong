BEGIN;

DROP POLICY IF EXISTS device_quota_suggestion_jobs_no_client_access
  ON public.device_quota_suggestion_jobs;
CREATE POLICY device_quota_suggestion_jobs_no_client_access
  ON public.device_quota_suggestion_jobs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS device_quota_suggestion_job_chunks_no_client_access
  ON public.device_quota_suggestion_job_chunks;
CREATE POLICY device_quota_suggestion_job_chunks_no_client_access
  ON public.device_quota_suggestion_job_chunks
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;

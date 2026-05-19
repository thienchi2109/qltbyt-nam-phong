DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'device_quota_suggestion_jobs'
  ) THEN
    RAISE EXCEPTION 'device_quota_suggestion_jobs table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'device_quota_suggestion_job_chunks'
  ) THEN
    RAISE EXCEPTION 'device_quota_suggestion_job_chunks table is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN (
        'device_quota_suggestion_jobs',
        'device_quota_suggestion_job_chunks'
      )
      AND grantee IN ('anon', 'authenticated')
  ) THEN
    RAISE EXCEPTION 'suggestion job tables must not grant direct client access';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'device_quota_suggestion_jobs'
      AND policyname = 'device_quota_suggestion_jobs_no_client_access'
  ) THEN
    RAISE EXCEPTION 'device_quota_suggestion_jobs deny policy is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'device_quota_suggestion_job_chunks'
      AND policyname = 'device_quota_suggestion_job_chunks_no_client_access'
  ) THEN
    RAISE EXCEPTION 'device_quota_suggestion_job_chunks deny policy is missing';
  END IF;
END;
$$;

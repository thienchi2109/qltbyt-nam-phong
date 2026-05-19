BEGIN;

CREATE TABLE IF NOT EXISTS public.device_quota_suggestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,
  scope_key TEXT NOT NULL,
  data_signature TEXT NOT NULL,
  catalog_signature TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'vm' CHECK (provider = 'vm'),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'succeeded', 'failed')),
  processed_unique_names INTEGER NOT NULL DEFAULT 0 CHECK (processed_unique_names >= 0),
  total_unique_names INTEGER NOT NULL CHECK (total_unique_names >= 0),
  item_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  category_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.device_quota_suggestion_job_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.device_quota_suggestion_jobs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'succeeded', 'failed')),
  unique_name_count INTEGER NOT NULL CHECK (unique_name_count >= 0),
  device_name_count INTEGER NOT NULL CHECK (device_name_count >= 0),
  device_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, chunk_index)
);

CREATE UNIQUE INDEX IF NOT EXISTS device_quota_suggestion_jobs_active_unique
  ON public.device_quota_suggestion_jobs (don_vi_id, scope_key, data_signature)
  WHERE status IN ('queued', 'processing', 'succeeded');

CREATE INDEX IF NOT EXISTS device_quota_suggestion_jobs_scope_idx
  ON public.device_quota_suggestion_jobs (scope_key, don_vi_id, created_at DESC);

CREATE INDEX IF NOT EXISTS device_quota_suggestion_job_chunks_queue_idx
  ON public.device_quota_suggestion_job_chunks (status, created_at, id)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS device_quota_suggestion_job_chunks_job_idx
  ON public.device_quota_suggestion_job_chunks (job_id, chunk_index);

CREATE OR REPLACE FUNCTION public.touch_device_quota_suggestion_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_device_quota_suggestion_jobs_updated_at
  ON public.device_quota_suggestion_jobs;
CREATE TRIGGER trg_device_quota_suggestion_jobs_updated_at
BEFORE UPDATE ON public.device_quota_suggestion_jobs
FOR EACH ROW
EXECUTE FUNCTION public.touch_device_quota_suggestion_updated_at();

DROP TRIGGER IF EXISTS trg_device_quota_suggestion_job_chunks_updated_at
  ON public.device_quota_suggestion_job_chunks;
CREATE TRIGGER trg_device_quota_suggestion_job_chunks_updated_at
BEFORE UPDATE ON public.device_quota_suggestion_job_chunks
FOR EACH ROW
EXECUTE FUNCTION public.touch_device_quota_suggestion_updated_at();

ALTER TABLE public.device_quota_suggestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_quota_suggestion_job_chunks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.device_quota_suggestion_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.device_quota_suggestion_job_chunks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_device_quota_suggestion_updated_at() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.device_quota_suggestion_jobs IS
  'Server-only async Device Quota suggestion jobs. Access is through Next.js job APIs using service role after server-side auth.';

COMMENT ON TABLE public.device_quota_suggestion_job_chunks IS
  'Server-only async Device Quota suggestion job chunks split by unique device-name count.';

COMMIT;

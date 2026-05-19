BEGIN;

ALTER TABLE public.device_quota_suggestion_jobs
  DROP CONSTRAINT IF EXISTS device_quota_suggestion_jobs_processed_lte_total;

ALTER TABLE public.device_quota_suggestion_jobs
  ADD CONSTRAINT device_quota_suggestion_jobs_processed_lte_total
  CHECK (processed_unique_names <= total_unique_names);

CREATE OR REPLACE FUNCTION public.device_quota_suggestion_job_store_rpc(
  p_action TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role TEXT := '';
  v_user_id TEXT := NULL;
  v_scope_key TEXT := NULL;
  v_is_service_role BOOLEAN := FALSE;
  v_allowed_don_vi BIGINT[] := NULL;
  v_job JSONB := '{}'::jsonb;
  v_chunks JSONB := '[]'::jsonb;
  v_job_id UUID := NULL;
  v_chunk_id UUID := NULL;
  v_don_vi_id BIGINT := NULL;
  v_row public.device_quota_suggestion_jobs%ROWTYPE;
  v_chunk public.device_quota_suggestion_job_chunks%ROWTYPE;
  v_rows JSONB := '[]'::jsonb;
BEGIN
  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'Missing action' USING ERRCODE = '22023';
  END IF;

  IF v_claims IS NULL THEN
    RAISE EXCEPTION 'Missing JWT claims' USING ERRCODE = '42501';
  END IF;

  v_role := lower(COALESCE(v_claims->>'app_role', v_claims->>'role', ''));
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  v_is_service_role := v_role = 'service_role';

  IF v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_service_role THEN
    v_user_id := NULLIF(COALESCE(v_claims->>'user_id', v_claims->>'sub'), '');
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
    END IF;
    v_scope_key := 'user:' || v_user_id;
    v_allowed_don_vi := public.allowed_don_vi_for_session();
  END IF;

  IF p_action = 'create_job' THEN
    v_job := COALESCE(p_payload->'job', '{}'::jsonb);
    v_chunks := COALESCE(p_payload->'chunks', '[]'::jsonb);
    v_don_vi_id := NULLIF(v_job->>'don_vi_id', '')::bigint;

    IF NOT v_is_service_role THEN
      IF v_job->>'scope_key' IS DISTINCT FROM v_scope_key THEN
        RAISE EXCEPTION 'scope_key claim mismatch' USING ERRCODE = '42501';
      END IF;
      IF v_don_vi_id IS NULL OR NOT (v_don_vi_id = ANY(v_allowed_don_vi)) THEN
        RAISE EXCEPTION 'Facility scope denied' USING ERRCODE = '42501';
      END IF;
    END IF;

    INSERT INTO public.device_quota_suggestion_jobs (
      catalog_signature,
      category_snapshot,
      data_signature,
      don_vi_id,
      error,
      item_counts,
      processed_unique_names,
      provider,
      result,
      scope_key,
      status,
      total_unique_names
    )
    VALUES (
      v_job->>'catalog_signature',
      COALESCE(v_job->'category_snapshot', '[]'::jsonb),
      v_job->>'data_signature',
      v_don_vi_id,
      v_job->>'error',
      COALESCE(v_job->'item_counts', '{}'::jsonb),
      COALESCE(NULLIF(v_job->>'processed_unique_names', '')::integer, 0),
      COALESCE(v_job->>'provider', 'vm'),
      v_job->'result',
      v_job->>'scope_key',
      COALESCE(v_job->>'status', 'queued'),
      COALESCE(NULLIF(v_job->>'total_unique_names', '')::integer, 0)
    )
    RETURNING * INTO v_row;

    INSERT INTO public.device_quota_suggestion_job_chunks (
      chunk_index,
      device_name_count,
      device_names,
      job_id,
      status,
      unique_name_count
    )
    SELECT
      chunk_index,
      device_name_count,
      COALESCE(device_names, '[]'::jsonb),
      v_row.id,
      'queued',
      unique_name_count
    FROM jsonb_to_recordset(v_chunks) AS chunk_rows(
      chunk_index INTEGER,
      device_name_count INTEGER,
      device_names JSONB,
      unique_name_count INTEGER
    );

    RETURN to_jsonb(v_row);
  END IF;

  IF p_action = 'find_active_job' THEN
    v_don_vi_id := NULLIF(p_payload->>'don_vi_id', '')::bigint;
    IF NOT v_is_service_role THEN
      IF p_payload->>'scope_key' IS DISTINCT FROM v_scope_key THEN
        RAISE EXCEPTION 'scope_key claim mismatch' USING ERRCODE = '42501';
      END IF;
      IF v_don_vi_id IS NULL OR NOT (v_don_vi_id = ANY(v_allowed_don_vi)) THEN
        RAISE EXCEPTION 'Facility scope denied' USING ERRCODE = '42501';
      END IF;
    END IF;

    SELECT *
    INTO v_row
    FROM public.device_quota_suggestion_jobs
    WHERE don_vi_id = v_don_vi_id
      AND scope_key = p_payload->>'scope_key'
      AND data_signature = p_payload->>'data_signature'
      AND status IN ('queued', 'processing', 'succeeded')
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN CASE WHEN v_row.id IS NULL THEN NULL ELSE to_jsonb(v_row) END;
  END IF;

  IF p_action = 'get_job' THEN
    v_job_id := NULLIF(p_payload->>'job_id', '')::uuid;
    SELECT * INTO v_row
    FROM public.device_quota_suggestion_jobs
    WHERE id = v_job_id;

    IF v_row.id IS NULL THEN
      RETURN NULL;
    END IF;
    IF NOT v_is_service_role AND v_row.scope_key IS DISTINCT FROM v_scope_key THEN
      RETURN NULL;
    END IF;
    RETURN to_jsonb(v_row);
  END IF;

  IF p_action = 'get_chunk' THEN
    v_chunk_id := NULLIF(p_payload->>'chunk_id', '')::uuid;
    SELECT c.*
    INTO v_chunk
    FROM public.device_quota_suggestion_job_chunks c
    JOIN public.device_quota_suggestion_jobs j ON j.id = c.job_id
    WHERE c.id = v_chunk_id
      AND (v_is_service_role OR j.scope_key = v_scope_key);

    RETURN CASE WHEN v_chunk.id IS NULL THEN NULL ELSE to_jsonb(v_chunk) END;
  END IF;

  IF p_action = 'get_job_chunks' THEN
    v_job_id := NULLIF(p_payload->>'job_id', '')::uuid;
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.chunk_index), '[]'::jsonb)
    INTO v_rows
    FROM public.device_quota_suggestion_job_chunks c
    JOIN public.device_quota_suggestion_jobs j ON j.id = c.job_id
    WHERE c.job_id = v_job_id
      AND (v_is_service_role OR j.scope_key = v_scope_key);

    RETURN v_rows;
  END IF;

  IF p_action = 'list_queued_chunks' THEN
    IF NOT v_is_service_role THEN
      RAISE EXCEPTION 'Worker action requires service role' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at, c.id), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT *
      FROM public.device_quota_suggestion_job_chunks
      WHERE status = 'queued'
      ORDER BY created_at, id
      LIMIT GREATEST(1, LEAST(COALESCE(NULLIF(p_payload->>'limit', '')::integer, 1), 25))
    ) c;

    RETURN v_rows;
  END IF;

  IF p_action = 'mark_chunk_processing' THEN
    v_chunk_id := NULLIF(p_payload->>'chunk_id', '')::uuid;
    UPDATE public.device_quota_suggestion_job_chunks
    SET attempts = attempts + 1,
        status = 'processing',
        error = NULL
    WHERE id = v_chunk_id
      AND status = 'queued'
    RETURNING * INTO v_chunk;

    RETURN jsonb_build_object('claimed', v_chunk.id IS NOT NULL);
  END IF;

  IF p_action = 'mark_chunk_failed' THEN
    v_chunk_id := NULLIF(p_payload->>'chunk_id', '')::uuid;
    UPDATE public.device_quota_suggestion_job_chunks
    SET error = p_payload->>'error',
        status = 'failed'
    WHERE id = v_chunk_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF p_action = 'mark_chunk_succeeded' THEN
    v_chunk_id := NULLIF(p_payload->>'chunk_id', '')::uuid;
    UPDATE public.device_quota_suggestion_job_chunks
    SET error = NULL,
        result = p_payload->'result',
        status = 'succeeded'
    WHERE id = v_chunk_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  v_job_id := NULLIF(p_payload->>'job_id', '')::uuid;

  IF NOT v_is_service_role AND p_action IN (
    'mark_job_failed',
    'mark_job_processing',
    'mark_job_succeeded',
    'reset_failed_chunks',
    'update_job_progress'
  ) THEN
    PERFORM 1
    FROM public.device_quota_suggestion_jobs
    WHERE id = v_job_id
      AND scope_key = v_scope_key;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Suggestion job not found' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_action = 'mark_job_failed' THEN
    UPDATE public.device_quota_suggestion_jobs
    SET error = p_payload->>'error',
        status = 'failed'
    WHERE id = v_job_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF p_action = 'mark_job_processing' THEN
    UPDATE public.device_quota_suggestion_jobs
    SET error = NULL,
        status = 'processing'
    WHERE id = v_job_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF p_action = 'mark_job_succeeded' THEN
    UPDATE public.device_quota_suggestion_jobs
    SET error = NULL,
        result = p_payload->'result',
        status = 'succeeded'
    WHERE id = v_job_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF p_action = 'reset_failed_chunks' THEN
    UPDATE public.device_quota_suggestion_job_chunks
    SET error = NULL,
        status = 'queued'
    WHERE job_id = v_job_id
      AND status = 'failed';
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF p_action = 'update_job_progress' THEN
    UPDATE public.device_quota_suggestion_jobs
    SET processed_unique_names = COALESCE(
      NULLIF(p_payload->>'processed_unique_names', '')::integer,
      processed_unique_names
    )
    WHERE id = v_job_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  RAISE EXCEPTION 'Unknown suggestion job store action: %', p_action USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION public.device_quota_suggestion_job_store_rpc(TEXT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.device_quota_suggestion_job_store_rpc(TEXT, JSONB)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.device_quota_suggestion_job_store_rpc(TEXT, JSONB) IS
  'RPC-only persistence boundary for async Device Quota suggestion jobs. Adds claim-safe chunk processing and JWT/service-role guards. Rollback by adding a later migration that drops this function and reverts callers to the prior store contract if needed.';

COMMIT;

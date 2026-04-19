-- Issue #271 Batch 4: authenticated audit RPC for dormant assistant SQL.
-- Scope:
--   - wrap public.audit_log(...) for query_database audit events
--   - validate JWT claims and effective facility scope before writing
--
-- Out of scope:
--   - applying this migration in the current implementation session
--   - registering query_database in /api/chat
--   - adding ai_query_database execution RPCs

BEGIN;

CREATE OR REPLACE FUNCTION public.assistant_query_database_audit_log(
  p_status text,
  p_tool_path text,
  p_sql_shape text,
  p_latency_ms integer,
  p_row_count integer DEFAULT NULL,
  p_payload_bytes integer DEFAULT NULL,
  p_effective_facility_id bigint DEFAULT NULL,
  p_facility_source text DEFAULT NULL,
  p_error_class text DEFAULT NULL,
  p_requested_facility_id bigint DEFAULT NULL,
  p_session_facility_id bigint DEFAULT NULL,
  p_raw_role text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb;
  v_role text;
  v_user_id text;
  v_claim_don_vi text;
  v_allowed bigint[];
  v_facility_exists boolean;
  v_action_details jsonb;
BEGIN
  BEGIN
    v_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Missing JWT claims' USING ERRCODE = '42501';
  END;

  v_role := lower(COALESCE(
    NULLIF(v_claims->>'app_role', ''),
    NULLIF(v_claims->>'role', ''),
    ''
  ));
  v_user_id := NULLIF(COALESCE(v_claims->>'user_id', v_claims->>'sub'), '');
  v_claim_don_vi := NULLIF(v_claims->>'don_vi', '');

  IF v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Invalid user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF p_tool_path IS DISTINCT FROM 'query_database' THEN
    RAISE EXCEPTION 'Invalid assistant SQL audit tool path'
      USING ERRCODE = '22023';
  END IF;

  IF p_status NOT IN ('success', 'failure') THEN
    RAISE EXCEPTION 'Invalid assistant SQL audit status'
      USING ERRCODE = '22023';
  END IF;

  IF p_status = 'failure' AND NULLIF(p_error_class, '') IS NULL THEN
    RAISE EXCEPTION 'Assistant SQL audit failure requires error_class'
      USING ERRCODE = '22023';
  END IF;

  IF p_effective_facility_id IS NULL THEN
    RAISE EXCEPTION 'Missing assistant SQL effective facility scope'
      USING ERRCODE = '42501';
  END IF;

  IF p_facility_source NOT IN ('selected', 'session') THEN
    RAISE EXCEPTION 'Invalid assistant SQL facility source'
      USING ERRCODE = '22023';
  END IF;

  IF p_latency_ms IS NULL OR p_latency_ms < 0 THEN
    RAISE EXCEPTION 'Invalid assistant SQL audit latency'
      USING ERRCODE = '22023';
  END IF;

  IF p_row_count IS NOT NULL AND p_row_count < 0 THEN
    RAISE EXCEPTION 'Invalid assistant SQL audit row count'
      USING ERRCODE = '22023';
  END IF;

  IF p_payload_bytes IS NOT NULL AND p_payload_bytes < 0 THEN
    RAISE EXCEPTION 'Invalid assistant SQL audit payload size'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(BTRIM(p_sql_shape), '') IS NULL OR length(p_sql_shape) > 1000 THEN
    RAISE EXCEPTION 'Invalid assistant SQL audit SQL shape'
      USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.don_vi
    WHERE id = p_effective_facility_id
      AND active = true
  )
  INTO v_facility_exists;

  IF NOT v_facility_exists THEN
    RAISE EXCEPTION 'Assistant SQL effective facility scope is not accessible'
      USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();

    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Assistant SQL effective facility scope is not accessible'
        USING ERRCODE = '42501';
    END IF;

    IF NOT (p_effective_facility_id = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'Assistant SQL effective facility scope is not accessible'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_role NOT IN ('global', 'regional_leader') THEN
    IF v_claim_don_vi IS NULL OR v_claim_don_vi !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Missing don_vi claim for assistant SQL audit scope'
        USING ERRCODE = '42501';
    END IF;

    IF v_claim_don_vi::bigint IS DISTINCT FROM p_effective_facility_id THEN
      RAISE EXCEPTION 'Assistant SQL local role scope mismatch'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_action_details := jsonb_build_object(
    'tool_path', p_tool_path,
    'sql_shape', p_sql_shape,
    'status', p_status,
    'latency_ms', p_latency_ms,
    'row_count', p_row_count,
    'payload_bytes', p_payload_bytes,
    'effective_facility_id', p_effective_facility_id,
    'facility_source', p_facility_source,
    'error_class', NULLIF(p_error_class, ''),
    'normalized_role', v_role,
    'raw_role', COALESCE(NULLIF(p_raw_role, ''), NULLIF(v_claims->>'app_role', ''), NULLIF(v_claims->>'role', '')),
    'requested_facility_id', p_requested_facility_id,
    'session_facility_id', p_session_facility_id
  );

  IF NOT public.audit_log(
    p_action_type := 'assistant_query_database',
    p_entity_type := 'assistant_sql',
    p_entity_id := p_effective_facility_id,
    p_entity_label := 'query_database',
    p_action_details := v_action_details
  ) THEN
    RAISE EXCEPTION 'audit_log failed for assistant query_database'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assistant_query_database_audit_log(
  text, text, text, integer, integer, integer, bigint, text, text, bigint, bigint, text
) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.assistant_query_database_audit_log(
  text, text, text, integer, integer, integer, bigint, text, text, bigint, bigint, text
) FROM PUBLIC;

COMMENT ON FUNCTION public.assistant_query_database_audit_log(
  text, text, text, integer, integer, integer, bigint, text, text, bigint, bigint, text
) IS
'Authenticated audit wrapper for the dormant assistant query_database SQL path. Validates JWT claims and effective facility scope before calling public.audit_log(...).';

NOTIFY pgrst, 'reload schema';

COMMIT;

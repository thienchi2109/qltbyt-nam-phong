-- Add read-only AI attachment metadata RPC with strict JWT guardrails.
-- Returns safe metadata for equipment-linked attachments.
--
-- Security: SECURITY DEFINER + pinned search_path, JWT claim guards,
-- tenant isolation via thiet_bi.don_vi, authenticated-only.
-- External URLs are returned as-is; no signed URL generation needed
-- since current data uses external absolute URLs (e.g. Google Docs).

BEGIN;

DROP FUNCTION IF EXISTS public.ai_attachment_metadata(BIGINT, BIGINT, TEXT);

CREATE OR REPLACE FUNCTION public.ai_attachment_metadata(
  thiet_bi_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id TEXT := NULLIF(COALESCE(public._get_jwt_claim('user_id'), public._get_jwt_claim('sub')), '');
  v_don_vi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_allowed BIGINT[] := NULL;
  v_is_global BOOLEAN := FALSE;
  v_equip_don_vi BIGINT;
BEGIN
  -- ── JWT claim guards ──────────────────────────────────────────
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  v_is_global := (v_role = 'global');

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NOT NULL
     AND NULLIF(BTRIM(p_user_id), '') IS NOT NULL
     AND BTRIM(p_user_id) IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'user_id claim mismatch' USING ERRCODE = '42501';
  END IF;

  -- ── Validate thiet_bi_id ──────────────────────────────────────
  IF ai_attachment_metadata.thiet_bi_id IS NULL OR ai_attachment_metadata.thiet_bi_id <= 0 THEN
    RETURN jsonb_build_object(
      'error', 'Invalid thiet_bi_id',
      'thiet_bi_id', ai_attachment_metadata.thiet_bi_id
    );
  END IF;

  -- ── Resolve tenant scope ──────────────────────────────────────
  IF v_is_global THEN
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object(
        'error', 'Facility selection required',
        'thiet_bi_id', ai_attachment_metadata.thiet_bi_id
      );
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object(
        'error', 'No accessible facilities',
        'thiet_bi_id', ai_attachment_metadata.thiet_bi_id
      );
    END IF;
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object(
        'error', 'Facility selection required',
        'thiet_bi_id', ai_attachment_metadata.thiet_bi_id
      );
    END IF;
    IF NOT (p_don_vi = ANY(v_allowed)) THEN
      RETURN jsonb_build_object(
        'error', 'Access denied for selected facility',
        'thiet_bi_id', ai_attachment_metadata.thiet_bi_id
      );
    END IF;
  END IF;

  -- ── Tenant-scoped equipment lookup ────────────────────────────
  SELECT tb.don_vi INTO v_equip_don_vi
  FROM public.thiet_bi tb
  WHERE tb.id = ai_attachment_metadata.thiet_bi_id
    AND tb.is_deleted = FALSE
    AND (
      CASE
        WHEN v_is_global THEN tb.don_vi = p_don_vi
        WHEN v_role = 'regional_leader' THEN tb.don_vi = p_don_vi
        ELSE tb.don_vi = v_don_vi
      END
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Equipment not found or not accessible',
      'thiet_bi_id', ai_attachment_metadata.thiet_bi_id
    );
  END IF;

  -- ── Return attachment metadata ────────────────────────────────
  RETURN (
    WITH attachments AS (
      SELECT
        f.id,
        f.ten_file,
        'external_url' AS access_type,
        f.duong_dan_luu_tru AS external_url,
        f.ngay_tai_len
      FROM public.file_dinh_kem f
      WHERE f.thiet_bi_id = ai_attachment_metadata.thiet_bi_id
      ORDER BY f.ngay_tai_len DESC NULLS LAST
      LIMIT 20
    )
    SELECT jsonb_build_object(
      'thiet_bi_id', ai_attachment_metadata.thiet_bi_id,
      'attachments',
      COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'ten_file', a.ten_file,
            'access_type', a.access_type,
            'external_url', a.external_url,
            'ngay_tai_len', a.ngay_tai_len
          )
          ORDER BY a.ngay_tai_len DESC NULLS LAST
        ) FROM attachments a),
        '[]'::JSONB
      ),
      'total_count', COALESCE((SELECT COUNT(*)::BIGINT FROM attachments), 0)
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ai_attachment_metadata(BIGINT, BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_attachment_metadata(BIGINT, BIGINT, TEXT) FROM PUBLIC;

COMMIT;

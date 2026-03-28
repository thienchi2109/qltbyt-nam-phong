-- ai_category_suggestion: return a bounded candidate set of equipment categories
-- for a provided device name. Used by the assistant categorySuggestion tool in
-- pass 1 of payload compaction so the model receives top-k candidates rather
-- than the full facility category catalog.
--
-- Security: SECURITY DEFINER + pinned search_path, JWT claim guards,
-- tenant isolation. Read-only (STABLE).

BEGIN;

CREATE OR REPLACE FUNCTION public.ai_category_suggestion(
  p_device_name TEXT,
  p_don_vi BIGINT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL,
  p_top_k INTEGER DEFAULT 10
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
  v_effective BIGINT[] := NULL;
  v_is_global BOOLEAN := FALSE;
  v_device_name TEXT := NULLIF(BTRIM(p_device_name), '');
  v_top_k INTEGER := LEAST(GREATEST(COALESCE(NULLIF(p_top_k, 0), 10), 1), 10);
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_device_name IS NULL THEN
    RAISE EXCEPTION 'device_name is required' USING ERRCODE = '22023';
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

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object('data', '[]'::JSONB, 'total', 0);
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  ELSE
    IF p_don_vi IS NOT NULL AND p_don_vi IS DISTINCT FROM v_don_vi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
    v_effective := ARRAY[v_don_vi];
  END IF;

  RETURN (
    WITH scoped_categories AS (
      SELECT
        n.id,
        n.ma_nhom,
        n.ten_nhom,
        n.phan_loai,
        p.ten_nhom AS parent_name,
        COALESCE(n.fts, ''::TSVECTOR) AS fts
      FROM public.nhom_thiet_bi n
      LEFT JOIN public.nhom_thiet_bi p ON p.id = n.parent_id
      WHERE (v_effective IS NULL OR n.don_vi_id = ANY(v_effective))
    ),
    all_fts_matches AS (
      SELECT
        sc.id,
        sc.ma_nhom,
        sc.ten_nhom,
        sc.phan_loai,
        sc.parent_name,
        'fts'::TEXT AS match_reason,
        ts_rank_cd(sc.fts, plainto_tsquery('simple', v_device_name)) AS score
      FROM scoped_categories sc
      WHERE sc.fts @@ plainto_tsquery('simple', v_device_name)
    ),
    fts_matches AS (
      SELECT
        afm.id,
        afm.ma_nhom,
        afm.ten_nhom,
        afm.phan_loai,
        afm.parent_name,
        afm.match_reason,
        afm.score
      FROM all_fts_matches afm
      ORDER BY afm.score DESC, afm.ten_nhom ASC
      LIMIT v_top_k
    ),
    trigram_matches AS (
      SELECT
        sc.id,
        sc.ma_nhom,
        sc.ten_nhom,
        sc.phan_loai,
        sc.parent_name,
        'trigram'::TEXT AS match_reason,
        extensions.word_similarity(lower(v_device_name), lower(COALESCE(sc.ten_nhom, ''))) AS score
      FROM scoped_categories sc
      WHERE extensions.word_similarity(lower(v_device_name), lower(COALESCE(sc.ten_nhom, ''))) > 0.3
        AND NOT EXISTS (
          SELECT 1
          FROM all_fts_matches afm
          WHERE afm.id = sc.id
        )
      ORDER BY score DESC, sc.ten_nhom ASC
      LIMIT v_top_k
    ),
    combined_matches AS (
      SELECT * FROM fts_matches
      UNION ALL
      SELECT * FROM trigram_matches
    ),
    ranked_matches AS (
      SELECT
        cm.*,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE WHEN cm.match_reason = 'fts' THEN 0 ELSE 1 END,
            cm.score DESC,
            cm.ten_nhom ASC
        ) AS rank
      FROM combined_matches cm
    ),
    limited_matches AS (
      SELECT *
      FROM ranked_matches
      ORDER BY rank
      LIMIT v_top_k
    )
    SELECT jsonb_build_object(
      'data',
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'ma_nhom', ma_nhom,
            'ten_nhom', ten_nhom,
            'phan_loai', phan_loai,
            'parent_name', parent_name,
            'match_reason', match_reason
          )
          ORDER BY rank
        ),
        '[]'::JSONB
      ),
      'total', COUNT(*)
    )
    FROM limited_matches
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ai_category_suggestion(TEXT, BIGINT, TEXT, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_category_suggestion(TEXT, BIGINT, TEXT, INTEGER) FROM PUBLIC;

COMMIT;

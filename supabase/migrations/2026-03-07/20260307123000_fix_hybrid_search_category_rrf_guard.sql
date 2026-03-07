-- Migration: fix hybrid_search_category_batch RRF parameter guard
-- Purpose: enforce positive p_rrf_k to prevent invalid RRF denominators in live DB

BEGIN;

CREATE OR REPLACE FUNCTION public.hybrid_search_category_batch(
  p_queries JSONB,
  p_don_vi BIGINT DEFAULT NULL,
  p_match_count INT DEFAULT 1,
  p_full_text_weight FLOAT DEFAULT 1.0,
  p_semantic_weight FLOAT DEFAULT 1.0,
  p_rrf_k INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  -- Standalone JWT claim extraction (mandatory guards per RPC Security Standards)
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_allowed_facilities BIGINT[];
  v_query JSONB;
  v_query_text TEXT;
  v_query_embedding extensions.vector(384);
  v_results JSONB := '[]'::JSONB;
  v_matches JSONB;
BEGIN
  -- Parameter guard
  IF p_rrf_k IS NULL OR p_rrf_k <= 0 THEN
    RAISE EXCEPTION 'p_rrf_k must be > 0' USING ERRCODE = '22023';
  END IF;

  -- Role guard
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
  END IF;

  -- User ID guard
  IF v_user_id IS NULL OR v_user_id = '' THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;

  -- Tenant guard (non-global must have don_vi)
  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR v_don_vi = '') THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING errcode = '42501';
  END IF;

  -- Tenant isolation per role
  IF v_role IN ('global', 'admin') THEN
    -- global/admin: honour the caller-supplied p_don_vi
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    -- to_qltb and other roles: force p_don_vi from JWT claim
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  -- Null don_vi guard (prevent cross-tenant exposure)
  IF p_don_vi IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  -- Process each query in the batch
  FOR v_query IN SELECT * FROM jsonb_array_elements(p_queries)
  LOOP
    v_query_text := NULLIF(BTRIM(v_query->>'text'), '');

    -- Null-safe embedding extraction: skip semantic branch if null
    IF jsonb_typeof(v_query->'embedding') = 'array' THEN
      v_query_embedding := (v_query->>'embedding')::extensions.vector(384);
    ELSE
      v_query_embedding := NULL;
    END IF;

    -- Hybrid search with RRF (Reciprocal Rank Fusion)
    SELECT jsonb_agg(row_to_json(r)) INTO v_matches
    FROM (
      WITH tenant_categories AS (
        SELECT id, ten_nhom, ma_nhom, phan_loai, fts, embedding
        FROM public.nhom_thiet_bi
        WHERE don_vi_id = p_don_vi
      ),
      full_text AS (
        SELECT ft.id, ft.rank_ix
        FROM (
          SELECT tc.id,
            row_number() OVER (
              ORDER BY ts_rank_cd(tc.fts, plainto_tsquery('simple', v_query_text)) DESC, tc.id
            ) AS rank_ix
          FROM tenant_categories tc
          WHERE v_query_text IS NOT NULL
            AND tc.fts @@ plainto_tsquery('simple', v_query_text)
        ) ft
        ORDER BY ft.rank_ix
        LIMIT p_match_count * 2
      ),
      semantic AS (
        SELECT s.id, s.rank_ix
        FROM (
          SELECT tc.id,
            row_number() OVER (
              ORDER BY tc.embedding <=> v_query_embedding, tc.id
            ) AS rank_ix
          FROM tenant_categories tc
          WHERE v_query_embedding IS NOT NULL
            AND tc.embedding IS NOT NULL
        ) s
        ORDER BY s.rank_ix
        LIMIT p_match_count * 2
      )
      SELECT tc.id, tc.ten_nhom, tc.ma_nhom, tc.phan_loai,
        (COALESCE(1.0 / (p_rrf_k + ft.rank_ix), 0.0) * p_full_text_weight +
         COALESCE(1.0 / (p_rrf_k + s.rank_ix), 0.0) * p_semantic_weight)::FLOAT AS rrf_score
      FROM full_text ft
      FULL OUTER JOIN semantic s ON ft.id = s.id
      JOIN tenant_categories tc ON tc.id = COALESCE(ft.id, s.id)
      ORDER BY rrf_score DESC, tc.id
      LIMIT p_match_count
    ) r;

    v_results := v_results || jsonb_build_object(
      'query_text', v_query_text,
      'results', COALESCE(v_matches, '[]'::JSONB)
    );
  END LOOP;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hybrid_search_category_batch(JSONB, BIGINT, INT, FLOAT, FLOAT, INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.hybrid_search_category_batch(JSONB, BIGINT, INT, FLOAT, FLOAT, INT) FROM PUBLIC;

COMMIT;

-- Add normalized server-side search to the technical-configuration dossier list.
-- Replaces the latest list definition from:
-- 20260805143425_technical_configuration_dossier_delete.sql
BEGIN;

CREATE OR REPLACE FUNCTION public._normalize_search_text(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $function$
  SELECT CASE
    WHEN input IS NULL THEN NULL
    ELSE pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.translate(
            pg_catalog.lower(pg_catalog.normalize(input, 'NFC')),
            'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
            'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
          ),
          '[^[:alnum:]]+',
          ' ',
          'g'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  END;
$function$;

DROP FUNCTION public.technical_configuration_dossiers_list(INTEGER, INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_list(
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_include_archived BOOLEAN DEFAULT false,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_result JSONB;
  v_normalized_search TEXT;
  v_index_token TEXT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  IF p_page IS NULL
     OR p_page_size IS NULL
     OR p_page < 1
     OR p_page_size < 1
     OR p_page_size > 100
     OR pg_catalog.char_length(p_search) > 200 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  v_normalized_search := NULLIF(public._normalize_search_text(p_search), '');
  SELECT token
  INTO v_index_token
  FROM (
    SELECT DISTINCT token
    FROM pg_catalog.regexp_split_to_table(
      v_normalized_search,
      '[[:space:]]+'
    ) AS tokens(token)
    WHERE token <> ''
  ) distinct_tokens
  ORDER BY pg_catalog.char_length(token) DESC, token
  LIMIT 1;

  WITH search_tokens AS MATERIALIZED (
    SELECT DISTINCT token
    FROM pg_catalog.regexp_split_to_table(
      v_normalized_search,
      '[[:space:]]+'
    ) AS tokens(token)
    WHERE token <> ''
  ),
  candidate_ids AS MATERIALIZED (
    SELECT d.id
    FROM public.technical_configuration_dossiers d
    WHERE public._normalize_search_text(d.name)
      LIKE '%' || public._sanitize_ilike_pattern(v_index_token) || '%' ESCAPE E'\\'
    UNION
    SELECT d.id
    FROM public.technical_configuration_dossiers d
    WHERE public._normalize_search_text(d.device_type_name)
      LIKE '%' || public._sanitize_ilike_pattern(v_index_token) || '%' ESCAPE E'\\'
  ),
  candidate_dossiers AS MATERIALIZED (
    SELECT
      d.id,
      d.device_type_name,
      d.name,
      d.description,
      d.revision,
      d.archived_at,
      d.archived_by,
      d.created_at,
      d.created_by,
      d.updated_at,
      d.updated_by
    FROM public.technical_configuration_dossiers d
    WHERE (p_include_archived OR d.archived_at IS NULL)
      AND (
        v_normalized_search IS NULL
        OR EXISTS (
          SELECT 1
          FROM candidate_ids candidate
          WHERE candidate.id = d.id
        )
      )
  ),
  filtered_dossiers AS MATERIALIZED (
    SELECT
      d.*,
      CASE
        WHEN v_normalized_search IS NULL THEN 0
        WHEN public._normalize_search_text(d.name) = v_normalized_search
          OR public._normalize_search_text(d.device_type_name) = v_normalized_search THEN 0
        WHEN public._normalize_search_text(d.name) LIKE public._sanitize_ilike_pattern(v_normalized_search) || '%' ESCAPE E'\\'
          OR public._normalize_search_text(d.device_type_name) LIKE public._sanitize_ilike_pattern(v_normalized_search) || '%' ESCAPE E'\\' THEN 1
        ELSE 2
      END AS search_rank
    FROM candidate_dossiers d
    WHERE (
      v_normalized_search IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM search_tokens search_token
        WHERE public._normalize_search_text(d.name)
            NOT LIKE '%' || public._sanitize_ilike_pattern(search_token.token) || '%' ESCAPE E'\\'
          AND public._normalize_search_text(d.device_type_name)
            NOT LIKE '%' || public._sanitize_ilike_pattern(search_token.token) || '%' ESCAPE E'\\'
      )
    )
  ),
  dossier_page AS MATERIALIZED (
    SELECT filtered.*
    FROM filtered_dossiers filtered
    ORDER BY filtered.search_rank, filtered.updated_at DESC, filtered.id
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  ),
  locked_dossiers AS (
    SELECT DISTINCT v.dossier_id
    FROM public.technical_configuration_baseline_versions v
    JOIN dossier_page page
      ON page.id = v.dossier_id
    WHERE v.status = 'locked'
  ),
  paged AS (
    SELECT
      page.*,
      (
        page.archived_at IS NULL
        AND locked.dossier_id IS NULL
      ) AS can_delete
    FROM dossier_page page
    LEFT JOIN locked_dossiers locked
      ON locked.dossier_id = page.id
  )
  SELECT jsonb_build_object(
    'data',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'device_type_name', p.device_type_name,
            'name', p.name,
            'description', p.description,
            'revision', p.revision,
            'archived_at', p.archived_at,
            'archived_by', p.archived_by,
            'created_at', p.created_at,
            'created_by', p.created_by,
            'updated_at', p.updated_at,
            'updated_by', p.updated_by,
            'can_delete', p.can_delete
          )
          ORDER BY p.search_rank, p.updated_at DESC, p.id
        )
        FROM paged p
      ),
      '[]'::JSONB
    ),
    'total',
    (
      SELECT count(*)
      FROM filtered_dossiers
    ),
    'page',
    p_page,
    'page_size',
    p_page_size
  )
  INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.technical_configuration_dossiers_list(
  INTEGER, INTEGER, BOOLEAN, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_dossiers_list(
  INTEGER, INTEGER, BOOLEAN, TEXT
) TO authenticated;

CREATE INDEX technical_configuration_dossiers_name_search_trgm_idx
  ON public.technical_configuration_dossiers
  USING GIN (
    (public._normalize_search_text(name)) extensions.gin_trgm_ops
  );

CREATE INDEX technical_configuration_dossiers_device_type_search_trgm_idx
  ON public.technical_configuration_dossiers
  USING GIN (
    (public._normalize_search_text(device_type_name)) extensions.gin_trgm_ops
  );

REVOKE ALL ON FUNCTION public._normalize_search_text(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

-- One- and two-character tokens may use a sequential scan; matching remains correct.

COMMIT;

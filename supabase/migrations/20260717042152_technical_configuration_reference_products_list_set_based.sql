BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_reference_products_list(
  p_baseline_version_id UUID,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_revision BIGINT;
  v_total BIGINT;
  v_data JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  IF p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT v.revision INTO v_revision
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_baseline_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.technical_configuration_reference_products p
  WHERE p.baseline_version_id = p_baseline_version_id;

  WITH page AS (
    SELECT
      p.id,
      p.baseline_version_id,
      p.model,
      p.manufacturer,
      p.description,
      p.notes,
      p.created_at,
      p.created_by,
      p.updated_at,
      p.updated_by
    FROM public.technical_configuration_reference_products p
    WHERE p.baseline_version_id = p_baseline_version_id
    ORDER BY p.created_at, p.id
    LIMIT p_page_size
    OFFSET (p_page - 1) * p_page_size
  ),
  responses_by_product AS (
    SELECT
      r.reference_product_id,
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'baseline_version_id', r.baseline_version_id,
          'reference_product_id', r.reference_product_id,
          'criterion_id', r.criterion_id,
          'response_text', r.response_text,
          'created_at', r.created_at,
          'created_by', r.created_by,
          'updated_at', r.updated_at,
          'updated_by', r.updated_by,
          'revision', v_revision
        )
        ORDER BY c.sort_order, c.id
      ) AS responses
    FROM public.technical_configuration_reference_responses r
    JOIN public.technical_configuration_baseline_criteria c
      ON c.id = r.criterion_id
     AND c.baseline_version_id = r.baseline_version_id
    JOIN page page_product
      ON page_product.id = r.reference_product_id
    GROUP BY r.reference_product_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', page.id,
        'baseline_version_id', page.baseline_version_id,
        'model', page.model,
        'manufacturer', page.manufacturer,
        'description', page.description,
        'notes', page.notes,
        'created_at', page.created_at,
        'created_by', page.created_by,
        'updated_at', page.updated_at,
        'updated_by', page.updated_by,
        'revision', v_revision,
        'responses', COALESCE(responses.responses, '[]'::JSONB)
      )
      ORDER BY page.created_at, page.id
    ),
    '[]'::JSONB
  )
  INTO v_data
  FROM page
  LEFT JOIN responses_by_product responses
    ON responses.reference_product_id = page.id;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_reference_products_list(
  UUID,
  INTEGER,
  INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_products_list(
  UUID,
  INTEGER,
  INTEGER
) TO authenticated;

COMMIT;

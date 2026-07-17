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
  v_result JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  IF p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  WITH baseline AS MATERIALIZED (
    SELECT v.revision
    FROM public.technical_configuration_baseline_versions v
    WHERE v.id = p_baseline_version_id
  ),
  snapshot AS MATERIALIZED (
    SELECT
      baseline.revision,
      (
        SELECT count(*)
        FROM public.technical_configuration_reference_products product_count
        WHERE product_count.baseline_version_id = p_baseline_version_id
      ) AS total
    FROM baseline
  ),
  page AS MATERIALIZED (
    SELECT
      product.id,
      product.baseline_version_id,
      product.model,
      product.manufacturer,
      product.description,
      product.notes,
      product.created_at,
      product.created_by,
      product.updated_at,
      product.updated_by,
      snapshot.revision
    FROM public.technical_configuration_reference_products product
    CROSS JOIN snapshot
    WHERE product.baseline_version_id = p_baseline_version_id
    ORDER BY product.created_at, product.id
    LIMIT p_page_size
    OFFSET (p_page::BIGINT - 1) * p_page_size
  ),
  responses_by_product AS (
    SELECT
      response.reference_product_id,
      jsonb_agg(
        jsonb_build_object(
          'id', response.id,
          'baseline_version_id', response.baseline_version_id,
          'reference_product_id', response.reference_product_id,
          'criterion_id', response.criterion_id,
          'response_text', response.response_text,
          'created_at', response.created_at,
          'created_by', response.created_by,
          'updated_at', response.updated_at,
          'updated_by', response.updated_by,
          'revision', page_product.revision
        )
        ORDER BY criterion.sort_order, criterion.id
      ) AS responses
    FROM public.technical_configuration_reference_responses response
    JOIN public.technical_configuration_baseline_criteria criterion
      ON criterion.id = response.criterion_id
     AND criterion.baseline_version_id = response.baseline_version_id
    JOIN page page_product
      ON page_product.id = response.reference_product_id
    GROUP BY response.reference_product_id
  ),
  data AS (
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
          'revision', page.revision,
          'responses', COALESCE(responses.responses, '[]'::JSONB)
        )
        ORDER BY page.created_at, page.id
      ),
      '[]'::JSONB
    ) AS products
    FROM page
    LEFT JOIN responses_by_product responses
      ON responses.reference_product_id = page.id
  )
  SELECT jsonb_build_object(
    'data', data.products,
    'revision', snapshot.revision,
    'total', snapshot.total,
    'page', p_page,
    'page_size', p_page_size
  )
  INTO v_result
  FROM snapshot
  CROSS JOIN data;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  RETURN v_result;
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

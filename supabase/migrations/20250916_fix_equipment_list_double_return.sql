-- Fix equipment_list function: when global role with tenant filter, only return filtered results
-- The issue was that both RETURN QUERY statements were executing, adding unfiltered results after filtered ones

CREATE OR REPLACE FUNCTION public.equipment_list(
  p_q TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'id.asc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_donvi BIGINT := NULL;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_offset INT;
BEGIN
  v_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE LOWER(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN ('id','ten_thiet_bi','ma_thiet_bi','khoa_phong_quan_ly','don_vi') THEN
    v_sort_col := 'id';
  END IF;
  v_offset := GREATEST((p_page - 1), 0) * GREATEST(p_page_size, 1);

  IF v_role = 'global' THEN
    -- Allow cross-tenant filter when provided
    IF p_don_vi IS NOT NULL THEN
      RETURN QUERY EXECUTE format(
        'SELECT * FROM public.thiet_bi
         WHERE don_vi = $5 AND ($1 IS NULL OR ten_thiet_bi ILIKE $4 OR ma_thiet_bi ILIKE $4)
         ORDER BY %I %s OFFSET $2 LIMIT $3',
         v_sort_col, v_sort_dir
      ) USING p_q, v_offset, p_page_size, ('%' || p_q || '%'), p_don_vi;
      RETURN; -- CRITICAL FIX: Exit here to prevent executing the unfiltered query below
    END IF;
    
    -- For global role without tenant filter, return all equipment
    RETURN QUERY EXECUTE format(
      'SELECT * FROM public.thiet_bi
       WHERE ($1 IS NULL OR ten_thiet_bi ILIKE $4 OR ma_thiet_bi ILIKE $4)
       ORDER BY %I %s OFFSET $2 LIMIT $3',
       v_sort_col, v_sort_dir
    ) USING p_q, v_offset, p_page_size, ('%' || p_q || '%');
  ELSE
    -- Non-global roles: restrict to their own tenant
    RETURN QUERY EXECUTE format(
      'SELECT * FROM public.thiet_bi
       WHERE don_vi = $5 AND ($1 IS NULL OR ten_thiet_bi ILIKE $4 OR ma_thiet_bi ILIKE $4)
       ORDER BY %I %s OFFSET $2 LIMIT $3',
       v_sort_col, v_sort_dir
    ) USING p_q, v_offset, p_page_size, ('%' || p_q || '%'), v_donvi;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_list(TEXT, TEXT, INT, INT, BIGINT) TO authenticated;
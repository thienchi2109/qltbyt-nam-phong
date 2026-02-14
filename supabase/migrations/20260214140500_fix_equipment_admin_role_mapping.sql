-- Migration: Fix inconsistent admin → global role mapping in equipment functions
-- Date: 2026-02-14
-- Issue: equipment_get, equipment_list, equipment_count treat admin as tenant-scoped
--        while equipment_get_by_code correctly maps admin → global
-- Fix: Add admin → global mapping to all three functions for consistency

BEGIN;

-- ============================================================================
-- Fix equipment_get
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_get(p_id bigint)
RETURNS thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  rec public.thiet_bi;
BEGIN
  -- Map admin → global for consistency with equipment_get_by_code
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = 'global' THEN
    SELECT * INTO rec
    FROM public.thiet_bi
    WHERE id = p_id
      AND is_deleted = false;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO rec
    FROM public.thiet_bi
    WHERE id = p_id
      AND don_vi = ANY(v_allowed)
      AND is_deleted = false;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
  END IF;

  RETURN rec;
END;
$function$;

-- ============================================================================
-- Fix equipment_list
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_list(
  p_q text DEFAULT NULL::text,
  p_sort text DEFAULT 'id.asc'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_don_vi bigint DEFAULT NULL::bigint
)
RETURNS SETOF thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_sql TEXT;
BEGIN
  -- Map admin → global for consistency
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE LOWER(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN (
    'id','ten_thiet_bi','ma_thiet_bi','khoa_phong_quan_ly','don_vi','tinh_trang_hien_tai','phan_loai_theo_nd98','model','serial'
  ) THEN
    v_sort_col := 'id';
  END IF;

  v_sql := 'SELECT * FROM public.thiet_bi WHERE is_deleted = false';
  IF v_effective IS NOT NULL THEN
    v_sql := v_sql || format(' AND don_vi = ANY(%L::BIGINT[])', v_effective);
  END IF;

  IF p_q IS NOT NULL AND trim(p_q) <> '' THEN
    v_sql := v_sql || format(' AND (ten_thiet_bi ILIKE %L OR ma_thiet_bi ILIKE %L)',
      '%' || p_q || '%', '%' || p_q || '%');
  END IF;

  v_sql := v_sql || format(' ORDER BY %I %s OFFSET %s LIMIT %s', v_sort_col, v_sort_dir, v_offset, GREATEST(p_page_size, 1));

  RETURN QUERY EXECUTE v_sql;
END;
$function$;

-- ============================================================================
-- Fix equipment_count
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_count(
  p_statuses text[] DEFAULT NULL::text[],
  p_q text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_cnt BIGINT;
BEGIN
  -- Map admin → global for consistency
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = 'global' THEN
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  ELSE
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.don_vi = v_donvi
      AND tb.is_deleted = false
      AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  END IF;
  RETURN COALESCE(v_cnt, 0);
END;
$function$;

COMMIT;

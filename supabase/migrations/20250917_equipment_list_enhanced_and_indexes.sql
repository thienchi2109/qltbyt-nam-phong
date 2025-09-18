-- Migration: equipment_list_enhanced and performance indexes
-- Date: 2025-09-17
-- Notes:
-- - Idempotent by using IF NOT EXISTS and CREATE OR REPLACE FUNCTION
-- - Author applies via Supabase SQL editor; commit for history only

-- 1) Performance indexes for common filter/search patterns
DO $$
BEGIN
  -- Composite: tenant + status + department
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_thiet_bi_tenant_status_dept' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_thiet_bi_tenant_status_dept
      ON public.thiet_bi (don_vi, tinh_trang_hien_tai, khoa_phong_quan_ly);
  END IF;

  -- Full-text-ish search on name + code (simple dictionary)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_thiet_bi_search' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_thiet_bi_search
      ON public.thiet_bi
      USING GIN (
        to_tsvector('simple', coalesce(ten_thiet_bi,'') || ' ' || coalesce(ma_thiet_bi,''))
      );
  END IF;

  -- Optional: upcoming maintenance date by tenant (useful for attention lists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_thiet_bi_tenant_next_bt' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_thiet_bi_tenant_next_bt
      ON public.thiet_bi (don_vi, ngay_bt_tiep_theo);
  END IF;
END $$;

-- 2) Enhanced, paginated equipment list RPC returning JSONB with data + total
-- Signature keeps tenant isolation aligned with JWT claims via public._get_jwt_claim
-- Fixed function: move INTO before USING and small safety tweaks
CREATE OR REPLACE FUNCTION public.equipment_list_enhanced(
  p_q TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'id.asc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL,
  p_tinh_trang TEXT DEFAULT NULL,
  p_phan_loai TEXT DEFAULT NULL,
  p_fields TEXT DEFAULT 'id,ma_thiet_bi,ten_thiet_bi,model,serial,khoa_phong_quan_ly,tinh_trang_hien_tai,vi_tri_lap_dat,nguoi_dang_truc_tiep_quan_ly,phan_loai_theo_nd98'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := '';
  v_claim_donvi BIGINT := NULL;
  v_effective_donvi BIGINT := NULL;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_limit INT := GREATEST(p_page_size, 1);
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_where TEXT := '1=1';
  v_params TEXT[] := ARRAY[]::TEXT[];
  v_sql TEXT;
  v_cnt_sql TEXT;
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
  i INT;
  v_tmp_sql TEXT;
BEGIN
  v_role := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;

  IF lower(v_role) = 'global' THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE LOWER(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN (
    'id','ten_thiet_bi','ma_thiet_bi','khoa_phong_quan_ly','don_vi','tinh_trang_hien_tai','phan_loai_theo_nd98','model','serial'
  ) THEN
    v_sort_col := 'id';
  END IF;

  IF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ($' || (array_length(v_params, 1) + 1) || ')::bigint';
    v_params := array_append(v_params, v_effective_donvi::text);
  END IF;

  IF p_khoa_phong IS NOT NULL THEN
    v_where := v_where || ' AND khoa_phong_quan_ly = $' || (array_length(v_params, 1) + 1);
    v_params := array_append(v_params, p_khoa_phong);
  END IF;

  IF p_tinh_trang IS NOT NULL THEN
    v_where := v_where || ' AND tinh_trang_hien_tai = $' || (array_length(v_params, 1) + 1);
    v_params := array_append(v_params, p_tinh_trang);
  END IF;

  IF p_phan_loai IS NOT NULL THEN
    v_where := v_where || ' AND phan_loai_theo_nd98 = $' || (array_length(v_params, 1) + 1);
    v_params := array_append(v_params, p_phan_loai);
  END IF;

  IF p_q IS NOT NULL AND length(trim(p_q)) > 0 THEN
    v_where := v_where || ' AND (ten_thiet_bi ILIKE $' || (array_length(v_params, 1) + 1) ||
              ' OR ma_thiet_bi ILIKE $' || (array_length(v_params, 1) + 2) || ')';
    v_params := array_append(v_params, '%'||p_q||'%');
    v_params := array_append(v_params, '%'||p_q||'%');
  END IF;

  v_cnt_sql := format('SELECT count(*) FROM public.thiet_bi WHERE %s', v_where);

  -- Safe parameter expansion: replace $1, $2, ... with properly quoted literals
  v_tmp_sql := v_cnt_sql;
  FOR i IN 1..COALESCE(array_length(v_params,1),0) LOOP
    v_tmp_sql := replace(v_tmp_sql, '$' || i, quote_nullable(v_params[i]));
  END LOOP;
  EXECUTE v_tmp_sql INTO v_total;

  WITH allowed AS (
    SELECT unnest(ARRAY[
      'id','ma_thiet_bi','ten_thiet_bi','model','serial','khoa_phong_quan_ly','tinh_trang_hien_tai',
      'vi_tri_lap_dat','nguoi_dang_truc_tiep_quan_ly','phan_loai_theo_nd98','don_vi',
      'gia_goc','ngay_nhap','ngay_dua_vao_su_dung','han_bao_hanh'
    ]) AS col
  )
  SELECT string_agg(col, ',') FROM (
    SELECT col FROM allowed WHERE col = ANY(string_to_array(p_fields, ',')::text[])
  ) s INTO v_sql;

  IF v_sql IS NULL OR length(v_sql) = 0 THEN
    v_sql := 'id,ma_thiet_bi,ten_thiet_bi,model,serial,khoa_phong_quan_ly,tinh_trang_hien_tai,vi_tri_lap_dat,nguoi_dang_truc_tiep_quan_ly,phan_loai_theo_nd98';
  END IF;

  v_sql := format(
    'SELECT jsonb_agg(t) FROM (
       SELECT %s FROM public.thiet_bi
       WHERE %s
       ORDER BY %I %s
       OFFSET %s LIMIT %s
     ) t',
    v_sql, v_where, v_sort_col, v_sort_dir, v_offset, v_limit
  );

  v_tmp_sql := v_sql;
  FOR i IN 1..COALESCE(array_length(v_params,1),0) LOOP
    v_tmp_sql := replace(v_tmp_sql, '$' || i, quote_nullable(v_params[i]));
  END LOOP;
  EXECUTE v_tmp_sql INTO v_data;
  v_data := COALESCE(v_data, '[]'::jsonb);

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size
  );
END;
$$;
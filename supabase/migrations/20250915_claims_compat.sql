-- Make SQL functions read application role from 'app_role' claim, fallback to 'role'
-- so we can set DB role via 'role'='authenticated' safely.

BEGIN;

-- equipment_list
CREATE OR REPLACE FUNCTION public.equipment_list(
  p_q TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'id.asc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50
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
    RETURN QUERY EXECUTE format(
      'SELECT * FROM public.thiet_bi
       WHERE ($1 IS NULL OR ten_thiet_bi ILIKE $4 OR ma_thiet_bi ILIKE $4)
       ORDER BY %I %s OFFSET $2 LIMIT $3',
       v_sort_col, v_sort_dir
    ) USING p_q, v_offset, p_page_size, ('%' || p_q || '%');
  ELSE
    RETURN QUERY EXECUTE format(
      'SELECT * FROM public.thiet_bi
       WHERE don_vi = $5 AND ($1 IS NULL OR ten_thiet_bi ILIKE $4 OR ma_thiet_bi ILIKE $4)
       ORDER BY %I %s OFFSET $2 LIMIT $3',
       v_sort_col, v_sort_dir
    ) USING p_q, v_offset, p_page_size, ('%' || p_q || '%'), v_donvi;
  END IF;
END;
$$;

-- equipment_get
CREATE OR REPLACE FUNCTION public.equipment_get(p_id BIGINT)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  rec public.thiet_bi;
BEGIN
  IF v_role = 'global' THEN
    SELECT * INTO rec FROM public.thiet_bi WHERE id = p_id;
  ELSE
    SELECT * INTO rec FROM public.thiet_bi WHERE id = p_id AND don_vi = v_donvi;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '22023';
  END IF;
  RETURN rec;
END;
$$;

-- equipment_create
CREATE OR REPLACE FUNCTION public.equipment_create(p_payload JSONB)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_khoa_phong TEXT := NULL; -- from payload
  rec public.thiet_bi;
BEGIN
  IF v_role NOT IN ('global','to_qltb','technician') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  v_khoa_phong := COALESCE(p_payload->>'khoa_phong_quan_ly', NULL);

  IF v_role = 'technician' THEN
    PERFORM 1 FROM public.nhan_vien nv WHERE nv.id = (public._get_jwt_claim('user_id'))::BIGINT AND nv.khoa_phong = v_khoa_phong;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician department mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.thiet_bi (
    ten_thiet_bi, ma_thiet_bi, khoa_phong_quan_ly, don_vi
  )
  VALUES (
    p_payload->>'ten_thiet_bi',
    p_payload->>'ma_thiet_bi',
    v_khoa_phong,
    v_donvi
  )
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;

-- equipment_update
CREATE OR REPLACE FUNCTION public.equipment_update(p_id BIGINT, p_patch JSONB)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_khoa_phong_new TEXT := COALESCE(p_patch->>'khoa_phong_quan_ly', NULL);
  rec public.thiet_bi;
BEGIN
  IF v_role <> 'global' THEN
    PERFORM 1 FROM public.thiet_bi WHERE id = p_id AND don_vi = v_donvi;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Access denied for update' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_role = 'technician' AND v_khoa_phong_new IS NOT NULL THEN
    PERFORM 1 FROM public.nhan_vien nv WHERE nv.id = (public._get_jwt_claim('user_id'))::BIGINT AND nv.khoa_phong = v_khoa_phong_new;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician department mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.thiet_bi tb SET
    ten_thiet_bi = COALESCE(p_patch->>'ten_thiet_bi', tb.ten_thiet_bi),
    ma_thiet_bi = COALESCE(p_patch->>'ma_thiet_bi', tb.ma_thiet_bi),
    khoa_phong_quan_ly = COALESCE(p_patch->>'khoa_phong_quan_ly', tb.khoa_phong_quan_ly)
  WHERE tb.id = p_id
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;

-- equipment_delete
CREATE OR REPLACE FUNCTION public.equipment_delete(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  cnt INT;
BEGIN
  IF v_role = 'technician' OR v_role = 'user' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    SELECT COUNT(*) INTO cnt FROM public.thiet_bi WHERE id = p_id AND don_vi = v_donvi;
    IF cnt = 0 THEN
      RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.thiet_bi WHERE id = p_id;
  RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;

-- equipment_count
CREATE OR REPLACE FUNCTION public.equipment_count(
  p_statuses TEXT[] DEFAULT NULL,
  p_q TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_cnt BIGINT;
BEGIN
  IF v_role = 'global' THEN
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  ELSE
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.don_vi = v_donvi
      AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  END IF;
  RETURN COALESCE(v_cnt, 0);
END;
$$;

-- equipment_attention_list
CREATE OR REPLACE FUNCTION public.equipment_attention_list(
  p_limit INT DEFAULT 5
)
RETURNS SETOF public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
BEGIN
  IF v_role = 'global' THEN
    RETURN QUERY
    SELECT *
    FROM public.thiet_bi tb
    WHERE tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
    ORDER BY tb.ngay_bt_tiep_theo ASC NULLS LAST
    LIMIT GREATEST(p_limit, 1);
  ELSE
    RETURN QUERY
    SELECT *
    FROM public.thiet_bi tb
    WHERE tb.don_vi = v_donvi
      AND tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
    ORDER BY tb.ngay_bt_tiep_theo ASC NULLS LAST
    LIMIT GREATEST(p_limit, 1);
  END IF;
END;
$$;

COMMIT;

-- supabase/tests/equipment_soft_delete_historical_reads_smoke.sql
-- Purpose: verify historical RPCs keep working after equipment soft-delete
-- Non-destructive: wrapped in transaction and rolled back

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_equipment_id bigint;
  v_repair_id bigint;
  v_history_id bigint;
  v_usage_id bigint;
  v_repair_payload jsonb;
  v_transfer_payload jsonb;
  v_transfer_enhanced jsonb;
  v_usage_new jsonb;
  v_usage_legacy jsonb;
  v_history_count integer;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Historical Tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-HIST-' || v_suffix,
    'Smoke Historical Equipment ' || v_suffix,
    v_tenant,
    'Khoa smoke lịch sử',
    'Hoạt động',
    false
  )
  RETURNING id INTO v_equipment_id;

  SELECT COALESCE(MAX(id), 0) + 1 INTO v_repair_id
  FROM public.yeu_cau_sua_chua;

  INSERT INTO public.yeu_cau_sua_chua(
    id,
    thiet_bi_id,
    mo_ta_su_co,
    hang_muc_sua_chua,
    trang_thai,
    ngay_yeu_cau
  )
  VALUES (
    v_repair_id,
    v_equipment_id,
    'Smoke sửa chữa ' || v_suffix,
    'Hạng mục smoke',
    'Chờ xử lý',
    now()
  );

  INSERT INTO public.yeu_cau_luan_chuyen(
    ma_yeu_cau,
    thiet_bi_id,
    loai_hinh,
    trang_thai,
    ly_do_luan_chuyen,
    created_at
  )
  VALUES (
    'YCLC-SMK-' || v_suffix,
    v_equipment_id,
    'noi_bo',
    'cho_duyet',
    'Smoke luân chuyển ' || v_suffix,
    now()
  );

  SELECT COALESCE(MAX(id), 0) + 1 INTO v_history_id
  FROM public.lich_su_thiet_bi;

  INSERT INTO public.lich_su_thiet_bi(
    id,
    thiet_bi_id,
    ngay_thuc_hien,
    loai_su_kien,
    mo_ta
  )
  VALUES (
    v_history_id,
    v_equipment_id,
    now(),
    'ghi_nhan',
    'Smoke lịch sử ' || v_suffix
  );

  INSERT INTO public.nhat_ky_su_dung(
    thiet_bi_id,
    thoi_gian_bat_dau,
    trang_thai,
    ghi_chu
  )
  VALUES (
    v_equipment_id,
    now() - interval '1 hour',
    'dang_su_dung',
    'Smoke usage ' || v_suffix
  )
  RETURNING id INTO v_usage_id;

  UPDATE public.thiet_bi
  SET is_deleted = true
  WHERE id = v_equipment_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', '1',
      'sub', '1',
      'don_vi', null
    )::text,
    true
  );

  SELECT COUNT(*)
  INTO v_history_count
  FROM public.equipment_history_list(v_equipment_id::integer);

  IF v_history_count < 1 THEN
    RAISE EXCEPTION 'equipment_history_list should keep historical rows after soft-delete';
  END IF;

  SELECT public.repair_request_list(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 20,
    p_don_vi => v_tenant
  )
  INTO v_repair_payload;

  IF COALESCE((v_repair_payload->>'total')::integer, 0) < 1 THEN
    RAISE EXCEPTION 'repair_request_list returned no rows for soft-deleted equipment';
  END IF;

  IF (v_repair_payload->'data'->0->>'equipment_is_deleted')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'repair_request_list must expose equipment_is_deleted=true';
  END IF;

  SELECT public.transfer_request_list(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 20,
    p_don_vi => v_tenant,
    p_view_mode => 'table'
  )
  INTO v_transfer_payload;

  IF COALESCE((v_transfer_payload->>'total')::integer, 0) < 1 THEN
    RAISE EXCEPTION 'transfer_request_list returned no rows for soft-deleted equipment';
  END IF;

  IF (v_transfer_payload->'data'->0->>'equipment_is_deleted')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'transfer_request_list must expose equipment_is_deleted=true';
  END IF;

  SELECT t
  INTO v_transfer_enhanced
  FROM public.transfer_request_list_enhanced(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 20,
    p_don_vi => v_tenant
  ) AS t
  LIMIT 1;

  IF v_transfer_enhanced IS NULL THEN
    RAISE EXCEPTION 'transfer_request_list_enhanced returned no rows for soft-deleted equipment';
  END IF;

  IF (v_transfer_enhanced->>'equipment_is_deleted')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'transfer_request_list_enhanced must expose equipment_is_deleted=true';
  END IF;

  SELECT t
  INTO v_usage_new
  FROM public.usage_log_list(
    p_thiet_bi_id => v_equipment_id,
    p_limit => 10,
    p_offset => 0,
    p_don_vi => v_tenant
  ) AS t
  LIMIT 1;

  IF v_usage_new IS NULL THEN
    RAISE EXCEPTION 'usage_log_list(new signature) returned no rows for soft-deleted equipment';
  END IF;

  IF (v_usage_new->>'equipment_is_deleted')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'usage_log_list(new signature) must expose equipment_is_deleted=true';
  END IF;

  SELECT t
  INTO v_usage_legacy
  FROM public.usage_log_list(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 20,
    p_don_vi => v_tenant
  ) AS t
  LIMIT 1;

  IF v_usage_legacy IS NULL THEN
    RAISE EXCEPTION 'usage_log_list(legacy signature) returned no rows for soft-deleted equipment';
  END IF;

  IF (v_usage_legacy->>'equipment_is_deleted')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'usage_log_list(legacy signature) must expose equipment_is_deleted=true';
  END IF;

  RAISE NOTICE 'OK: historical read smoke checks passed';
END $$;

ROLLBACK;

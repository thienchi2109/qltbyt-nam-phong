-- supabase/tests/repair_request_equipment_status_invariant_smoke.sql
-- Purpose: lock the equipment-status invariant for repair-request lifecycle flows.
-- How to run (psql): psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repair_request_equipment_status_invariant_smoke.sql
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._rr_status_set_claims(
  p_role text,
  p_user_id bigint,
  p_don_vi bigint
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', p_role,
      'role', 'authenticated',
      'user_id', p_user_id::text,
      'sub', p_user_id::text,
      'don_vi', p_don_vi::text
    )::text,
    true
  );
END;
$$;

-- 1) Repro the current production bug:
-- complete request A -> equipment becomes Hoạt động
-- create request B -> equipment becomes Chờ sửa chữa
-- delete request B -> equipment should return to Hoạt động
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_equipment_id bigint;
  v_request_a bigint;
  v_request_b bigint;
  v_status_after_complete text;
  v_status_after_delete_b text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair status invariant tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_status_invariant_' || v_suffix,
    'smoke-password',
    'Repair Status Invariant',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai)
  VALUES (
    'RR-STATUS-' || v_suffix,
    'Repair status invariant equipment ' || v_suffix,
    v_tenant,
    'Hoạt động'
  )
  RETURNING id INTO v_equipment_id;

  PERFORM pg_temp._rr_status_set_claims('to_qltb', v_user_id, v_tenant);

  v_request_a := public.repair_request_create(
    v_equipment_id::integer,
    'Request A',
    'Scope A',
    CURRENT_DATE + 7,
    'Requester A',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_approve(
    v_request_a::integer,
    'Approver A',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_complete(
    v_request_a::integer,
    'Completed A successfully',
    NULL,
    NULL
  );

  SELECT tb.tinh_trang_hien_tai
  INTO v_status_after_complete
  FROM public.thiet_bi tb
  WHERE tb.id = v_equipment_id;

  IF v_status_after_complete IS DISTINCT FROM 'Hoạt động' THEN
    RAISE EXCEPTION
      'Setup failed: after completing request A expected Hoạt động, got %',
      v_status_after_complete;
  END IF;

  v_request_b := public.repair_request_create(
    v_equipment_id::integer,
    'Request B',
    'Scope B',
    CURRENT_DATE + 14,
    'Requester B',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_delete(v_request_b::integer);

  SELECT tb.tinh_trang_hien_tai
  INTO v_status_after_delete_b
  FROM public.thiet_bi tb
  WHERE tb.id = v_equipment_id;

  IF v_status_after_delete_b IS DISTINCT FROM 'Hoạt động' THEN
    RAISE EXCEPTION
      'Invariant failed: after deleting request B expected Hoạt động, got %',
      v_status_after_delete_b;
  END IF;

  RAISE NOTICE 'OK: completed repair survives later request delete';
END $$;

-- 2) Deleting a newer request must not clear Chờ sửa chữa when another open
-- repair request for the same equipment still exists.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_equipment_id bigint;
  v_request_a bigint;
  v_request_b bigint;
  v_status_after_delete_b text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair status sibling tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_status_sibling_' || v_suffix,
    'smoke-password',
    'Repair Status Sibling',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai)
  VALUES (
    'RR-SIBLING-' || v_suffix,
    'Repair status sibling equipment ' || v_suffix,
    v_tenant,
    'Hoạt động'
  )
  RETURNING id INTO v_equipment_id;

  PERFORM pg_temp._rr_status_set_claims('to_qltb', v_user_id, v_tenant);

  v_request_a := public.repair_request_create(
    v_equipment_id::integer,
    'Request A still open',
    'Scope A still open',
    CURRENT_DATE + 7,
    'Requester A',
    'noi_bo',
    NULL
  );

  v_request_b := public.repair_request_create(
    v_equipment_id::integer,
    'Request B deleted',
    'Scope B deleted',
    CURRENT_DATE + 8,
    'Requester B',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_delete(v_request_b::integer);

  SELECT tb.tinh_trang_hien_tai
  INTO v_status_after_delete_b
  FROM public.thiet_bi tb
  WHERE tb.id = v_equipment_id;

  IF v_status_after_delete_b IS DISTINCT FROM 'Chờ sửa chữa' THEN
    RAISE EXCEPTION
      'Invariant failed: deleting request B while request A is open should keep Chờ sửa chữa, got %',
      v_status_after_delete_b;
  END IF;

  PERFORM public.repair_request_delete(v_request_a::integer);

  RAISE NOTICE 'OK: sibling open repair keeps Chờ sửa chữa';
END $$;

-- 3) Deleting the only repair request should restore the equipment status that
-- existed before the request changed it to Chờ sửa chữa.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_equipment_id bigint;
  v_request_id bigint;
  v_status_after_create text;
  v_status_after_delete text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair status restore tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_status_restore_' || v_suffix,
    'smoke-password',
    'Repair Status Restore',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai)
  VALUES (
    'RR-RESTORE-' || v_suffix,
    'Repair status restore equipment ' || v_suffix,
    v_tenant,
    'Ngưng sử dụng'
  )
  RETURNING id INTO v_equipment_id;

  PERFORM pg_temp._rr_status_set_claims('to_qltb', v_user_id, v_tenant);

  v_request_id := public.repair_request_create(
    v_equipment_id::integer,
    'Request restore baseline',
    'Restore baseline scope',
    CURRENT_DATE + 7,
    'Requester restore',
    'noi_bo',
    NULL
  );

  SELECT tb.tinh_trang_hien_tai
  INTO v_status_after_create
  FROM public.thiet_bi tb
  WHERE tb.id = v_equipment_id;

  IF v_status_after_create IS DISTINCT FROM 'Chờ sửa chữa' THEN
    RAISE EXCEPTION
      'Setup failed: creating the request should set Chờ sửa chữa, got %',
      v_status_after_create;
  END IF;

  PERFORM public.repair_request_delete(v_request_id::integer);

  SELECT tb.tinh_trang_hien_tai
  INTO v_status_after_delete
  FROM public.thiet_bi tb
  WHERE tb.id = v_equipment_id;

  IF v_status_after_delete IS DISTINCT FROM 'Ngưng sử dụng' THEN
    RAISE EXCEPTION
      'Invariant failed: deleting the only request should restore Ngưng sử dụng, got %',
      v_status_after_delete;
  END IF;

  RAISE NOTICE 'OK: delete restores pre-request equipment status';
END $$;

-- 4) A failed repair should leave the device in Chờ sửa chữa, but deleting that
-- failed request later must restore Hoạt động when the latest surviving request
-- on the equipment is a completed repair.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_equipment_id bigint;
  v_request_a bigint;
  v_request_b bigint;
  v_status_after_failed_b text;
  v_status_after_delete_b text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair status failed tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_status_failed_' || v_suffix,
    'smoke-password',
    'Repair Status Failed',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai)
  VALUES (
    'RR-FAILED-' || v_suffix,
    'Repair status failed equipment ' || v_suffix,
    v_tenant,
    'Hoạt động'
  )
  RETURNING id INTO v_equipment_id;

  PERFORM pg_temp._rr_status_set_claims('to_qltb', v_user_id, v_tenant);

  v_request_a := public.repair_request_create(
    v_equipment_id::integer,
    'Completed request A',
    'Completed scope A',
    CURRENT_DATE + 7,
    'Requester A',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_approve(
    v_request_a::integer,
    'Approver A',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_complete(
    v_request_a::integer,
    'Completed request A successfully',
    NULL,
    NULL
  );

  v_request_b := public.repair_request_create(
    v_equipment_id::integer,
    'Failed request B',
    'Failed scope B',
    CURRENT_DATE + 8,
    'Requester B',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_approve(
    v_request_b::integer,
    'Approver B',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_complete(
    v_request_b::integer,
    NULL,
    'Thiếu vật tư thay thế',
    NULL
  );

  SELECT tb.tinh_trang_hien_tai
  INTO v_status_after_failed_b
  FROM public.thiet_bi tb
  WHERE tb.id = v_equipment_id;

  IF v_status_after_failed_b IS DISTINCT FROM 'Chờ sửa chữa' THEN
    RAISE EXCEPTION
      'Setup failed: failed repair B should leave Chờ sửa chữa, got %',
      v_status_after_failed_b;
  END IF;

  PERFORM public.repair_request_delete(v_request_b::integer);

  SELECT tb.tinh_trang_hien_tai
  INTO v_status_after_delete_b
  FROM public.thiet_bi tb
  WHERE tb.id = v_equipment_id;

  IF v_status_after_delete_b IS DISTINCT FROM 'Hoạt động' THEN
    RAISE EXCEPTION
      'Invariant failed: deleting failed request B should restore Hoạt động from completed request A, got %',
      v_status_after_delete_b;
  END IF;

  RAISE NOTICE 'OK: failed repair delete restores latest completed status';
END $$;

-- 5) Deleting requests in FIFO order must still restore the original equipment
-- status carried by the repair cluster, not the intermediate Chờ sửa chữa state.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_equipment_id bigint;
  v_request_a bigint;
  v_request_b bigint;
  v_status_after_delete_a text;
  v_status_after_delete_b text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair status fifo tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_status_fifo_' || v_suffix,
    'smoke-password',
    'Repair Status FIFO',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai)
  VALUES (
    'RR-FIFO-' || v_suffix,
    'Repair status fifo equipment ' || v_suffix,
    v_tenant,
    'Hoạt động'
  )
  RETURNING id INTO v_equipment_id;

  PERFORM pg_temp._rr_status_set_claims('to_qltb', v_user_id, v_tenant);

  v_request_a := public.repair_request_create(
    v_equipment_id::integer,
    'FIFO request A',
    'FIFO scope A',
    CURRENT_DATE + 7,
    'Requester A',
    'noi_bo',
    NULL
  );

  v_request_b := public.repair_request_create(
    v_equipment_id::integer,
    'FIFO request B',
    'FIFO scope B',
    CURRENT_DATE + 8,
    'Requester B',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_delete(v_request_a::integer);

  SELECT tb.tinh_trang_hien_tai
  INTO v_status_after_delete_a
  FROM public.thiet_bi tb
  WHERE tb.id = v_equipment_id;

  IF v_status_after_delete_a IS DISTINCT FROM 'Chờ sửa chữa' THEN
    RAISE EXCEPTION
      'Invariant failed: deleting request A first should keep Chờ sửa chữa while request B survives, got %',
      v_status_after_delete_a;
  END IF;

  PERFORM public.repair_request_delete(v_request_b::integer);

  SELECT tb.tinh_trang_hien_tai
  INTO v_status_after_delete_b
  FROM public.thiet_bi tb
  WHERE tb.id = v_equipment_id;

  IF v_status_after_delete_b IS DISTINCT FROM 'Hoạt động' THEN
    RAISE EXCEPTION
      'Invariant failed: deleting requests in FIFO order should restore Hoạt động, got %',
      v_status_after_delete_b;
  END IF;

  RAISE NOTICE 'OK: FIFO delete order restores original equipment status';
END $$;

-- 6) A new repair cluster must inherit the baseline from the current open
-- cluster, not from an older completed repair cycle on the same equipment.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_equipment_id bigint;
  v_old_request bigint;
  v_request_a bigint;
  v_request_b bigint;
  v_snapshot_b text;
  v_status_after_delete_b text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair status cluster tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_status_cluster_' || v_suffix,
    'smoke-password',
    'Repair Status Cluster',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai)
  VALUES (
    'RR-CLUSTER-' || v_suffix,
    'Repair status cluster equipment ' || v_suffix,
    v_tenant,
    'Hoạt động'
  )
  RETURNING id INTO v_equipment_id;

  PERFORM pg_temp._rr_status_set_claims('to_qltb', v_user_id, v_tenant);

  v_old_request := public.repair_request_create(
    v_equipment_id::integer,
    'Old cluster request',
    'Old cluster scope',
    CURRENT_DATE + 1,
    'Requester old',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_approve(
    v_old_request::integer,
    'Approver old',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_complete(
    v_old_request::integer,
    'Old cluster completed',
    NULL,
    NULL
  );

  UPDATE public.thiet_bi
  SET tinh_trang_hien_tai = 'Ngưng sử dụng'
  WHERE id = v_equipment_id;

  v_request_a := public.repair_request_create(
    v_equipment_id::integer,
    'Current cluster A',
    'Current cluster scope A',
    CURRENT_DATE + 2,
    'Requester A',
    'noi_bo',
    NULL
  );

  v_request_b := public.repair_request_create(
    v_equipment_id::integer,
    'Current cluster B',
    'Current cluster scope B',
    CURRENT_DATE + 3,
    'Requester B',
    'noi_bo',
    NULL
  );

  SELECT ycss.tinh_trang_thiet_bi_truoc_yeu_cau
  INTO v_snapshot_b
  FROM public.yeu_cau_sua_chua ycss
  WHERE ycss.id = v_request_b;

  IF v_snapshot_b IS DISTINCT FROM 'Ngưng sử dụng' THEN
    RAISE EXCEPTION
      'Invariant failed: current cluster request B should inherit Ngưng sử dụng, got %',
      v_snapshot_b;
  END IF;

  PERFORM public.repair_request_delete(v_old_request::integer);
  PERFORM public.repair_request_delete(v_request_a::integer);
  PERFORM public.repair_request_delete(v_request_b::integer);

  SELECT tb.tinh_trang_hien_tai
  INTO v_status_after_delete_b
  FROM public.thiet_bi tb
  WHERE tb.id = v_equipment_id;

  IF v_status_after_delete_b IS DISTINCT FROM 'Ngưng sử dụng' THEN
    RAISE EXCEPTION
      'Invariant failed: deleting the current cluster should restore Ngưng sử dụng, got %',
      v_status_after_delete_b;
  END IF;

  RAISE NOTICE 'OK: current repair cluster does not inherit stale historical baseline';
END $$;

-- 7) Deleting a legacy request with NULL snapshot must not leave the device in
-- a phantom Chờ sửa chữa state once no repair requests remain.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_equipment_id bigint;
  v_request_id bigint;
  v_status_after_delete text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair status legacy tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_status_legacy_' || v_suffix,
    'smoke-password',
    'Repair Status Legacy',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai)
  VALUES (
    'RR-LEGACY-' || v_suffix,
    'Repair status legacy equipment ' || v_suffix,
    v_tenant,
    'Hoạt động'
  )
  RETURNING id INTO v_equipment_id;

  UPDATE public.thiet_bi
  SET tinh_trang_hien_tai = 'Chờ sửa chữa'
  WHERE id = v_equipment_id;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    mo_ta_su_co,
    hang_muc_sua_chua,
    ngay_mong_muon_hoan_thanh,
    nguoi_yeu_cau,
    trang_thai,
    don_vi_thuc_hien,
    ten_don_vi_thue,
    tinh_trang_thiet_bi_truoc_yeu_cau
  )
  VALUES (
    v_equipment_id,
    'Legacy request without snapshot',
    'Legacy scope without snapshot',
    CURRENT_DATE + 7,
    'Requester legacy',
    'Chờ xử lý',
    'noi_bo',
    NULL,
    NULL
  )
  RETURNING id INTO v_request_id;

  PERFORM pg_temp._rr_status_set_claims('to_qltb', v_user_id, v_tenant);
  PERFORM public.repair_request_delete(v_request_id::integer);

  SELECT tb.tinh_trang_hien_tai
  INTO v_status_after_delete
  FROM public.thiet_bi tb
  WHERE tb.id = v_equipment_id;

  IF v_status_after_delete IS DISTINCT FROM 'Hoạt động' THEN
    RAISE EXCEPTION
      'Invariant failed: deleting legacy NULL-snapshot request should restore Hoạt động, got %',
      v_status_after_delete;
  END IF;

  RAISE NOTICE 'OK: legacy NULL-snapshot delete does not leave phantom Chờ sửa chữa';
END $$;

ROLLBACK;

-- Real read compatibility under authenticated role; fixture writes roll back.
BEGIN;

DO $$
DECLARE
  v_tenant bigint;
  v_other_tenant bigint;
  v_user_id bigint;
  v_suffix text := txid_current()::text;
  v_active text := 'Hoạt động dự phòng ' || v_suffix;
  v_inactive text := 'Kiểm định lịch sử ' || v_suffix;
  v_result jsonb;
  v_case record;
  v_failures text[] := ARRAY[]::text[];
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('AI catalog gate ' || v_suffix, true) RETURNING id INTO v_tenant;
  INSERT INTO public.don_vi(name, active)
  VALUES ('Other AI catalog gate ' || v_suffix, true) RETURNING id INTO v_other_tenant;
  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES ('ai_catalog_' || v_suffix, 'smoke-password', 'AI catalog gate',
    'to_qltb', v_tenant, v_tenant) RETURNING id INTO v_user_id;

  INSERT INTO public.equipment_status_catalog(status_value, display_order, is_active)
  VALUES (v_active, (SELECT max(display_order) + 1 FROM public.equipment_status_catalog), true);
  INSERT INTO public.equipment_status_catalog(status_value, display_order, is_active)
  VALUES (v_inactive, (SELECT max(display_order) + 1 FROM public.equipment_status_catalog), false);

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, tinh_trang_hien_tai, don_vi)
  SELECT 'AI-CATALOG-' || v_suffix || '-' || ordinality,
    'AI catalog gate', status_value, v_tenant
  FROM unnest(ARRAY['Thanh lý nội bộ', 'Hoạt động', 'Ngưng sử dụng',
    'Chưa có nhu cầu sử dụng', 'Chờ sửa chữa', 'Chờ bảo trì',
    'Chờ hiệu chuẩn/kiểm định', v_active, v_inactive])
    WITH ORDINALITY AS statuses(status_value, ordinality);
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, tinh_trang_hien_tai, don_vi)
  VALUES ('AI-OTHER-' || v_suffix, 'AI catalog gate', v_active, v_other_tenant);

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_user_id::text, 'sub', v_user_id::text,
    'don_vi', v_tenant::text
  )::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'fixture did not enter authenticated role';
  END IF;

  FOR v_case IN SELECT * FROM (VALUES
    ('Thanh lý nội bộ', 'Thanh lý nội bộ'),
    ('hoat dong', 'Hoạt động'), ('ngung su dung', 'Ngưng sử dụng'),
    ('chua co nhu cau su dung', 'Chưa có nhu cầu sử dụng'),
    ('cho sua chua', 'Chờ sửa chữa'), ('cho bao tri', 'Chờ bảo trì'),
    ('kiem dinh', 'Chờ hiệu chuẩn/kiểm định'),
    ('hieu chuan', 'Chờ hiệu chuẩn/kiểm định')
  ) AS cases(input_status, expected_status) LOOP
    v_result := public.ai_equipment_lookup(status => v_case.input_status);
    IF (v_result->>'total')::integer <> 1
      OR v_result->'data'->0->>'tinh_trang_hien_tai' IS DISTINCT FROM v_case.expected_status THEN
      RAISE EXCEPTION 'legacy/liquidation compatibility failed for %: %', v_case.input_status, v_result;
    END IF;
  END LOOP;
  v_result := public.ai_equipment_lookup(status => 'Unknown catalog status ' || v_suffix);
  IF v_result->>'total' <> '0' OR v_result->'data' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'unknown status must retain zero-result contract: %', v_result;
  END IF;
  v_result := public.ai_equipment_lookup(status => 'Hoạt động',
    filters => jsonb_build_object('status', 'Thanh lý nội bộ'), "limit" => 500);
  IF v_result->>'limit' <> '50' OR v_result->>'total' <> '1'
    OR v_result->'data'->0->>'tinh_trang_hien_tai' <> 'Thanh lý nội bộ' THEN
    RAISE EXCEPTION 'structured status precedence or upper limit changed: %', v_result;
  END IF;
  v_result := public.ai_equipment_lookup("limit" => -1);
  IF v_result->>'limit' <> '1' OR jsonb_array_length(v_result->'data') <> 1
    OR v_result->>'total' <> '9' THEN
    RAISE EXCEPTION 'lower limit or tenant scope changed: %', v_result;
  END IF;
  BEGIN
    PERFORM public.ai_equipment_lookup(p_don_vi => v_other_tenant);
    RAISE EXCEPTION 'cross-tenant query unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ai_equipment_lookup(p_user_id => (v_user_id + 1)::text);
    RAISE EXCEPTION 'user mismatch unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Exact catalog labels win over substring aliases, including inactive history.
  FOR v_case IN SELECT * FROM (VALUES
    (v_active, 'active raw catalog label'),
    (v_inactive, 'inactive historical catalog label')
  ) AS cases(status_value, description) LOOP
    v_result := public.ai_equipment_lookup(status => v_case.status_value);
    IF v_result->>'total' <> '1'
      OR v_result->'data'->0->>'tinh_trang_hien_tai' IS DISTINCT FROM v_case.status_value THEN
      v_failures := array_append(v_failures, v_case.description);
      RAISE NOTICE 'exact catalog label coerced by legacy alias: %', v_case.description;
    END IF;
    v_result := public.ai_equipment_lookup(filters => jsonb_build_object('status', v_case.status_value));
    IF v_result->>'total' <> '1'
      OR v_result->'data'->0->>'tinh_trang_hien_tai' IS DISTINCT FROM v_case.status_value THEN
      v_failures := array_append(v_failures, 'structured ' || v_case.description);
    END IF;
  END LOOP;
  IF cardinality(v_failures) > 0 THEN
    RAISE EXCEPTION 'exact catalog label must precede legacy normalization: %', v_failures;
  END IF;
  EXECUTE 'RESET ROLE';
END;
$$;

ROLLBACK;

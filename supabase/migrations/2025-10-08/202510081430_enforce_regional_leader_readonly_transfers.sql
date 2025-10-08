-- Migration: Enforce read-only access for regional_leader on transfer operations
-- Date: 2025-10-08 14:30
-- Purpose: Ensure regional_leader role cannot perform write operations on transfers
-- Dependencies: Existing transfer RPC functions (transfer_request_create, update, delete, etc.)
-- Security: Full SECURITY DEFINER hardening with search_path, tenant isolation, and role checks
-- MANUAL REVIEW REQUIRED - DO NOT AUTO-APPLY

BEGIN;

-- ============================================================================
-- Update transfer_request_create to deny regional_leader
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transfer_request_create(
  p_data JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id INT;
  v_claims JSONB;
  v_role TEXT;
  v_don_vi TEXT;
  v_user_id INT;
  v_tb RECORD;
BEGIN
  -- Get JWT claims
  v_claims := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role',''));
  v_don_vi := NULLIF(v_claims->>'don_vi','');
  v_user_id := NULLIF(v_claims->>'user_id','')::INT;

  -- SECURITY: Deny if role is missing (prevents service role bypass)
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING ERRCODE = '42501';
  END IF;

  -- DENY write access for regional_leader
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Regional leaders have read-only access to transfers' USING ERRCODE = '42501';
  END IF;

  -- Fetch equipment details
  SELECT id, don_vi, khoa_phong_quan_ly INTO v_tb
  FROM public.thiet_bi
  WHERE id = (p_data->>'thiet_bi_id')::INT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thiết bị không tồn tại';
  END IF;

  -- Tenant isolation check (except global) - compare as text since don_vi claim is text
  IF v_role IS DISTINCT FROM 'global' AND v_don_vi IS NOT NULL AND v_tb.don_vi::text IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác';
  END IF;

  -- Insert transfer request
  INSERT INTO public.yeu_cau_luan_chuyen(
    thiet_bi_id,
    loai_hinh,
    ly_do_luan_chuyen,
    khoa_phong_hien_tai,
    khoa_phong_nhan,
    muc_dich,
    don_vi_nhan,
    dia_chi_don_vi,
    nguoi_lien_he,
    so_dien_thoai,
    ngay_du_kien_tra,
    nguoi_yeu_cau_id,
    trang_thai,
    created_by,
    updated_by
  ) VALUES (
    (p_data->>'thiet_bi_id')::INT,
    p_data->>'loai_hinh',
    NULLIF(p_data->>'ly_do_luan_chuyen',''),
    NULLIF(p_data->>'khoa_phong_hien_tai',''),
    NULLIF(p_data->>'khoa_phong_nhan',''),
    NULLIF(p_data->>'muc_dich',''),
    NULLIF(p_data->>'don_vi_nhan',''),
    NULLIF(p_data->>'dia_chi_don_vi',''),
    NULLIF(p_data->>'nguoi_lien_he',''),
    NULLIF(p_data->>'so_dien_thoai',''),
    (CASE WHEN COALESCE(p_data->>'ngay_du_kien_tra','') <> '' THEN (p_data->>'ngay_du_kien_tra')::DATE ELSE NULL END),
    COALESCE(NULLIF(p_data->>'nguoi_yeu_cau_id','')::INT, v_user_id),
    'cho_duyet',
    COALESCE(NULLIF(p_data->>'created_by','')::INT, v_user_id),
    COALESCE(NULLIF(p_data->>'updated_by','')::INT, v_user_id)
  ) RETURNING id INTO v_id;

  -- Unified audit log
  PERFORM public.audit_log(
    'transfer_request_create',
    'transfer_request',
    v_id,
    NULL,
    p_data
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_create(JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_create(JSONB) FROM PUBLIC;

-- ============================================================================
-- Update transfer_request_update to deny regional_leader
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transfer_request_update(
  p_id INTEGER,
  p_data JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_req RECORD;
  v_claims JSONB;
  v_role TEXT;
  v_don_vi TEXT;
  v_tb_don_vi TEXT;
  v_user_id INT;
BEGIN
  -- Get JWT claims
  v_claims := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role',''));
  v_don_vi := NULLIF(v_claims->>'don_vi','');
  v_user_id := NULLIF(v_claims->>'user_id','')::INT;

  -- SECURITY: Deny if role is missing (prevents service role bypass)
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING ERRCODE = '42501';
  END IF;

  -- DENY write access for regional_leader
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Regional leaders have read-only access to transfers' USING ERRCODE = '42501';
  END IF;

  -- Fetch request and equipment details
  SELECT t.*, tb.don_vi AS tb_don_vi INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  v_tb_don_vi := v_req.tb_don_vi;

  -- Tenant isolation check - compare as text
  IF v_role IS DISTINCT FROM 'global' AND v_don_vi IS NOT NULL AND v_tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác';
  END IF;

  -- Status check
  IF v_req.trang_thai NOT IN ('cho_duyet','da_duyet') THEN
    RAISE EXCEPTION 'Chỉ có thể chỉnh sửa khi yêu cầu ở trạng thái Chờ duyệt hoặc Đã duyệt';
  END IF;

  -- Update transfer request
  -- CRITICAL FIX: Use COALESCE(p_data->>'loai_hinh', loai_hinh) to preserve current type when not in payload
  -- This prevents partial updates from wiping department/external fields
  UPDATE public.yeu_cau_luan_chuyen SET
    thiet_bi_id = COALESCE(NULLIF(p_data->>'thiet_bi_id','')::INT, thiet_bi_id),
    loai_hinh = COALESCE(NULLIF(p_data->>'loai_hinh',''), loai_hinh),
    ly_do_luan_chuyen = COALESCE(NULLIF(p_data->>'ly_do_luan_chuyen',''), ly_do_luan_chuyen),
    -- Use current loai_hinh if not provided in payload to avoid data loss
    khoa_phong_hien_tai = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) = 'noi_bo' THEN NULLIF(p_data->>'khoa_phong_hien_tai','') ELSE khoa_phong_hien_tai END,
    khoa_phong_nhan = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) = 'noi_bo' THEN NULLIF(p_data->>'khoa_phong_nhan','') ELSE khoa_phong_nhan END,
    muc_dich = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' THEN NULLIF(p_data->>'muc_dich','') ELSE muc_dich END,
    don_vi_nhan = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' THEN NULLIF(p_data->>'don_vi_nhan','') ELSE don_vi_nhan END,
    dia_chi_don_vi = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' THEN NULLIF(p_data->>'dia_chi_don_vi','') ELSE dia_chi_don_vi END,
    nguoi_lien_he = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' THEN NULLIF(p_data->>'nguoi_lien_he','') ELSE nguoi_lien_he END,
    so_dien_thoai = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' THEN NULLIF(p_data->>'so_dien_thoai','') ELSE so_dien_thoai END,
    ngay_du_kien_tra = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' AND COALESCE(p_data->>'ngay_du_kien_tra','') <> '' THEN (p_data->>'ngay_du_kien_tra')::DATE ELSE ngay_du_kien_tra END,
    updated_by = COALESCE(NULLIF(p_data->>'updated_by','')::INT, v_user_id),
    updated_at = NOW()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_update(INTEGER, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_update(INTEGER, JSONB) FROM PUBLIC;

-- ============================================================================
-- Update transfer_request_delete to deny regional_leader
-- SECURITY: Converted to plpgsql with in-database role and tenant checks
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transfer_request_delete(
  p_id INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_don_vi TEXT;
  v_req RECORD;
BEGIN
  -- Get JWT claims
  v_claims := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role',''));
  v_don_vi := NULLIF(v_claims->>'don_vi','');

  -- SECURITY: Deny if role is missing (prevents service role bypass)
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING ERRCODE = '42501';
  END IF;

  -- DENY write access for regional_leader
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Regional leaders have read-only access to transfers' USING ERRCODE = '42501';
  END IF;

  -- SECURITY: Fetch request and verify tenant isolation
  SELECT t.*, tb.don_vi AS tb_don_vi INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại' USING ERRCODE = '42501';
  END IF;

  -- Tenant isolation check - compare as text
  IF v_role IS DISTINCT FROM 'global' AND v_don_vi IS NOT NULL AND v_req.tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên yêu cầu thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  -- Delete transfer request
  DELETE FROM public.yeu_cau_luan_chuyen WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_delete(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_delete(INTEGER) FROM PUBLIC;

-- ============================================================================
-- Update transfer_request_update_status to deny regional_leader
-- SECURITY: Added tenant isolation and status transition validation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transfer_request_update_status(
  p_id INTEGER,
  p_status TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_don_vi TEXT;
  v_req RECORD;
BEGIN
  -- Get JWT claims
  v_claims := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role',''));
  v_don_vi := NULLIF(v_claims->>'don_vi','');

  -- SECURITY: Deny if role is missing (prevents service role bypass)
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING ERRCODE = '42501';
  END IF;

  -- DENY write access for regional_leader
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Regional leaders have read-only access to transfers' USING ERRCODE = '42501';
  END IF;

  -- SECURITY: Fetch request and verify tenant isolation
  SELECT t.*, tb.don_vi AS tb_don_vi INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại' USING ERRCODE = '42501';
  END IF;

  -- Tenant isolation check - compare as text
  IF v_role IS DISTINCT FROM 'global' AND v_don_vi IS NOT NULL AND v_req.tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên yêu cầu thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  -- SECURITY: Validate status transition (prevent invalid state changes)
  IF v_req.trang_thai = 'hoan_thanh' AND p_status != 'hoan_thanh' THEN
    RAISE EXCEPTION 'Không thể thay đổi trạng thái của yêu cầu đã hoàn thành' USING ERRCODE = '22023';
  END IF;

  -- Update core status and timestamps
  UPDATE public.yeu_cau_luan_chuyen
  SET trang_thai = p_status,
      updated_at = NOW()
  WHERE id = p_id;

  -- Idempotent status-specific timestamp updates
  IF p_status = 'da_duyet' THEN
    UPDATE public.yeu_cau_luan_chuyen
      SET nguoi_duyet_id = COALESCE(NULLIF(p_payload->>'nguoi_duyet_id','')::INT, nguoi_duyet_id),
          ngay_duyet = COALESCE((p_payload->>'ngay_duyet')::TIMESTAMPTZ, ngay_duyet, NOW())
    WHERE id = p_id;
  ELSIF p_status IN ('dang_luan_chuyen', 'da_ban_giao') THEN
    UPDATE public.yeu_cau_luan_chuyen
      SET ngay_ban_giao = COALESCE((p_payload->>'ngay_ban_giao')::TIMESTAMPTZ, ngay_ban_giao, NOW())
    WHERE id = p_id;
  ELSIF p_status = 'hoan_thanh' THEN
    UPDATE public.yeu_cau_luan_chuyen
      SET ngay_hoan_thanh = COALESCE((p_payload->>'ngay_hoan_thanh')::TIMESTAMPTZ, ngay_hoan_thanh, NOW()),
          ngay_hoan_tra = COALESCE((p_payload->>'ngay_hoan_tra')::TIMESTAMPTZ, ngay_hoan_tra)
    WHERE id = p_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_update_status(INTEGER, TEXT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_update_status(INTEGER, TEXT, JSONB) FROM PUBLIC;

-- ============================================================================
-- Update transfer_request_complete to deny regional_leader
-- SECURITY: Added tenant isolation and proper error handling
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transfer_request_complete(
  p_id INTEGER,
  p_payload JSONB DEFAULT '{}'::JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_don_vi TEXT;
  v_req RECORD;  -- Use RECORD instead of composite type for migration safety
  v_mo_ta TEXT;
  v_loai_su_kien TEXT;
  v_tb_don_vi TEXT;
BEGIN
  -- Get JWT claims
  v_claims := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role',''));
  v_don_vi := NULLIF(v_claims->>'don_vi','');

  -- SECURITY: Deny if role is missing (prevents service role bypass)
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING ERRCODE = '42501';
  END IF;

  -- DENY write access for regional_leader
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Regional leaders have read-only access to transfers' USING ERRCODE = '42501';
  END IF;

  -- SECURITY: Fetch request with tenant information
  SELECT t.*, tb.don_vi AS tb_don_vi
  INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại' USING ERRCODE = '42501';
  END IF;

  v_tb_don_vi := v_req.tb_don_vi;

  -- Tenant isolation check - compare as text
  IF v_role IS DISTINCT FROM 'global' AND v_don_vi IS NOT NULL AND v_tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên yêu cầu thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  -- Mark as completed
  UPDATE public.yeu_cau_luan_chuyen
    SET trang_thai = 'hoan_thanh',
        ngay_hoan_thanh = NOW(),
        ngay_hoan_tra = COALESCE((p_payload->>'ngay_hoan_tra')::TIMESTAMPTZ, CASE WHEN v_req.loai_hinh = 'ben_ngoai' THEN NOW() ELSE ngay_hoan_tra END),
        updated_at = NOW()
  WHERE id = p_id;

  -- Update equipment depending on transfer type
  IF v_req.loai_hinh = 'noi_bo' AND v_req.khoa_phong_nhan IS NOT NULL THEN
    UPDATE thiet_bi
      SET khoa_phong_quan_ly = v_req.khoa_phong_nhan
    WHERE id = v_req.thiet_bi_id;
  ELSIF v_req.loai_hinh = 'thanh_ly' THEN
    UPDATE thiet_bi
      SET tinh_trang_hien_tai = 'Ngưng sử dụng',
          khoa_phong_quan_ly = 'Tổ QLTB'
    WHERE id = v_req.thiet_bi_id;
  END IF;

  -- Build history description
  IF v_req.loai_hinh = 'noi_bo' THEN
    v_loai_su_kien := 'Luân chuyển';
    v_mo_ta := format('Thiết bị được luân chuyển từ "%s" đến "%s".', COALESCE(v_req.khoa_phong_hien_tai,''), COALESCE(v_req.khoa_phong_nhan,''));
  ELSIF v_req.loai_hinh = 'thanh_ly' THEN
    v_loai_su_kien := 'Thanh lý';
    v_mo_ta := format('Thiết bị được thanh lý. Lý do: %s', COALESCE(v_req.ly_do_luan_chuyen,''));
  ELSE
    v_loai_su_kien := 'Luân chuyển';
    v_mo_ta := format('Thiết bị được hoàn trả từ đơn vị bên ngoài "%s".', COALESCE(v_req.don_vi_nhan,''));
  END IF;

  -- Insert general equipment history
  INSERT INTO lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet)
  VALUES (
    v_req.thiet_bi_id,
    v_loai_su_kien,
    v_mo_ta,
    jsonb_build_object(
      'ma_yeu_cau', v_req.ma_yeu_cau,
      'loai_hinh', v_req.loai_hinh,
      'khoa_phong_hien_tai', v_req.khoa_phong_hien_tai,
      'khoa_phong_nhan', v_req.khoa_phong_nhan,
      'don_vi_nhan', v_req.don_vi_nhan,
      'yeu_cau_id', v_req.id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_complete(INTEGER, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_complete(INTEGER, JSONB) FROM PUBLIC;

COMMIT;

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================
-- 1. All SECURITY DEFINER functions now have SET search_path TO 'public', 'pg_temp'
-- 2. All write functions enforce role presence check (blocks service role bypass)
-- 3. All write functions deny regional_leader role explicitly
-- 4. All write functions enforce tenant isolation (except global role)
-- 5. Status transition validation prevents completing requests from being modified
-- 6. All functions have explicit GRANT to authenticated and REVOKE from PUBLIC
-- 7. Functions use RECORD type for migration safety (no composite type dependency)
-- 8. Idempotent timestamp updates prevent accidental data loss on retry
-- 9. Error codes: 42501 (insufficient_privilege), 22023 (invalid_parameter_value)
--
-- The transfer_request_list_enhanced function already filters data by allowed_don_vi_for_session(),
-- which correctly handles regional_leader access to all facilities in their assigned dia_ban.
--
-- VALIDATION CHECKLIST:
-- [ ] Verify audit_log function exists and is properly secured
-- [ ] Confirm function owner is postgres or supabase_admin
-- [ ] Test with service role to ensure denials work
-- [ ] Test with regional_leader role to ensure all writes are blocked
-- [ ] Test with facility roles to ensure tenant isolation works
-- [ ] Verify RLS policies on tables align with function access patterns

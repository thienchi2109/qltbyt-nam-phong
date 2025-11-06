-- Migration: Fix type mismatch in transfer_request_update_status
-- Date: 2025-11-06
-- Issue: "operator does not exist: bigint = text" error when approving transfers
-- Root Cause: Comparing tb.don_vi (BIGINT) with v_don_vi (TEXT from JWT claims)
-- Solution: Cast v_don_vi to BIGINT for proper comparison

BEGIN;

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
  v_don_vi_text TEXT;  -- Extracted as TEXT first
  v_don_vi BIGINT;     -- Then cast to BIGINT for comparison
  v_req RECORD;
BEGIN
  -- Get JWT claims
  v_claims := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role',''));
  v_don_vi_text := NULLIF(v_claims->>'don_vi','');

  -- CRITICAL FIX: Cast don_vi to BIGINT for comparison with tb.don_vi
  v_don_vi := CASE
    WHEN v_don_vi_text IS NOT NULL AND v_don_vi_text ~ '^\d+$'
    THEN v_don_vi_text::BIGINT
    ELSE NULL
  END;

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

  -- FIXED: Now comparing BIGINT with BIGINT instead of BIGINT with TEXT
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

COMMENT ON FUNCTION public.transfer_request_update_status IS
'Fixed: Cast v_don_vi from TEXT to BIGINT to match tb.don_vi type for proper comparison.
Resolves "operator does not exist: bigint = text" error during transfer approval.';

COMMIT;

-- ============================================================================
-- TESTING
-- ============================================================================

-- Test 1: Global user should be able to approve any transfer
-- SET request.jwt.claims = '{"app_role":"global","don_vi":""}';
-- SELECT public.transfer_request_update_status(1, 'da_duyet', '{"nguoi_duyet_id":"1"}'::jsonb);

-- Test 2: Non-global user with matching don_vi should succeed
-- SET request.jwt.claims = '{"app_role":"to_qltb","don_vi":"5"}';
-- SELECT public.transfer_request_update_status(1, 'da_duyet', '{"nguoi_duyet_id":"1"}'::jsonb);

-- Test 3: Non-global user with different don_vi should fail
-- SET request.jwt.claims = '{"app_role":"to_qltb","don_vi":"5"}';
-- SELECT public.transfer_request_update_status(999, 'da_duyet', '{"nguoi_duyet_id":"1"}'::jsonb);
-- Expected: "Không có quyền trên yêu cầu thuộc đơn vị khác"

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
/*
-- Restore previous version from 2025-10-08/202510081430_enforce_regional_leader_readonly_transfers.sql
DROP FUNCTION IF EXISTS public.transfer_request_update_status(INTEGER, TEXT, JSONB);
-- Then restore from that file
*/

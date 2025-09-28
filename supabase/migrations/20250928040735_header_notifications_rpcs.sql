BEGIN;

-- Tenant-scoped header notification summary
-- Returns counts of pending repair and transfer requests for the effective tenant
-- Idempotent via CREATE OR REPLACE; includes non-global tenant guards and grants

CREATE OR REPLACE FUNCTION public.header_notifications_summary(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), COALESCE(public._get_jwt_claim('role'), ''));
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  v_repairs BIGINT := 0;
  v_transfers BIGINT := 0;
BEGIN
  -- Global users may pass p_don_vi (NULL means all tenants). Non-global users are forced to their own tenant.
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL => all tenants
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  -- Pending repairs: 'Chờ xử lý' or 'Đã duyệt'
  SELECT COUNT(*) INTO v_repairs
  FROM public.yeu_cau_sua_chua r
  LEFT JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND r.trang_thai IN ('Chờ xử lý','Đã duyệt');

  -- Pending transfers: 'cho_duyet' or 'da_duyet'
  SELECT COUNT(*) INTO v_transfers
  FROM public.yeu_cau_luan_chuyen t
  LEFT JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND t.trang_thai IN ('cho_duyet','da_duyet');

  RETURN jsonb_build_object(
    'pending_repairs', COALESCE(v_repairs, 0),
    'pending_transfers', COALESCE(v_transfers, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.header_notifications_summary(BIGINT) TO authenticated;

COMMIT;

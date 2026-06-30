-- Issue #618 Phase 1: SQL data contract for ZBS repair-request notifications.
-- Scope:
-- - Tenant-scoped recipient config.
-- - Generic notification outbox.
-- - repair_request_create enqueue for repair_request_created only.
-- - No dispatcher, outbound Zalo call, webhook handling, feature gate, or transfer events.

BEGIN;

CREATE TABLE IF NOT EXISTS public.zbs_recipient_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (btrim(event_type) <> ''),
  recipient_phone TEXT NOT NULL CHECK (recipient_phone ~ '^[0-9]{8,15}$'),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (don_vi_id, event_type, recipient_phone)
);

CREATE TABLE IF NOT EXISTS public.zbs_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (btrim(event_type) <> ''),
  source_type TEXT NOT NULL CHECK (btrim(source_type) <> ''),
  source_id BIGINT NOT NULL,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE RESTRICT,
  recipient_config_id UUID NOT NULL REFERENCES public.zbs_recipient_configs(id) ON DELETE RESTRICT,
  recipient_phone TEXT NOT NULL CHECK (recipient_phone ~ '^[0-9]{8,15}$'),
  template_id TEXT,
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(template_data) = 'object'),
  tracking_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed', 'cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ,
  provider TEXT NOT NULL DEFAULT 'zalo_zbs' CHECK (provider = 'zalo_zbs'),
  provider_message_id TEXT,
  provider_response JSONB,
  last_error_code TEXT,
  last_error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_type, source_type, source_id, recipient_config_id)
);

CREATE INDEX IF NOT EXISTS zbs_recipient_configs_active_lookup_idx
  ON public.zbs_recipient_configs (don_vi_id, event_type)
  WHERE active;

CREATE INDEX IF NOT EXISTS zbs_notification_outbox_pending_dispatch_idx
  ON public.zbs_notification_outbox (status, next_attempt_at, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS zbs_notification_outbox_don_vi_idx
  ON public.zbs_notification_outbox (don_vi_id);

CREATE INDEX IF NOT EXISTS zbs_notification_outbox_recipient_config_idx
  ON public.zbs_notification_outbox (recipient_config_id);

CREATE INDEX IF NOT EXISTS zbs_notification_outbox_source_idx
  ON public.zbs_notification_outbox (source_type, source_id);

CREATE OR REPLACE FUNCTION public.touch_zbs_notification_contract_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zbs_recipient_configs_updated_at
  ON public.zbs_recipient_configs;
CREATE TRIGGER trg_zbs_recipient_configs_updated_at
BEFORE UPDATE ON public.zbs_recipient_configs
FOR EACH ROW
EXECUTE FUNCTION public.touch_zbs_notification_contract_updated_at();

DROP TRIGGER IF EXISTS trg_zbs_notification_outbox_updated_at
  ON public.zbs_notification_outbox;
CREATE TRIGGER trg_zbs_notification_outbox_updated_at
BEFORE UPDATE ON public.zbs_notification_outbox
FOR EACH ROW
EXECUTE FUNCTION public.touch_zbs_notification_contract_updated_at();

ALTER TABLE public.zbs_recipient_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zbs_notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zbs_recipient_configs_no_client_access
  ON public.zbs_recipient_configs;
CREATE POLICY zbs_recipient_configs_no_client_access
  ON public.zbs_recipient_configs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS zbs_notification_outbox_no_client_access
  ON public.zbs_notification_outbox;
CREATE POLICY zbs_notification_outbox_no_client_access
  ON public.zbs_notification_outbox
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.zbs_recipient_configs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.zbs_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.zbs_recipient_configs TO service_role;
GRANT ALL ON public.zbs_notification_outbox TO service_role;
REVOKE ALL ON FUNCTION public.touch_zbs_notification_contract_updated_at()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_zbs_notification_contract_updated_at()
  TO service_role;

COMMENT ON TABLE public.zbs_recipient_configs IS
  'Server-only tenant-scoped ZBS recipient configuration. Client roles have no direct table access.';

COMMENT ON TABLE public.zbs_notification_outbox IS
  'Server-only generic notification outbox for Zalo ZBS delivery. Phase 1 only enqueues repair request notifications.';

COMMENT ON COLUMN public.zbs_notification_outbox.template_data IS
  'Internal semantic snapshot for dispatcher mapping to provider-approved ZBS template fields.';

CREATE OR REPLACE FUNCTION public.repair_request_create(
  p_thiet_bi_id integer,
  p_mo_ta_su_co text,
  p_hang_muc_sua_chua text,
  p_ngay_mong_muon_hoan_thanh date,
  p_nguoi_yeu_cau text,
  p_don_vi_thuc_hien text,
  p_ten_don_vi_thue text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_id integer;
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_department_scope text;
  v_tb record;
  v_snapshot_status text;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}'::text)::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_user_id := nullif(v_claims->>'user_id', '')::bigint;
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_claims->>'khoa_phong');
  END IF;

  SELECT
    tb.id,
    tb.don_vi,
    tb.khoa_phong_quan_ly,
    tb.tinh_trang_hien_tai,
    tb.ma_thiet_bi,
    tb.ten_thiet_bi
  INTO v_tb
  FROM public.thiet_bi tb
  WHERE tb.id = p_thiet_bi_id
    AND tb.is_deleted = false
  FOR UPDATE OF tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thiết bị không tồn tại' USING errcode = 'P0002';
  END IF;

  IF NOT v_is_global AND v_tb.don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  IF v_role = 'user'
     AND (
       v_department_scope IS NULL
       OR public._normalize_department_scope(v_tb.khoa_phong_quan_ly) IS DISTINCT FROM v_department_scope
     ) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc khoa/phòng khác' USING errcode = '42501';
  END IF;

  v_snapshot_status := v_tb.tinh_trang_hien_tai;

  IF v_tb.tinh_trang_hien_tai = 'Chờ sửa chữa' THEN
    SELECT ycss.tinh_trang_thiet_bi_truoc_yeu_cau
    INTO v_snapshot_status
    FROM public.yeu_cau_sua_chua ycss
    WHERE ycss.thiet_bi_id = p_thiet_bi_id
      AND ycss.trang_thai IN ('Chờ xử lý', 'Đã duyệt', 'Không HT')
      AND ycss.tinh_trang_thiet_bi_truoc_yeu_cau IS NOT NULL
      AND ycss.tinh_trang_thiet_bi_truoc_yeu_cau <> 'Chờ sửa chữa'
    ORDER BY ycss.id DESC
    LIMIT 1;

    v_snapshot_status := coalesce(
      v_snapshot_status,
      nullif(v_tb.tinh_trang_hien_tai, 'Chờ sửa chữa'),
      'Hoạt động'
    );
  END IF;

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
    p_thiet_bi_id,
    p_mo_ta_su_co,
    p_hang_muc_sua_chua,
    p_ngay_mong_muon_hoan_thanh,
    p_nguoi_yeu_cau,
    'Chờ xử lý',
    p_don_vi_thuc_hien,
    p_ten_don_vi_thue,
    v_snapshot_status
  )
  RETURNING id INTO v_id;

  PERFORM public.repair_request_sync_equipment_status(p_thiet_bi_id::bigint);

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    p_thiet_bi_id,
    'Sửa chữa',
    'Tạo yêu cầu sửa chữa',
    jsonb_build_object(
      'mo_ta_su_co', p_mo_ta_su_co,
      'hang_muc', p_hang_muc_sua_chua,
      'ngay_mong_muon_hoan_thanh', p_ngay_mong_muon_hoan_thanh,
      'don_vi_thuc_hien', p_don_vi_thuc_hien,
      'ten_don_vi_thue', p_ten_don_vi_thue
    ),
    v_id
  );

  IF NOT public.audit_log(
    'repair_request_create',
    'repair_request',
    v_id,
    NULL,
    jsonb_build_object(
      'thiet_bi_id', p_thiet_bi_id,
      'mo_ta_su_co', p_mo_ta_su_co
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', v_id;
  END IF;

  INSERT INTO public.zbs_notification_outbox (
    event_type,
    source_type,
    source_id,
    don_vi_id,
    recipient_config_id,
    recipient_phone,
    template_data,
    tracking_id
  )
  SELECT
    'repair_request_created',
    'repair_request',
    v_id,
    v_tb.don_vi,
    cfg.id,
    cfg.recipient_phone,
    jsonb_build_object(
      'repair_request_id', v_id,
      'equipment_id', v_tb.id,
      'equipment_code', v_tb.ma_thiet_bi,
      'equipment_name', v_tb.ten_thiet_bi,
      'department', v_tb.khoa_phong_quan_ly,
      'issue_description', p_mo_ta_su_co,
      'repair_scope', p_hang_muc_sua_chua,
      'requested_completion_date', p_ngay_mong_muon_hoan_thanh,
      'requester', p_nguoi_yeu_cau,
      'don_vi_id', v_tb.don_vi,
      'don_vi_thuc_hien', p_don_vi_thuc_hien,
      'ten_don_vi_thue', p_ten_don_vi_thue
    ),
    format('repair_request:%s:%s', v_id, cfg.id)
  FROM public.zbs_recipient_configs cfg
  WHERE cfg.don_vi_id = v_tb.don_vi
    AND cfg.event_type = 'repair_request_created'
    AND cfg.active = true
  ON CONFLICT (event_type, source_type, source_id, recipient_config_id) DO NOTHING;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) FROM PUBLIC;

COMMIT;

-- DEVICE QUOTA CATEGORY DELETE REGRESSION TEST
\echo 'DEVICE QUOTA CATEGORY DELETE REGRESSION TEST'

BEGIN;

-- Guard against immutable-audit FK conflict:
-- thiet_bi_nhom_audit_log must NOT use ON DELETE SET NULL for nhom_thiet_bi_id.
DO $$
DECLARE
  v_set_null_fk_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO v_set_null_fk_count
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'thiet_bi_nhom_audit_log'
    AND c.contype = 'f'
    AND c.conname = 'thiet_bi_nhom_audit_log_nhom_thiet_bi_id_fkey'
    AND c.confdeltype = 'n';

  IF v_set_null_fk_count > 0 THEN
    RAISE EXCEPTION 'Expected ON DELETE SET NULL FK on thiet_bi_nhom_audit_log.nhom_thiet_bi_id to be removed';
  END IF;
END $$;

-- Guard against TOCTOU: category read in delete RPC must lock row.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.dinh_muc_nhom_delete(bigint,bigint)'::regprocedure)
  INTO v_def;

  IF position('for update' in lower(v_def)) = 0 THEN
    RAISE EXCEPTION 'Expected dinh_muc_nhom_delete() to lock category row with FOR UPDATE';
  END IF;

  IF position('set search_path to ''public'', ''pg_temp''' in lower(v_def)) = 0 THEN
    RAISE EXCEPTION 'Expected dinh_muc_nhom_delete() to set search_path to public, pg_temp';
  END IF;

  IF position('access denied: tenant context required' in lower(v_def)) = 0 THEN
    RAISE EXCEPTION 'Expected dinh_muc_nhom_delete() to fail closed when tenant claim is missing';
  END IF;
END $$;

DO $$
DECLARE
  v_tenant_id bigint;
  v_missing_claim_category_id bigint;
  v_missing_claim_deleted boolean;
  v_don_vi_id bigint;
  v_user_id bigint;
  v_category_id bigint;
  v_deleted boolean;
BEGIN
  -- Missing-tenant claim must fail closed for non-global/admin roles.
  SELECT id INTO v_tenant_id
  FROM public.don_vi
  ORDER BY id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Missing fixture rows in don_vi';
  END IF;

  INSERT INTO public.nhom_thiet_bi (don_vi_id, ma_nhom, ten_nhom)
  VALUES (
    v_tenant_id,
    'TEST-NHOM-MISSING-TENANT-' || floor(random() * 1000000)::text,
    'Category missing tenant guard regression'
  )
  RETURNING id INTO v_missing_claim_category_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', '0',
      'sub', '0'
    )::text,
    true
  );

  BEGIN
    v_missing_claim_deleted := public.dinh_muc_nhom_delete(v_missing_claim_category_id, NULL);
    RAISE EXCEPTION 'Expected tenant guard to reject missing don_vi claim, but got result=%', v_missing_claim_deleted;
  EXCEPTION
    WHEN OTHERS THEN
      IF position('tenant context required' in lower(SQLERRM)) = 0 THEN
        RAISE;
      END IF;
  END;

  SELECT id INTO v_don_vi_id
  FROM public.don_vi
  ORDER BY id
  LIMIT 1;

  SELECT id INTO v_user_id
  FROM public.nhan_vien
  ORDER BY id
  LIMIT 1;

  IF v_don_vi_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing fixture rows in don_vi or nhan_vien';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', null
    )::text,
    true
  );

  INSERT INTO public.nhom_thiet_bi (don_vi_id, ma_nhom, ten_nhom)
  VALUES (
    v_don_vi_id,
    'TEST-NHOM-DELETE-' || floor(random() * 1000000)::text,
    'Category delete regression'
  )
  RETURNING id INTO v_category_id;

  INSERT INTO public.thiet_bi_nhom_audit_log (
    don_vi_id,
    thiet_bi_ids,
    nhom_thiet_bi_id,
    action,
    performed_by,
    metadata
  ) VALUES (
    v_don_vi_id,
    ARRAY[1]::bigint[],
    v_category_id,
    'link',
    v_user_id,
    jsonb_build_object('reason', 'regression test')
  );

  v_deleted := public.dinh_muc_nhom_delete(v_category_id, v_don_vi_id);
  IF v_deleted IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Category delete RPC did not return TRUE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.nhom_thiet_bi
    WHERE id = v_category_id
  ) THEN
    RAISE EXCEPTION 'Expected category to be deleted';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.thiet_bi_nhom_audit_log
    WHERE nhom_thiet_bi_id = v_category_id
  ) THEN
    RAISE EXCEPTION 'Expected audit row to retain historical nhom_thiet_bi_id after category delete';
  END IF;
END $$;

ROLLBACK;

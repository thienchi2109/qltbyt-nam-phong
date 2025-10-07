-- Phase 1: Multi-tenant schema and equipment RPCs (no RLS, RPC-only)
-- Safe, idempotent migration for Supabase

BEGIN;

-- 1) Ensure pgcrypto available in extensions schema (for consistency with repo style)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2) don_vi table
CREATE TABLE IF NOT EXISTS public.don_vi (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Add columns to nhan_vien
ALTER TABLE IF EXISTS public.nhan_vien
  ADD COLUMN IF NOT EXISTS don_vi BIGINT,
  ADD COLUMN IF NOT EXISTS current_don_vi BIGINT;

-- 4) Add column to thiet_bi
ALTER TABLE IF EXISTS public.thiet_bi
  ADD COLUMN IF NOT EXISTS don_vi BIGINT;

-- 5) FKs (deferred to avoid failures if nulls exist for now)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nhan_vien_don_vi_fkey'
  ) THEN
    ALTER TABLE public.nhan_vien
      ADD CONSTRAINT nhan_vien_don_vi_fkey FOREIGN KEY (don_vi) REFERENCES public.don_vi(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nhan_vien_current_don_vi_fkey'
  ) THEN
    ALTER TABLE public.nhan_vien
      ADD CONSTRAINT nhan_vien_current_don_vi_fkey FOREIGN KEY (current_don_vi) REFERENCES public.don_vi(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thiet_bi_don_vi_fkey'
  ) THEN
    ALTER TABLE public.thiet_bi
      ADD CONSTRAINT thiet_bi_don_vi_fkey FOREIGN KEY (don_vi) REFERENCES public.don_vi(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END $$;

-- 6) Memberships table for multi-tenant users
CREATE TABLE IF NOT EXISTS public.user_don_vi_memberships (
  user_id BIGINT NOT NULL,
  don_vi BIGINT NOT NULL,
  role_override TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, don_vi)
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_don_vi_memberships_user_fkey'
  ) THEN
    ALTER TABLE public.user_don_vi_memberships
      ADD CONSTRAINT user_don_vi_memberships_user_fkey FOREIGN KEY (user_id) REFERENCES public.nhan_vien(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_don_vi_memberships_don_vi_fkey'
  ) THEN
    ALTER TABLE public.user_don_vi_memberships
      ADD CONSTRAINT user_don_vi_memberships_don_vi_fkey FOREIGN KEY (don_vi) REFERENCES public.don_vi(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

-- 7) Indexes
CREATE INDEX IF NOT EXISTS idx_thiet_bi_don_vi ON public.thiet_bi(don_vi);
CREATE INDEX IF NOT EXISTS idx_nhan_vien_don_vi ON public.nhan_vien(don_vi);
CREATE INDEX IF NOT EXISTS idx_nhan_vien_current_don_vi ON public.nhan_vien(current_don_vi);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.user_don_vi_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_don_vi ON public.user_don_vi_memberships(don_vi);

-- 8) Backfill scaffold: create mapping table and optionally seed
CREATE TABLE IF NOT EXISTS public.khoa_phong_to_don_vi (
  khoa_phong TEXT PRIMARY KEY,
  don_vi_code TEXT,
  don_vi_name TEXT
);

-- Note: actual backfill will be executed in a subsequent controlled migration after mapping is prepared.

-- 9) Security: ensure no public grants on new tables (we will manage grants explicitly later)
REVOKE ALL ON TABLE public.don_vi FROM PUBLIC;
REVOKE ALL ON TABLE public.user_don_vi_memberships FROM PUBLIC;
REVOKE ALL ON TABLE public.khoa_phong_to_don_vi FROM PUBLIC;

-- 10) Equipment RPCs (read + write) with tenant/role checks
-- Helper to read claims safely
CREATE OR REPLACE FUNCTION public._get_jwt_claim(claim TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> claim, NULL);
$$;

-- equipment_list: returns tenant-filtered equipment for non-global, supports basic sort/pagination
CREATE OR REPLACE FUNCTION public.equipment_list(
  p_q TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'id.asc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_donvi BIGINT := NULL;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_offset INT;
BEGIN
  v_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;

  -- Whitelist sorting
  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE LOWER(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN ('id','ten_thiet_bi','ma_thiet_bi','khoa_phong_quan_ly','don_vi') THEN
    v_sort_col := 'id';
  END IF;
  v_offset := GREATEST((p_page - 1), 0) * GREATEST(p_page_size, 1);

  IF v_role = 'global' THEN
    -- For global, allow optional cross-tenant filter
    IF p_don_vi IS NOT NULL THEN
      RETURN QUERY EXECUTE format(
        'SELECT * FROM public.thiet_bi
         WHERE don_vi = $5 AND ($1 IS NULL OR ten_thiet_bi ILIKE $4 OR ma_thiet_bi ILIKE $4)
         ORDER BY %I %s OFFSET $2 LIMIT $3',
         v_sort_col, v_sort_dir
      ) USING p_q, v_offset, p_page_size, ('%' || p_q || '%'), p_don_vi;
    END IF;
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

GRANT EXECUTE ON FUNCTION public.equipment_list(TEXT, TEXT, INT, INT, BIGINT) TO authenticated;

-- equipment_get: get one by id within tenant or any for global
CREATE OR REPLACE FUNCTION public.equipment_get(p_id BIGINT)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
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

GRANT EXECUTE ON FUNCTION public.equipment_get(BIGINT) TO authenticated;

-- equipment_create: set don_vi from JWT; role checks: global|to_qltb allowed; technician requires matching khoa_phong
CREATE OR REPLACE FUNCTION public.equipment_create(p_payload JSONB)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_khoa_phong TEXT := NULL; -- from payload
  rec public.thiet_bi;
BEGIN
  IF v_role NOT IN ('global','to_qltb','technician') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  v_khoa_phong := COALESCE(p_payload->>'khoa_phong_quan_ly', NULL);

  IF v_role = 'technician' THEN
    -- Technician: require khoa_phong in payload to match their own; we assume caller's khoa_phong is stored in nhan_vien
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

GRANT EXECUTE ON FUNCTION public.equipment_create(JSONB) TO authenticated;

-- equipment_update: update only within tenant; technician must match khoa_phong; to_qltb/global allowed
CREATE OR REPLACE FUNCTION public.equipment_update(p_id BIGINT, p_patch JSONB)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_khoa_phong_new TEXT := COALESCE(p_patch->>'khoa_phong_quan_ly', NULL);
  rec public.thiet_bi;
BEGIN
  -- Must own or be global
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

GRANT EXECUTE ON FUNCTION public.equipment_update(BIGINT, JSONB) TO authenticated;

-- equipment_delete: deny for technician; allow to_qltb/global within tenant
CREATE OR REPLACE FUNCTION public.equipment_delete(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
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

GRANT EXECUTE ON FUNCTION public.equipment_delete(BIGINT) TO authenticated;

COMMIT;

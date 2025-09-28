-- Fix departments_list function to enforce tenant filtering
-- Prevents cross-tenant department exposure in transfer dialogs
-- Date: 2025-09-27

BEGIN;

-- Replace the existing departments_list function to be tenant-aware
-- This fixes the security gap where all departments across tenants were visible
CREATE OR REPLACE FUNCTION public.departments_list()
RETURNS TABLE(name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := '';
  v_claim_donvi BIGINT := NULL;
  v_effective_donvi BIGINT := NULL;
BEGIN
  -- Get user context from JWT claims
  v_role := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;

  -- Tenant isolation: non-global users are forced to their claim tenant
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- Global users see all departments
  ELSE
    v_effective_donvi := v_claim_donvi; -- Non-global users only see their tenant's departments
  END IF;

  -- Return departments filtered by tenant
  RETURN QUERY
  SELECT DISTINCT coalesce(tb.khoa_phong_quan_ly, '') as name
  FROM public.thiet_bi tb
  WHERE coalesce(tb.khoa_phong_quan_ly, '') <> ''
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
  ORDER BY 1;
END;
$$;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.departments_list() TO authenticated;

COMMIT;
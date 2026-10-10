BEGIN;

CREATE TABLE public.equipment_status_catalog (
  status_value text PRIMARY KEY,
  display_order integer NOT NULL UNIQUE CHECK (display_order > 0),
  is_active boolean NOT NULL DEFAULT true,
  is_terminal boolean NOT NULL DEFAULT false,
  requires_end_date boolean NOT NULL DEFAULT false,
  blocks_operational_actions boolean NOT NULL DEFAULT false,
  is_liquidation boolean NOT NULL DEFAULT false,
  CHECK (NOT requires_end_date OR is_terminal)
);

-- Seed metadata only. Existing equipment rows and dates are never changed.
INSERT INTO public.equipment_status_catalog
  (status_value, display_order, is_terminal, requires_end_date,
   blocks_operational_actions, is_liquidation)
VALUES
  ('Hoạt động', 1, false, false, false, false),
  ('Chờ sửa chữa', 2, false, false, false, false),
  ('Chờ bảo trì', 3, false, false, false, false),
  ('Chờ hiệu chuẩn/kiểm định', 4, false, false, false, false),
  ('Ngưng sử dụng', 5, true, false, false, false),
  ('Chưa có nhu cầu sử dụng', 6, false, false, false, false),
  ('Thanh lý nội bộ', 7, true, true, true, true);

ALTER TABLE public.equipment_status_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY equipment_status_catalog_authenticated_read
  ON public.equipment_status_catalog FOR SELECT TO authenticated USING (true);
-- Supabase default privileges may grant service_role writes on new tables.
REVOKE ALL ON TABLE public.equipment_status_catalog
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.equipment_status_catalog TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_status_catalog_list()
RETURNS SETOF public.equipment_status_catalog
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
  SELECT status_value, display_order, is_active, is_terminal,
    requires_end_date, blocks_operational_actions, is_liquidation
  FROM public.equipment_status_catalog
  ORDER BY display_order;
$function$;

REVOKE ALL ON FUNCTION public.equipment_status_catalog_list()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.equipment_status_catalog_list() TO authenticated;

COMMIT;

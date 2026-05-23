-- Bootstrap internal settings store used by server-side operational toggles.
-- Live databases may already have this table from MCP-applied migrations; keep this idempotent
-- so fresh local resets and production both converge safely.

CREATE TABLE IF NOT EXISTS public.internal_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.internal_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.internal_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.internal_settings TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'internal_settings'
      AND policyname = 'service_role can manage internal settings'
  ) THEN
    CREATE POLICY "service_role can manage internal settings"
      ON public.internal_settings
      FOR ALL
      TO public
      USING ((SELECT auth.role()) = 'service_role')
      WITH CHECK ((SELECT auth.role()) = 'service_role');
  END IF;
END $$;

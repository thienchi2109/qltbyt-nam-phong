-- Issue #544 follow-up: make direct throttle table access explicitly deny-all.

BEGIN;

DROP POLICY IF EXISTS auth_login_attempt_throttle_no_direct_access
  ON public.auth_login_attempt_throttle;

CREATE POLICY auth_login_attempt_throttle_no_direct_access
  ON public.auth_login_attempt_throttle
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

NOTIFY pgrst, 'reload schema';

COMMIT;

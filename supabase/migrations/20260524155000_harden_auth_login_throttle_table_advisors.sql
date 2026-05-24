-- Issue #544 follow-up: keep the throttle table private and avoid unused-index advisor noise.

BEGIN;

ALTER TABLE public.auth_login_attempt_throttle ENABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS public.idx_auth_login_throttle_updated_at;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Issue #484 follow-up: quota RPCs are server/authenticated-only, never anon.

REVOKE ALL ON FUNCTION public.ai_quota_reserve(
  TEXT,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  TIMESTAMPTZ
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.ai_quota_finalize(UUID, TEXT, INTEGER, INTEGER, NUMERIC)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.ai_quota_release_expired(TIMESTAMPTZ)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ai_quota_reserve(
  TEXT,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  TIMESTAMPTZ
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.ai_quota_finalize(UUID, TEXT, INTEGER, INTEGER, NUMERIC)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.ai_quota_release_expired(TIMESTAMPTZ)
  TO authenticated, service_role;

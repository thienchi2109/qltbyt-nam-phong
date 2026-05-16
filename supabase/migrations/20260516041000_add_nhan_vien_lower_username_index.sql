BEGIN;

-- Match authenticate_user_dual_mode's case-insensitive username lookup:
--   WHERE lower(nv.username) = v_username
CREATE INDEX IF NOT EXISTS idx_nhan_vien_lower_username
ON public.nhan_vien (lower(username));

COMMIT;

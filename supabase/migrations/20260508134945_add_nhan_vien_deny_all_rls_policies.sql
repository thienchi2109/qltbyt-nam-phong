-- Issue #405 follow-up: make the fail-closed RLS intent explicit.
-- Table grants remain revoked; these policies still deny direct Data API access
-- if a future grant accidentally re-exposes public.nhan_vien.

DROP POLICY IF EXISTS nhan_vien_deny_select ON public.nhan_vien;
DROP POLICY IF EXISTS nhan_vien_deny_insert ON public.nhan_vien;
DROP POLICY IF EXISTS nhan_vien_deny_update ON public.nhan_vien;
DROP POLICY IF EXISTS nhan_vien_deny_delete ON public.nhan_vien;

CREATE POLICY nhan_vien_deny_select
ON public.nhan_vien
FOR SELECT
TO anon, authenticated
USING (FALSE);

CREATE POLICY nhan_vien_deny_insert
ON public.nhan_vien
FOR INSERT
TO anon, authenticated
WITH CHECK (FALSE);

CREATE POLICY nhan_vien_deny_update
ON public.nhan_vien
FOR UPDATE
TO anon, authenticated
USING (FALSE)
WITH CHECK (FALSE);

CREATE POLICY nhan_vien_deny_delete
ON public.nhan_vien
FOR DELETE
TO anon, authenticated
USING (FALSE);

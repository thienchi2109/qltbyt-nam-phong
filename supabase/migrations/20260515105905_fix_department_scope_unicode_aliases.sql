-- Fix role=user department scope normalization for Vietnamese Unicode composition
-- and known department abbreviations used by equipment read RPCs.
--
-- Scope:
-- - Redefine only public._normalize_department_scope(text).
-- - Preserve strict normalized equality; do not introduce fuzzy matching.
-- - Keep the pinned search_path required for immutable helper safety.
--
-- Rollback:
-- - Forward-only. Restore the previous helper body in a new timestamped
--   migration if this comparison behavior must be reverted.

BEGIN;

CREATE OR REPLACE FUNCTION public._normalize_department_scope(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_normalized text;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  v_normalized := normalize(p_value, NFC);
  v_normalized := replace(v_normalized, chr(160), ' ');
  v_normalized := replace(v_normalized, E'\r', ' ');
  v_normalized := replace(v_normalized, E'\n', ' ');
  v_normalized := replace(v_normalized, E'\t', ' ');
  v_normalized := regexp_replace(v_normalized, '[-]+', ' ', 'g');
  v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');
  v_normalized := lower(trim(v_normalized));
  v_normalized := regexp_replace(v_normalized, '(^|\s)ct(\s|$)', '\1chấn thương\2', 'g');
  v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');
  v_normalized := trim(v_normalized);

  IF NULLIF(v_normalized, '') IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_normalized;
END;
$function$;

COMMIT;

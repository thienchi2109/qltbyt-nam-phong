-- Reassert department scope normalization after Sonar-driven source cleanup.
--
-- Scope:
-- - Keep behavior equivalent to 20260515105905.
-- - Keep live DB aligned with the local migration source after avoiding a
--   direct empty-string comparison flagged by static analysis.

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

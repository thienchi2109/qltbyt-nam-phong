-- Pin search_path for the user department scope helper introduced in batch #301.
-- Keeps helper behavior unchanged while removing the mutable search_path advisor regression.

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

  v_normalized := replace(p_value, chr(160), ' ');
  v_normalized := replace(v_normalized, E'\r', ' ');
  v_normalized := replace(v_normalized, E'\n', ' ');
  v_normalized := replace(v_normalized, E'\t', ' ');
  v_normalized := regexp_replace(v_normalized, '[-]+', ' ', 'g');
  v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');
  v_normalized := lower(trim(v_normalized));

  IF v_normalized = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_normalized;
END;
$function$;

COMMIT;

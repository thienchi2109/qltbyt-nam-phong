-- P14A2: pin search_path for the shared immutable export expressions after the
-- initial live apply. Fresh databases receive the same setting from 092214.
BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_option_display_label(
  p_supplier_name TEXT,
  p_model TEXT,
  p_option_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT p_supplier_name || ' ' || chr(183) || ' '
    || COALESCE(p_model, p_option_name);
$$;

CREATE OR REPLACE FUNCTION public._technical_configuration_derived_status(
  p_technical_axis TEXT,
  p_evidence_axis TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN p_technical_axis IS NULL THEN 'not_evaluated'
    WHEN p_technical_axis = 'not_applicable' THEN 'not_applicable'
    WHEN p_technical_axis = 'fails' THEN 'fails'
    WHEN p_technical_axis = 'unclear' THEN 'unclear'
    WHEN p_evidence_axis IS NULL THEN 'not_evaluated'
    WHEN p_evidence_axis IN ('partial', 'missing') THEN 'insufficient_evidence'
    ELSE p_technical_axis
  END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_option_display_label(
  TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_option_display_label(
  TEXT, TEXT, TEXT
) TO service_role;
REVOKE ALL ON FUNCTION public._technical_configuration_derived_status(
  TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_derived_status(
  TEXT, TEXT
) TO service_role;

COMMIT;

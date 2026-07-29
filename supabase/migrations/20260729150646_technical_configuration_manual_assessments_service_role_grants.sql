-- P11B: narrow service-role access for the already-deployed assessment table.
BEGIN;

REVOKE ALL ON TABLE public.technical_configuration_manual_assessments
  FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.technical_configuration_manual_assessments TO service_role;

COMMIT;

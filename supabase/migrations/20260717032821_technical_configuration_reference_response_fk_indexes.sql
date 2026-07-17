BEGIN;

CREATE INDEX technical_configuration_reference_responses_product_version_idx
  ON public.technical_configuration_reference_responses
  (reference_product_id, baseline_version_id);

CREATE INDEX technical_configuration_reference_responses_criterion_version_idx
  ON public.technical_configuration_reference_responses
  (criterion_id, baseline_version_id);

COMMIT;

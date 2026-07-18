BEGIN;

CREATE INDEX IF NOT EXISTS technical_configuration_baseline_citations_document_version_fk_idx
  ON public.technical_configuration_baseline_citations (
    baseline_document_id,
    baseline_version_id
  );
CREATE INDEX IF NOT EXISTS technical_configuration_baseline_citations_criterion_version_fk_idx
  ON public.technical_configuration_baseline_citations (
    criterion_id,
    baseline_version_id
  );
CREATE INDEX IF NOT EXISTS technical_configuration_reference_documents_product_version_fk_idx
  ON public.technical_configuration_reference_documents (
    reference_product_id,
    baseline_version_id
  );
CREATE INDEX IF NOT EXISTS technical_configuration_reference_citations_document_version_fk_idx
  ON public.technical_configuration_reference_citations (
    reference_document_id,
    baseline_version_id
  );
CREATE INDEX IF NOT EXISTS technical_configuration_reference_citations_criterion_version_fk_idx
  ON public.technical_configuration_reference_citations (
    criterion_id,
    baseline_version_id
  );

COMMIT;

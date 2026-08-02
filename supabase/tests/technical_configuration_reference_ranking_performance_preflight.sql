-- P13A-P1 representative ranking scale preflight.
-- Read-only and fail-closed: plan capture starts only when existing data satisfies
-- option_count > 100, criterion_count = 102, and page_size = 100.
BEGIN READ ONLY;

DO $gate$
DECLARE
  v_page_size CONSTANT INTEGER := 100;
  v_candidate_count BIGINT;
  v_observed JSONB;
BEGIN
  WITH option_counts AS (
    SELECT
      option_row.dossier_id,
      count(*)::BIGINT AS option_count
    FROM public.technical_configuration_options option_row
    GROUP BY option_row.dossier_id
  ),
  criterion_counts AS (
    SELECT
      version_row.dossier_id,
      criterion.baseline_version_id,
      count(*)::BIGINT AS criterion_count
    FROM public.technical_configuration_baseline_versions version_row
    JOIN public.technical_configuration_baseline_groups group_row
      ON group_row.baseline_version_id = version_row.id
    JOIN public.technical_configuration_baseline_criteria criterion
      ON criterion.group_id = group_row.id
    GROUP BY version_row.dossier_id, criterion.baseline_version_id
  ),
  candidates AS (
    SELECT
      criterion_counts.dossier_id,
      criterion_counts.baseline_version_id,
      COALESCE(option_counts.option_count, 0) AS option_count,
      criterion_counts.criterion_count
    FROM criterion_counts
    LEFT JOIN option_counts
      ON option_counts.dossier_id = criterion_counts.dossier_id
  ),
  candidate_summary AS (
    SELECT count(*) FILTER (
      WHERE candidates.option_count > 100
        AND candidates.criterion_count = 102
    ) AS representative_candidate_count
    FROM candidates
  )
  SELECT
    candidate_summary.representative_candidate_count,
    jsonb_build_object(
      'dossier_total',
      (SELECT count(*) FROM public.technical_configuration_dossiers),
      'option_total',
      (SELECT count(*) FROM public.technical_configuration_options),
      'criterion_total',
      (SELECT count(*) FROM public.technical_configuration_baseline_criteria),
      'page_size',
      v_page_size,
      'max_options_per_dossier',
      COALESCE((SELECT max(option_count) FROM option_counts), 0),
      'max_criteria_per_baseline',
      COALESCE((SELECT max(criterion_count) FROM criterion_counts), 0),
      'representative_candidate_count',
      candidate_summary.representative_candidate_count
    )
  INTO v_candidate_count, v_observed
  FROM candidate_summary;

  IF v_candidate_count = 0 THEN
    RAISE EXCEPTION
      'P13A-P1 representative scale unavailable: required option_count > 100 and criterion_count = 102 at page_size = %; observed %',
      v_page_size,
      v_observed;
  END IF;
END
$gate$;

COMMIT;

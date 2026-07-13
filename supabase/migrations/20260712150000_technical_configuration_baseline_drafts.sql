-- Issue #744, Phase P2: baseline draft schema and internal helpers.

BEGIN;

CREATE TABLE public.technical_configuration_baseline_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL
    REFERENCES public.technical_configuration_dossiers(id) ON DELETE CASCADE,
  version_number BIGINT NOT NULL CHECK (version_number > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'locked')),
  next_criterion_number BIGINT NOT NULL DEFAULT 1 CHECK (next_criterion_number > 0),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  UNIQUE (dossier_id, version_number)
);

CREATE UNIQUE INDEX technical_configuration_baseline_versions_one_draft_idx
  ON public.technical_configuration_baseline_versions (dossier_id)
  WHERE status = 'draft';

CREATE INDEX technical_configuration_baseline_versions_list_idx
  ON public.technical_configuration_baseline_versions
  (dossier_id, version_number DESC, id);

CREATE TABLE public.technical_configuration_baseline_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_version_id UUID NOT NULL
    REFERENCES public.technical_configuration_baseline_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  UNIQUE (id, baseline_version_id),
  CONSTRAINT technical_configuration_baseline_groups_version_sort_key
    UNIQUE (baseline_version_id, sort_order) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE public.technical_configuration_baseline_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_version_id UUID NOT NULL
    REFERENCES public.technical_configuration_baseline_versions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL,
  criterion_code TEXT NOT NULL CHECK (criterion_code ~ '^TC-[0-9]{4,}$'),
  title TEXT,
  requirement_text TEXT NOT NULL CHECK (btrim(requirement_text) <> ''),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  source_criterion_id UUID
    REFERENCES public.technical_configuration_baseline_criteria(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  UNIQUE (baseline_version_id, criterion_code),
  CONSTRAINT technical_configuration_baseline_criteria_group_sort_key
    UNIQUE (group_id, sort_order) DEFERRABLE INITIALLY IMMEDIATE,
  FOREIGN KEY (group_id, baseline_version_id)
    REFERENCES public.technical_configuration_baseline_groups (id, baseline_version_id)
    ON DELETE CASCADE
);

CREATE INDEX technical_configuration_baseline_criteria_version_order_idx
  ON public.technical_configuration_baseline_criteria
  (baseline_version_id, group_id, sort_order, id);

ALTER TABLE public.technical_configuration_baseline_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_configuration_baseline_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_configuration_baseline_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY technical_configuration_baseline_versions_no_client_access
  ON public.technical_configuration_baseline_versions
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY technical_configuration_baseline_groups_no_client_access
  ON public.technical_configuration_baseline_groups
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY technical_configuration_baseline_criteria_no_client_access
  ON public.technical_configuration_baseline_criteria
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.technical_configuration_baseline_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.technical_configuration_baseline_groups FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.technical_configuration_baseline_criteria FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.technical_configuration_baseline_versions TO service_role;
GRANT ALL ON TABLE public.technical_configuration_baseline_groups TO service_role;
GRANT ALL ON TABLE public.technical_configuration_baseline_criteria TO service_role;

CREATE OR REPLACE FUNCTION public._technical_configuration_require_editable_baseline_version(
  p_baseline_version_id UUID,
  p_expected_revision BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_dossier_id UUID;
  v_revision BIGINT;
  v_status TEXT;
  v_archived_at TIMESTAMPTZ;
BEGIN
  v_user_id := public._technical_configuration_require_global_user();

  SELECT v.dossier_id INTO v_dossier_id
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_baseline_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT d.archived_at INTO v_archived_at
  FROM public.technical_configuration_dossiers d
  WHERE d.id = v_dossier_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT v.revision, v.status INTO v_revision, v_status
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_baseline_version_id
    AND v.dossier_id = v_dossier_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'archived_dossier' USING ERRCODE = 'PT409';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'locked_version' USING ERRCODE = 'PT409';
  END IF;
  IF v_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
  END IF;

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_bump_revision(
  p_baseline_version_id UUID,
  p_user_id BIGINT
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.technical_configuration_baseline_versions
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = p_user_id
  WHERE id = p_baseline_version_id
  RETURNING revision;
$$;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_snapshot(
  p_baseline_version_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH criteria_by_group AS (
    SELECT
      c.group_id,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'baseline_version_id', c.baseline_version_id,
          'group_id', c.group_id,
          'criterion_code', c.criterion_code,
          'title', c.title,
          'requirement_text', c.requirement_text,
          'sort_order', c.sort_order,
          'source_criterion_id', c.source_criterion_id,
          'created_at', c.created_at,
          'created_by', c.created_by,
          'updated_at', c.updated_at,
          'updated_by', c.updated_by
        )
        ORDER BY c.sort_order, c.id
      ) AS criteria
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.baseline_version_id = p_baseline_version_id
    GROUP BY c.group_id
  ),
  groups_by_version AS (
    SELECT
      g.baseline_version_id,
      jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'baseline_version_id', g.baseline_version_id,
          'name', g.name,
          'sort_order', g.sort_order,
          'created_at', g.created_at,
          'created_by', g.created_by,
          'updated_at', g.updated_at,
          'updated_by', g.updated_by,
          'criteria', COALESCE(cbg.criteria, '[]'::JSONB)
        )
        ORDER BY g.sort_order, g.id
      ) AS groups
    FROM public.technical_configuration_baseline_groups g
    LEFT JOIN criteria_by_group cbg ON cbg.group_id = g.id
    WHERE g.baseline_version_id = p_baseline_version_id
    GROUP BY g.baseline_version_id
  )
  SELECT jsonb_build_object(
    'id', v.id,
    'dossier_id', v.dossier_id,
    'version_number', v.version_number,
    'status', v.status,
    'next_criterion_number', v.next_criterion_number,
    'revision', v.revision,
    'created_at', v.created_at,
    'created_by', v.created_by,
    'updated_at', v.updated_at,
    'updated_by', v.updated_by,
    'groups', COALESCE(gbv.groups, '[]'::JSONB)
  )
  FROM public.technical_configuration_baseline_versions v
  LEFT JOIN groups_by_version gbv ON gbv.baseline_version_id = v.id
  WHERE v.id = p_baseline_version_id;
$$;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_group_payload(
  p_group_id UUID,
  p_revision BIGINT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', g.id,
    'baseline_version_id', g.baseline_version_id,
    'name', g.name,
    'sort_order', g.sort_order,
    'created_at', g.created_at,
    'created_by', g.created_by,
    'updated_at', g.updated_at,
    'updated_by', g.updated_by,
    'revision', p_revision
  )
  FROM public.technical_configuration_baseline_groups g
  WHERE g.id = p_group_id;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_require_editable_baseline_version(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._technical_configuration_baseline_bump_revision(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._technical_configuration_baseline_snapshot(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._technical_configuration_baseline_group_payload(UUID, BIGINT) FROM PUBLIC, anon, authenticated;

COMMIT;

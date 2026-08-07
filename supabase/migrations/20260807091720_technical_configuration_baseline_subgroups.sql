-- P1A is schema-only: it adds hierarchy storage without changing RPC or runtime behavior.
CREATE TABLE public.technical_configuration_baseline_subgroups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_version_id UUID NOT NULL,
  group_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  CONSTRAINT tc_baseline_subgroups_id_scope_key
    UNIQUE (id, group_id, baseline_version_id),
  CONSTRAINT tc_baseline_subgroups_group_sort_key
    UNIQUE (group_id, sort_order) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT tc_baseline_subgroups_group_scope_fkey
    FOREIGN KEY (group_id, baseline_version_id)
    REFERENCES public.technical_configuration_baseline_groups (id, baseline_version_id)
    ON DELETE CASCADE
);

CREATE INDEX tc_baseline_subgroups_version_order_idx
  ON public.technical_configuration_baseline_subgroups
  (baseline_version_id, group_id, sort_order, id);

ALTER TABLE public.technical_configuration_baseline_subgroups ENABLE ROW LEVEL SECURITY;

CREATE POLICY technical_configuration_baseline_subgroups_no_client_access
  ON public.technical_configuration_baseline_subgroups
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.technical_configuration_baseline_subgroups FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.technical_configuration_baseline_subgroups TO service_role;

-- Existing criteria remain direct children because subgroup ownership is nullable and unfilled.
ALTER TABLE public.technical_configuration_baseline_criteria
  ADD COLUMN subgroup_id UUID;

ALTER TABLE public.technical_configuration_baseline_criteria
  ADD CONSTRAINT tc_baseline_criteria_subgroup_scope_fkey
  FOREIGN KEY (subgroup_id, group_id, baseline_version_id)
  REFERENCES public.technical_configuration_baseline_subgroups
    (id, group_id, baseline_version_id)
  ON DELETE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX tc_baseline_criteria_subgroup_order_idx
  ON public.technical_configuration_baseline_criteria
  (subgroup_id, sort_order, id)
  WHERE subgroup_id IS NOT NULL;

-- Never drop populated hierarchy data; rollback should retain this additive schema.

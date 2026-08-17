/** Query for portable application structure from a disposable PostgreSQL database. */
export const APPLICATION_CATALOG_QUERY = `
WITH relations AS (
  SELECT jsonb_build_object(
    'columns',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'dataType', format_type(attribute.atttypid, attribute.atttypmod),
        'name', attribute.attname,
        'nullable', NOT attribute.attnotnull
      ) ORDER BY attribute.attname)
      FROM pg_attribute attribute
      WHERE attribute.attrelid = relation.oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    ), '[]'::jsonb),
    'constraints',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'definition', pg_get_constraintdef(constraint.oid, true),
        'name', constraint.conname
      ) ORDER BY constraint.conname)
      FROM pg_constraint constraint
      WHERE constraint.conrelid = relation.oid
    ), '[]'::jsonb),
    'identity', format('%I.%I', namespace.nspname, relation.relname),
    'indexes',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'definition', pg_get_indexdef(index_relation.oid),
        'name', index_relation.relname
      ) ORDER BY index_relation.relname)
      FROM pg_index index_entry
      JOIN pg_class index_relation ON index_relation.oid = index_entry.indexrelid
      WHERE index_entry.indrelid = relation.oid
    ), '[]'::jsonb),
    'kind', CASE WHEN relation.relkind = 'v' THEN 'view' ELSE 'table' END,
    'triggers',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'definition', pg_get_triggerdef(trigger.oid, true),
        'name', trigger.tgname
      ) ORDER BY trigger.tgname)
      FROM pg_trigger trigger
      WHERE trigger.tgrelid = relation.oid
        AND NOT trigger.tgisinternal
    ), '[]'::jsonb)
  ) AS value
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p', 'v')
),
routines AS (
  SELECT jsonb_build_object(
    'definition', pg_get_functiondef(routine.oid),
    'identity', format('%I.%I(%s)', namespace.nspname, routine.proname, pg_get_function_identity_arguments(routine.oid)),
    'kind', CASE WHEN routine.prokind = 'p' THEN 'procedure' ELSE 'function' END
  ) AS value
  FROM pg_proc routine
  JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
  WHERE namespace.nspname = 'public'
)
SELECT jsonb_build_object(
  'relations', COALESCE((SELECT jsonb_agg(value ORDER BY value->>'identity') FROM relations), '[]'::jsonb),
  'routines', COALESCE((SELECT jsonb_agg(value ORDER BY value->>'identity') FROM routines), '[]'::jsonb)
);
`

/** Query for ownership, grants, RLS, policies, and routine execution boundaries. */
export const ACCESS_CATALOG_QUERY = `
WITH table_grants AS (
  SELECT table_schema, table_name, grantee,
    array_agg(privilege_type ORDER BY privilege_type) AS operations
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
  GROUP BY table_schema, table_name, grantee
),
routine_grants AS (
  SELECT routine_schema, routine_name, specific_name, grantee,
    array_agg(privilege_type ORDER BY privilege_type) AS operations
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
  GROUP BY routine_schema, routine_name, specific_name, grantee
),
tables AS (
  SELECT jsonb_build_object(
    'grants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('operations', grant_row.operations, 'role', grant_row.grantee) ORDER BY grant_row.grantee)
      FROM table_grants grant_row
      WHERE grant_row.table_name = relation.relname
    ), '[]'::jsonb),
    'identity', format('%I.%I', namespace.nspname, relation.relname),
    'owner', owner_role.rolname,
    'policies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'command', CASE policy.polcmd
          WHEN '*' THEN 'ALL'
          WHEN 'a' THEN 'INSERT'
          WHEN 'r' THEN 'SELECT'
          WHEN 'w' THEN 'UPDATE'
          WHEN 'd' THEN 'DELETE'
        END,
        'identity', policy.polname,
        'permissive', policy.polpermissive,
        'roles', COALESCE((SELECT jsonb_agg(role.rolname ORDER BY role.rolname) FROM pg_roles role WHERE role.oid = ANY(policy.polroles)), '[]'::jsonb),
        'using', pg_get_expr(policy.polqual, policy.polrelid),
        'withCheck', pg_get_expr(policy.polwithcheck, policy.polrelid)
      ) ORDER BY policy.polname)
      FROM pg_policy policy
      WHERE policy.polrelid = relation.oid
    ), '[]'::jsonb),
    'rls', jsonb_build_object('enabled', relation.relrowsecurity, 'forced', relation.relforcerowsecurity)
  ) AS value
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  JOIN pg_roles owner_role ON owner_role.oid = relation.relowner
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p')
),
routines AS (
  SELECT jsonb_build_object(
    'executionMode', CASE WHEN routine.prosecdef THEN 'definer' ELSE 'invoker' END,
    'grants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('operations', grant_row.operations, 'role', grant_row.grantee) ORDER BY grant_row.grantee)
      FROM routine_grants grant_row
      WHERE grant_row.specific_name = routine.proname || '_' || routine.oid::text
    ), '[]'::jsonb),
    'identity', format('%I.%I(%s)', namespace.nspname, routine.proname, pg_get_function_identity_arguments(routine.oid)),
    'owner', owner_role.rolname,
    'searchPath', NULLIF(
      regexp_replace(
        COALESCE((
          SELECT setting
          FROM unnest(routine.proconfig) AS setting
          WHERE setting LIKE 'search_path=%'
          LIMIT 1
        ), ''),
        '^search_path=',
        ''
      ),
      ''
    )
  ) AS value
  FROM pg_proc routine
  JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
  JOIN pg_roles owner_role ON owner_role.oid = routine.proowner
  WHERE namespace.nspname = 'public'
)
SELECT jsonb_build_object(
  'routines', COALESCE((SELECT jsonb_agg(value ORDER BY value->>'identity') FROM routines), '[]'::jsonb),
  'tables', COALESCE((SELECT jsonb_agg(value ORDER BY value->>'identity') FROM tables), '[]'::jsonb)
);
`

/** Query for the non-portable environment facts that contextualize disposable replay evidence. */
export const ENVIRONMENT_CATALOG_QUERY = `
SELECT jsonb_build_object(
  'extensions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', extension.extname,
      'schema', namespace.nspname,
      'version', extension.extversion
    ) ORDER BY extension.extname)
    FROM pg_extension extension
    JOIN pg_namespace namespace ON namespace.oid = extension.extnamespace
  ), '[]'::jsonb),
  'postgresqlVersion', current_setting('server_version'),
  'supabaseVersion', COALESCE(current_setting('app.settings.supabase_version', true), 'unavailable')
);
`

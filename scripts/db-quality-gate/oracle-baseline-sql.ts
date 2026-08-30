/** Reads the migration and structural health evidence required by baseline state. */
export const BASELINE_OBSERVATION_QUERY = `
WITH technical_configuration_catalog AS (
  SELECT json_build_object(
    'definitionSha256', encode(
      extensions.digest(
        convert_to(
          regexp_replace(pg_get_functiondef(routine.oid), E'\\n$', ''),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ),
    'executeGrantees', COALESCE((
      SELECT json_agg(
        CASE
          WHEN privilege.grantee = 0 THEN 'PUBLIC'
          ELSE grantee_role.rolname
        END
        ORDER BY
          CASE
            WHEN privilege.grantee = 0 THEN 'PUBLIC'
            ELSE grantee_role.rolname
          END
      )
      FROM aclexplode(
        COALESCE(routine.proacl, acldefault('f', routine.proowner))
      ) AS privilege
      LEFT JOIN pg_roles grantee_role ON grantee_role.oid = privilege.grantee
      WHERE privilege.privilege_type = 'EXECUTE'
    ), '[]'::json),
    'executionMode', CASE WHEN routine.prosecdef THEN 'definer' ELSE 'invoker' END,
    'identity', format(
      '%I.%I(%s)',
      namespace.nspname,
      routine.proname,
      pg_get_function_identity_arguments(routine.oid)
    ),
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
    AND routine.proname ~ '^technical_configuration_'
)
SELECT json_build_object(
  'healthy', true,
  'invalidIndexCount', (
    SELECT count(*)::int
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT i.indisvalid
      AND n.nspname NOT IN (
        'auth',
        'extensions',
        'graphql',
        'graphql_public',
        'information_schema',
        'net',
        'pg_catalog',
        'pgsodium',
        'pgsodium_masks',
        'realtime',
        'storage',
        'supabase_functions',
        'supabase_migrations',
        'vault'
      )
  ),
  'migrationHighWater', COALESCE(
    (SELECT max(version) FROM supabase_migrations.schema_migrations),
    'unavailable'
  ),
  'migrationRecords', COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'liveName', COALESCE(name, ''),
          'liveVersion', version,
          'sqlSha256', encode(
            extensions.digest(
              convert_to(
                regexp_replace(
                  replace(COALESCE(statements[1], ''), E'\r\n', E'\n'),
                  E'\n$',
                  ''
                ),
                'UTF8'
              ),
              'sha256'
            ),
            'hex'
          )
        )
        ORDER BY version
      )
      FROM supabase_migrations.schema_migrations
    ),
    '[]'::json
  ),
  'postgresHasCreateOnPublic',
    has_schema_privilege('postgres', 'public', 'CREATE'),
  'technicalConfigurationCatalog', COALESCE(
    (
      SELECT json_agg(value ORDER BY value->>'identity')
      FROM technical_configuration_catalog
    ),
    '[]'::json
  ),
  'unvalidatedConstraintCount', (
    SELECT count(*)::int
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE NOT c.convalidated
      -- Supabase-managed schemas are excluded from application-owned debt.
      -- realtime.messages.messages_payload_exclusive is upstream-managed.
      -- It intentionally uses NOT VALID to protect new rows.
      AND n.nspname NOT IN (
        'auth',
        'extensions',
        'graphql',
        'graphql_public',
        'information_schema',
        'net',
        'pg_catalog',
        'pgsodium',
        'pgsodium_masks',
        'realtime',
        'storage',
        'supabase_functions',
        'supabase_migrations',
        'vault'
      )
  )
)::text;
`

/** Verifies the distinct migration and metadata role capabilities before maintenance mutates state. */
export const BASELINE_ROLE_PREFLIGHT_QUERY = `
SELECT json_build_object(
  'adminCanManageSchema', COALESCE((
    SELECT pg_has_role('supabase_admin', namespace.nspowner, 'USAGE')
    FROM pg_namespace namespace
    WHERE namespace.nspname = 'public'
  ), false),
  'adminCanSetRole', pg_has_role('supabase_admin', 'postgres', 'SET'),
  'adminCanWriteMetadata',
    has_table_privilege(
      'supabase_admin',
      'supabase_migrations.schema_migrations',
      'INSERT'
    )
    AND has_table_privilege(
      'supabase_admin',
      'supabase_migrations.schema_migrations',
      'SELECT'
    ),
  'postgresHasCreateOnPublic',
    has_schema_privilege('postgres', 'public', 'CREATE'),
  'postgresHasUsageOnPublic',
    has_schema_privilege('postgres', 'public', 'USAGE')
)::text;
`

/** Confirms that temporary schema CREATE is absent after every migration attempt. */
export const POSTGRES_CREATE_PRIVILEGE_QUERY = `
SELECT has_schema_privilege('postgres', 'public', 'CREATE')::text;
`

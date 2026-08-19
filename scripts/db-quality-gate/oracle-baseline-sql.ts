/** Reads the migration and structural health evidence required by baseline state. */
export const BASELINE_OBSERVATION_QUERY = `
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
  'unvalidatedConstraintCount', (
    SELECT count(*)::int
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE NOT c.convalidated
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

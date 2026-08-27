import { validConfirmation } from "./baseline-state"
import { migrationContentSha256 } from "./migration-source"
import type { ConfirmedMigrationInput } from "./baseline-maintenance-recovery"

/** Builds an exact hash-validated migration metadata insert statement. */
export function metadataStatement(migration: ConfirmedMigrationInput): string | undefined {
  if (
    !validConfirmation(migration) ||
    migrationContentSha256(migration.content) !== migration.sha256
  ) {
    return undefined
  }
  const delimiter = `$dq_${migration.sha256.slice(0, 16)}$`
  if (migration.content.includes(delimiter)) {
    return undefined
  }

  return `INSERT INTO supabase_migrations.schema_migrations(version, statements, name)
VALUES (
  '${migration.liveVersion}',
  ARRAY[${delimiter}${migration.content}${delimiter}],
  '${migration.liveName}'
);`
}

/** Checks that migration identity and canonical content hash agree. */
export function validMigrationInput(migration: ConfirmedMigrationInput): boolean {
  return (
    validConfirmation(migration) && migrationContentSha256(migration.content) === migration.sha256
  )
}

/** Builds a read-only query that classifies metadata as missing, exact, or conflicting. */
export function migrationMetadataStatusQuery(
  migration: ConfirmedMigrationInput
): string | undefined {
  if (!validMigrationInput(migration)) {
    return undefined
  }
  return `
WITH metadata AS (
  SELECT
    name,
    encode(
      extensions.digest(
        convert_to(
          regexp_replace(
            replace(COALESCE(statements[1], ''), E'\\r\\n', E'\\n'),
            E'\\n$',
            ''
          ),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ) AS sql_sha256
  FROM supabase_migrations.schema_migrations
  WHERE version = '${migration.liveVersion}'
)
SELECT json_build_object(
  'metadataStatus',
  CASE
    WHEN count(*) = 0 THEN 'missing'
    WHEN count(*) = 1
      AND bool_and(name = '${migration.liveName}' AND sql_sha256 = '${migration.sha256}')
      THEN 'exact'
    ELSE 'conflict'
  END
)::text
FROM metadata;
`
}

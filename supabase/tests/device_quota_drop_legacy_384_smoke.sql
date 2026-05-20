-- Smoke test: DQSS suggestions use the VM/768 path only.
-- The retired Supabase 384-dimensional fallback must stay removed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nhom_thiet_bi'
      AND column_name = 'embedding'
  ) THEN
    RAISE EXCEPTION 'public.nhom_thiet_bi.embedding must be retired';
  END IF;

  IF to_regprocedure(
    'public.hybrid_search_category_batch(jsonb,bigint,integer,double precision,double precision,integer)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'public.hybrid_search_category_batch must be retired';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    JOIN pg_catalog.pg_class cls ON cls.relname = c.table_name
    JOIN pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace AND ns.nspname = c.table_schema
    JOIN pg_catalog.pg_attribute a
      ON a.attrelid = cls.oid
      AND a.attname = c.column_name
      AND a.attnum > 0
      AND NOT a.attisdropped
    WHERE c.table_schema = 'public'
      AND c.table_name = 'device_quota_category_embeddings'
      AND c.column_name = 'embedding'
      AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'vector(768)'
  ) THEN
    RAISE EXCEPTION 'public.device_quota_category_embeddings.embedding vector(768) must remain';
  END IF;
END $$;

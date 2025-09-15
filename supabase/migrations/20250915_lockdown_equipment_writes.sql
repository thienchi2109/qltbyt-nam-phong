-- Incremental lock-down: enforce RPC-only writes for equipment
-- Keep SELECT temporarily to avoid breaking remaining read paths that still use nested selects

BEGIN;

-- Revoke direct write privileges for authenticated users on thiet_bi
REVOKE INSERT, UPDATE, DELETE ON TABLE public.thiet_bi FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.thiet_bi FROM anon;

-- Optionally restrict sequence usage if present
DO $$
DECLARE
  seq_name TEXT;
BEGIN
  SELECT pg_class.relname INTO seq_name
  FROM pg_class
  JOIN pg_namespace ns ON ns.oid = pg_class.relnamespace
  WHERE ns.nspname = 'public' AND pg_class.relkind = 'S' AND pg_class.relname = 'thiet_bi_id_seq';

  IF seq_name IS NOT NULL THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON SEQUENCE public.' || quote_ident(seq_name) || ' FROM authenticated, anon';
  END IF;
END $$;

COMMIT;

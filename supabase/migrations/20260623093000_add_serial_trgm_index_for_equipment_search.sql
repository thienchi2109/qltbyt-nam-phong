-- Add serial trigram index for equipment_list_enhanced search.
--
-- equipment_list_enhanced searches serial with ILIKE alongside
-- ten_thiet_bi, ma_thiet_bi, so_luu_hanh, and model. Keep the search columns
-- consistently indexed for the combined OR predicate.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_thiet_bi_serial_trgm
ON public.thiet_bi USING gin (serial gin_trgm_ops);

COMMIT;

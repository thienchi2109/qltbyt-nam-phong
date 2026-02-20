-- Migration: Drop legacy equipment_list_enhanced overload with p_fields
-- Date: 2026-02-16
-- Reason: Remove obsolete 18-parameter signature after callers moved to 17-parameter version.

BEGIN;

DROP FUNCTION IF EXISTS public.equipment_list_enhanced(
  TEXT,
  TEXT,
  INT,
  INT,
  BIGINT,
  TEXT,
  TEXT[],
  TEXT,
  TEXT[],
  TEXT,
  TEXT[],
  TEXT,
  TEXT[],
  TEXT,
  TEXT[],
  TEXT,
  TEXT[],
  TEXT
);

COMMIT;

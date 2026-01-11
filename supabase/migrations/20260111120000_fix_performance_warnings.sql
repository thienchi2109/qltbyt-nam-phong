-- Migration: Fix performance warnings from Supabase Advisor
-- Date: 2026-01-11
-- Issues addressed:
--   1. RLS policies with inefficient auth function calls (re-evaluated per row)
--   2. Duplicate indexes wasting storage

BEGIN;

-- ============================================================================
-- PART 1: Fix RLS policies with inefficient auth function calls
-- Issue: auth.uid() and auth.role() are re-evaluated for each row
-- Fix: Wrap in subselect (select auth.uid()) to evaluate once per query
-- ============================================================================

-- Drop and recreate user_fcm_tokens policies with optimized auth calls
DROP POLICY IF EXISTS "Users can only select their own tokens" ON public.user_fcm_tokens;
DROP POLICY IF EXISTS "Users can only insert their own tokens" ON public.user_fcm_tokens;
DROP POLICY IF EXISTS "Users can only update their own tokens" ON public.user_fcm_tokens;
DROP POLICY IF EXISTS "Users can only delete their own tokens" ON public.user_fcm_tokens;

CREATE POLICY "Users can only select their own tokens"
  ON public.user_fcm_tokens
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can only insert their own tokens"
  ON public.user_fcm_tokens
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can only update their own tokens"
  ON public.user_fcm_tokens
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can only delete their own tokens"
  ON public.user_fcm_tokens
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Drop and recreate internal_settings policy with optimized auth call
DROP POLICY IF EXISTS "service_role can manage internal settings" ON public.internal_settings;

CREATE POLICY "service_role can manage internal settings"
  ON public.internal_settings
  FOR ALL
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

-- ============================================================================
-- PART 2: Remove duplicate indexes
-- Each pair has identical definitions, keeping one is sufficient
-- ============================================================================

-- dia_ban: Keep dia_ban_ma_dia_ban_key (UNIQUE constraint), drop idx_dia_ban_ma_dia_ban
DROP INDEX IF EXISTS public.idx_dia_ban_ma_dia_ban;

-- thiet_bi: Keep idx_thiet_bi_search, drop idx_thiet_bi_text_search
DROP INDEX IF EXISTS public.idx_thiet_bi_text_search;

-- yeu_cau_luan_chuyen: Keep idx_yclc_thiet_bi_id (shorter name), drop idx_yeu_cau_luan_chuyen_thiet_bi
DROP INDEX IF EXISTS public.idx_yeu_cau_luan_chuyen_thiet_bi;

-- yeu_cau_sua_chua: Keep idx_yeu_cau_sua_chua_thiet_bi_id (clearer name), drop idx_yeu_cau_sua_chua_thiet_bi_don_vi
DROP INDEX IF EXISTS public.idx_yeu_cau_sua_chua_thiet_bi_don_vi;

COMMIT;

-- ============================================================================
-- NOTE: Unused indexes (51 INFO level warnings) are NOT removed in this migration.
-- These may become useful as the application scales. Monitor usage and consider
-- removing in a future migration if they remain unused after significant traffic.
-- ============================================================================

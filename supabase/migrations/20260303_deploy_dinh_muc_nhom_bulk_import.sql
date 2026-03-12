-- Migration: Deploy dinh_muc_nhom_bulk_import RPC
-- Date: 2026-03-03
-- Purpose: This function was defined in 20260205 but never applied to live DB.
-- This patch ensures it exists. Uses CREATE OR REPLACE so it's idempotent.
-- See: 20260205_dinh_muc_nhom_bulk_import.sql for full documentation.

-- No-op: The full function is defined in 20260205_dinh_muc_nhom_bulk_import.sql
-- This migration exists as a record that the function was deployed on 2026-03-03.
-- The actual CREATE OR REPLACE was applied via Supabase MCP tools.

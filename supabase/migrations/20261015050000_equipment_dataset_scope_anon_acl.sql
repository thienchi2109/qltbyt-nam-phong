-- Keep every equipment dataset-scoped overload private to authenticated callers.
-- The dataset migration left anon execution on scoped overloads; this
-- append-only follow-up closes that exposure while preserving
-- authenticated/service_role.

REVOKE EXECUTE ON FUNCTION public.equipment_aggregate_search(text, text, bigint, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.equipment_aggregates_for_reports(bigint[], text, date, date, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.equipment_count_enhanced(text[], text, bigint, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.equipment_department_distribution(text, bigint, text, text[], text, text[], text, text[], text, text[], text, text[], text, text[], text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.equipment_filter_buckets(text, bigint, text[], text[], text[], text[], text[], text[], text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.equipment_list_enhanced(text, text, integer, integer, bigint, text, text[], text, text[], text, text[], text, text[], text, text[], text, text[], boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.equipment_list_for_reports(text, text, integer, integer, bigint, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.equipment_status_distribution(text, bigint, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.equipment_status_distribution(bigint, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unused_equipment_report_for_reports(bigint, text, text, integer, integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_repair_request_stats(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_maintenance_plan_stats(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_equipment_total(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_kpi_summary(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_maintenance_count(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dinh_muc_compliance_detail(bigint, bigint, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dinh_muc_compliance_summary(bigint, bigint, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.equipment_attention_list(integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.equipment_attention_list_paginated(integer, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_facilities_with_equipment_count(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.maintenance_stats_for_reports(date, date, bigint, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.usage_analytics_daily(integer, bigint, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.usage_analytics_overview(bigint, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.usage_log_list(bigint, text, boolean, timestamp with time zone, timestamp with time zone, integer, integer, bigint, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.usage_log_list(text, text, integer, integer, date, date, bigint, text) FROM anon;

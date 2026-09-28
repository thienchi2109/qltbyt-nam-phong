-- Set read-only session defaults on the existing ai_query_tool login role.
-- The passworded role is provisioned manually. This file does not create it
-- and does not change its password, membership, grants, or PUBLIC EXECUTE.
-- Application fails closed when that role is absent.

BEGIN;

ALTER ROLE ai_query_tool SET default_transaction_read_only = on;
ALTER ROLE ai_query_tool SET statement_timeout = '5s';
ALTER ROLE ai_query_tool SET idle_in_transaction_session_timeout = '5s';
ALTER ROLE ai_query_tool SET search_path = ai_readonly, pg_catalog;

COMMIT;

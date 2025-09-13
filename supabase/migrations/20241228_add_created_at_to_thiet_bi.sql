-- =====================================================
-- ADD CREATED_AT COLUMN TO THIET_BI TABLE
-- =====================================================
-- This migration adds created_at column to track when equipment records
-- are added to the system (different from ngay_nhap which is the actual
-- equipment import date into inventory)

-- Add created_at column with default value for new records
ALTER TABLE thiet_bi 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Set created_at for existing records to a reasonable default
-- Use ngay_nhap if available, otherwise use a default date
UPDATE thiet_bi 
SET created_at = COALESCE(
    ngay_nhap::timestamptz, 
    '2024-01-01 00:00:00+00'::timestamptz
)
WHERE created_at IS NULL;

-- Make created_at NOT NULL after setting values for existing records
ALTER TABLE thiet_bi 
ALTER COLUMN created_at SET NOT NULL;

-- Add comment to explain the column purpose
COMMENT ON COLUMN thiet_bi.created_at IS 'Thời gian bản ghi thiết bị được tạo trong hệ thống (khác với ngay_nhap là ngày nhập thiết bị vào kho thực tế)';

-- Create index for performance on created_at queries (for reports)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_created_at 
ON thiet_bi (created_at);

COMMENT ON INDEX idx_thiet_bi_created_at IS 'Index for equipment creation date queries in reports';

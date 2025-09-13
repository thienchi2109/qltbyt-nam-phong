-- Add completion tracking columns to cong_viec_bao_tri table
ALTER TABLE cong_viec_bao_tri 
ADD COLUMN IF NOT EXISTS thang_1_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thang_2_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thang_3_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thang_4_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thang_5_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thang_6_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thang_7_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thang_8_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thang_9_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thang_10_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thang_11_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thang_12_hoan_thanh BOOLEAN DEFAULT FALSE;

-- Add completion date tracking columns
ALTER TABLE cong_viec_bao_tri 
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_1 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_2 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_3 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_4 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_5 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_6 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_7 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_8 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_9 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_10 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_11 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ngay_hoan_thanh_12 TIMESTAMPTZ;

-- Add updated_at column if not exists
ALTER TABLE cong_viec_bao_tri 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cong_viec_bao_tri_updated_at ON cong_viec_bao_tri;
CREATE TRIGGER update_cong_viec_bao_tri_updated_at
    BEFORE UPDATE ON cong_viec_bao_tri
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 
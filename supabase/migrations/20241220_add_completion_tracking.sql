-- Add completion tracking columns to cong_viec_bao_tri table
-- These columns will track whether a scheduled maintenance task has been completed

ALTER TABLE cong_viec_bao_tri
ADD COLUMN thang_1_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_1 TIMESTAMPTZ,
ADD COLUMN thang_2_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_2 TIMESTAMPTZ,
ADD COLUMN thang_3_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_3 TIMESTAMPTZ,
ADD COLUMN thang_4_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_4 TIMESTAMPTZ,
ADD COLUMN thang_5_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_5 TIMESTAMPTZ,
ADD COLUMN thang_6_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_6 TIMESTAMPTZ,
ADD COLUMN thang_7_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_7 TIMESTAMPTZ,
ADD COLUMN thang_8_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_8 TIMESTAMPTZ,
ADD COLUMN thang_9_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_9 TIMESTAMPTZ,
ADD COLUMN thang_10_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_10 TIMESTAMPTZ,
ADD COLUMN thang_11_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_11 TIMESTAMPTZ,
ADD COLUMN thang_12_hoan_thanh BOOLEAN DEFAULT FALSE,
ADD COLUMN ngay_hoan_thanh_12 TIMESTAMPTZ;

-- Add comments to describe the new columns
COMMENT ON COLUMN cong_viec_bao_tri.thang_1_hoan_thanh IS 'Đánh dấu công việc tháng 1 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_1 IS 'Ngày hoàn thành thực tế công việc tháng 1';

COMMENT ON COLUMN cong_viec_bao_tri.thang_2_hoan_thanh IS 'Đánh dấu công việc tháng 2 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_2 IS 'Ngày hoàn thành thực tế công việc tháng 2';

COMMENT ON COLUMN cong_viec_bao_tri.thang_3_hoan_thanh IS 'Đánh dấu công việc tháng 3 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_3 IS 'Ngày hoàn thành thực tế công việc tháng 3';

COMMENT ON COLUMN cong_viec_bao_tri.thang_4_hoan_thanh IS 'Đánh dấu công việc tháng 4 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_4 IS 'Ngày hoàn thành thực tế công việc tháng 4';

COMMENT ON COLUMN cong_viec_bao_tri.thang_5_hoan_thanh IS 'Đánh dấu công việc tháng 5 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_5 IS 'Ngày hoàn thành thực tế công việc tháng 5';

COMMENT ON COLUMN cong_viec_bao_tri.thang_6_hoan_thanh IS 'Đánh dấu công việc tháng 6 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_6 IS 'Ngày hoàn thành thực tế công việc tháng 6';

COMMENT ON COLUMN cong_viec_bao_tri.thang_7_hoan_thanh IS 'Đánh dấu công việc tháng 7 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_7 IS 'Ngày hoàn thành thực tế công việc tháng 7';

COMMENT ON COLUMN cong_viec_bao_tri.thang_8_hoan_thanh IS 'Đánh dấu công việc tháng 8 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_8 IS 'Ngày hoàn thành thực tế công việc tháng 8';

COMMENT ON COLUMN cong_viec_bao_tri.thang_9_hoan_thanh IS 'Đánh dấu công việc tháng 9 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_9 IS 'Ngày hoàn thành thực tế công việc tháng 9';

COMMENT ON COLUMN cong_viec_bao_tri.thang_10_hoan_thanh IS 'Đánh dấu công việc tháng 10 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_10 IS 'Ngày hoàn thành thực tế công việc tháng 10';

COMMENT ON COLUMN cong_viec_bao_tri.thang_11_hoan_thanh IS 'Đánh dấu công việc tháng 11 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_11 IS 'Ngày hoàn thành thực tế công việc tháng 11';

COMMENT ON COLUMN cong_viec_bao_tri.thang_12_hoan_thanh IS 'Đánh dấu công việc tháng 12 đã hoàn thành';
COMMENT ON COLUMN cong_viec_bao_tri.ngay_hoan_thanh_12 IS 'Ngày hoàn thành thực tế công việc tháng 12'; 
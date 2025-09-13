-- Migration for Luân chuyển (Equipment Transfer/Circulation) system
-- This creates tables for managing equipment transfers between departments and external organizations

-- Create yeu_cau_luan_chuyen table for transfer requests
CREATE TABLE IF NOT EXISTS yeu_cau_luan_chuyen (
    id SERIAL PRIMARY KEY,
    ma_yeu_cau VARCHAR(50) UNIQUE NOT NULL, -- Auto-generated request ID like LC-2024-001
    thiet_bi_id INTEGER NOT NULL REFERENCES thiet_bi(id) ON DELETE CASCADE,
    loai_hinh VARCHAR(20) NOT NULL CHECK (loai_hinh IN ('noi_bo', 'ben_ngoai')), -- noi_bo (internal) or ben_ngoai (external)
    trang_thai VARCHAR(20) NOT NULL DEFAULT 'cho_duyet' CHECK (trang_thai IN ('cho_duyet', 'da_duyet', 'dang_luan_chuyen', 'hoan_thanh')),
    
    -- Request details
    nguoi_yeu_cau_id INTEGER REFERENCES nhan_vien(id),
    ly_do_luan_chuyen TEXT NOT NULL,
    
    -- For internal transfers (noi_bo)
    khoa_phong_hien_tai VARCHAR(100), -- Current department
    khoa_phong_nhan VARCHAR(100), -- Receiving department
    
    -- For external transfers (ben_ngoai)
    muc_dich VARCHAR(50) CHECK (muc_dich IN ('sua_chua', 'cho_muon', 'thanh_ly', 'khac')), -- repair, loan, disposal, other
    don_vi_nhan VARCHAR(200), -- External organization name
    dia_chi_don_vi TEXT, -- External organization address
    nguoi_lien_he VARCHAR(100), -- Contact person
    so_dien_thoai VARCHAR(20), -- Contact phone
    
    -- Timeline fields
    ngay_du_kien_tra DATE, -- Expected return date (for external only)
    ngay_ban_giao TIMESTAMPTZ, -- Handover date
    ngay_hoan_tra TIMESTAMPTZ, -- Return date (for external)
    ngay_hoan_thanh TIMESTAMPTZ, -- Completion date
    
    -- Approval tracking
    nguoi_duyet_id INTEGER REFERENCES nhan_vien(id),
    ngay_duyet TIMESTAMPTZ,
    ghi_chu_duyet TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER REFERENCES nhan_vien(id),
    updated_by INTEGER REFERENCES nhan_vien(id)
);

-- Create lich_su_luan_chuyen table for tracking all state changes
CREATE TABLE IF NOT EXISTS lich_su_luan_chuyen (
    id SERIAL PRIMARY KEY,
    yeu_cau_id INTEGER NOT NULL REFERENCES yeu_cau_luan_chuyen(id) ON DELETE CASCADE,
    trang_thai_cu VARCHAR(20),
    trang_thai_moi VARCHAR(20) NOT NULL,
    hanh_dong VARCHAR(50) NOT NULL, -- create, approve, handover, return, complete, edit
    mo_ta TEXT,
    nguoi_thuc_hien_id INTEGER REFERENCES nhan_vien(id),
    thoi_gian TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE yeu_cau_luan_chuyen IS 'Bảng quản lý yêu cầu luân chuyển thiết bị';
COMMENT ON COLUMN yeu_cau_luan_chuyen.loai_hinh IS 'Loại hình: noi_bo (nội bộ), ben_ngoai (bên ngoài)';
COMMENT ON COLUMN yeu_cau_luan_chuyen.trang_thai IS 'Trạng thái: cho_duyet, da_duyet, dang_luan_chuyen, hoan_thanh';
COMMENT ON COLUMN yeu_cau_luan_chuyen.muc_dich IS 'Mục đích (chỉ cho bên ngoài): sua_chua, cho_muon, thanh_ly, khac';

-- Create indexes for better performance
CREATE INDEX idx_yeu_cau_luan_chuyen_trang_thai ON yeu_cau_luan_chuyen(trang_thai);
CREATE INDEX idx_yeu_cau_luan_chuyen_loai_hinh ON yeu_cau_luan_chuyen(loai_hinh);
CREATE INDEX idx_yeu_cau_luan_chuyen_thiet_bi ON yeu_cau_luan_chuyen(thiet_bi_id);
CREATE INDEX idx_yeu_cau_luan_chuyen_created_at ON yeu_cau_luan_chuyen(created_at);
CREATE INDEX idx_lich_su_luan_chuyen_yeu_cau ON lich_su_luan_chuyen(yeu_cau_id);

-- Function to auto-generate request codes
CREATE OR REPLACE FUNCTION generate_ma_yeu_cau_luan_chuyen()
RETURNS TRIGGER AS $$
DECLARE
    current_year INTEGER := EXTRACT(YEAR FROM NOW());
    max_number INTEGER;
    new_code VARCHAR(50);
BEGIN
    -- Get the highest number for current year
    SELECT COALESCE(MAX(CAST(SUBSTRING(ma_yeu_cau FROM 'LC-' || current_year || '-(\d+)') AS INTEGER)), 0)
    INTO max_number
    FROM yeu_cau_luan_chuyen
    WHERE ma_yeu_cau LIKE 'LC-' || current_year || '-%';
    
    -- Generate new code
    new_code := 'LC-' || current_year || '-' || LPAD((max_number + 1)::TEXT, 3, '0');
    NEW.ma_yeu_cau := new_code;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating request codes
CREATE TRIGGER trigger_generate_ma_yeu_cau_luan_chuyen
    BEFORE INSERT ON yeu_cau_luan_chuyen
    FOR EACH ROW
    WHEN (NEW.ma_yeu_cau IS NULL OR NEW.ma_yeu_cau = '')
    EXECUTE FUNCTION generate_ma_yeu_cau_luan_chuyen();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
CREATE TRIGGER trigger_update_yeu_cau_luan_chuyen_updated_at
    BEFORE UPDATE ON yeu_cau_luan_chuyen
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically log history when status changes
CREATE OR REPLACE FUNCTION log_luan_chuyen_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF (TG_OP = 'INSERT') OR (OLD.trang_thai IS DISTINCT FROM NEW.trang_thai) THEN
        INSERT INTO lich_su_luan_chuyen (
            yeu_cau_id,
            trang_thai_cu,
            trang_thai_moi,
            hanh_dong,
            mo_ta,
            nguoi_thuc_hien_id
        ) VALUES (
            NEW.id,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.trang_thai END,
            NEW.trang_thai,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'create'
                WHEN NEW.trang_thai = 'da_duyet' THEN 'approve'
                WHEN NEW.trang_thai = 'dang_luan_chuyen' THEN 'handover'
                WHEN NEW.trang_thai = 'hoan_thanh' THEN 'complete'
                ELSE 'edit'
            END,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'Tạo yêu cầu luân chuyển mới'
                WHEN NEW.trang_thai = 'da_duyet' THEN 'Phê duyệt yêu cầu'
                WHEN NEW.trang_thai = 'dang_luan_chuyen' THEN 'Bàn giao thiết bị'
                WHEN NEW.trang_thai = 'hoan_thanh' THEN 'Hoàn thành luân chuyển'
                ELSE 'Chỉnh sửa thông tin yêu cầu'
            END,
            NEW.updated_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-logging history
CREATE TRIGGER trigger_log_luan_chuyen_history
    AFTER INSERT OR UPDATE ON yeu_cau_luan_chuyen
    FOR EACH ROW
    EXECUTE FUNCTION log_luan_chuyen_history(); 